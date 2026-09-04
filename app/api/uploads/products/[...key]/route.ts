import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { readFile, unlink } from 'fs/promises'
import { resolve, sep } from 'path'
import { existsSync } from 'fs'
import { BUCKETS, deleteFile, downloadFile, isStorageConfigured } from '@/lib/storage'

/**
 * Product image uploads — public GET + authenticated DELETE.
 *
 * WHY THIS ROUTE EXISTS (v3.3):
 * New files live in the shared `products` S3/MinIO bucket. Local-disk reads
 * remain as a migration fallback for uploads created before v3.4 and for
 * development without object storage.
 *
 * This catch-all route keeps a stable public URL regardless of the storage
 * backend, so the file is reachable at:
 *
 *   GET /api/uploads/products/{workspaceId}/{year}/{month}/{filename}
 *   GET /api/uploads/products/proxy/{hash}.{ext}   <- server-side image cache
 *
 * by:
 *   - the operator's browser (product form thumbnails, pickers, preview)
 *   - Meta's Instagram API crawler, which fetches template image URLs
 *     server-side and REQUIRES public HTTPS + explicit Content-Length.
 *
 * GET is PUBLIC (no login) because Meta's crawler can't authenticate and
 * <img src="..."> tags can't send auth headers. Paths are unguessable
 * (timestamp + UUID) and the shared `proxy/` cache is keyed by SHA-1 of the
 * source URL, so public reads only expose public product photos.
 *
 * DELETE requires auth, workspace-scoped, and refuses the shared `proxy/`
 * cache (those entries are immutable and shared across scenarios).
 *
 * Safety: strict key validation prevents access outside the product bucket or
 * the local migration directory.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ key?: string[] }> }

/** MIME map from file extension — so images render inline instead of downloading. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

/**
 * Resolve the catch-all `key` segments into a safe local file path.
 * Returns null when the path is invalid or escapes the uploads directory.
 * The `products/` folder is always prepended on disk — it's NOT part of `key`.
 */
function resolveFilePath(keySegments: string[] | undefined): string | null {
  if (!keySegments || keySegments.length === 0) return null
  // Reject path-traversal attempts in any single segment (e.g. `..`).
  if (keySegments.some((seg) => seg === '..' || seg.includes('\\'))) return null
  // Reject anything that looks like an absolute/relative path escape.
  if (keySegments.some((seg) => seg.startsWith('/') || seg.startsWith('~'))) return null
  const root = resolve(process.cwd(), 'public', 'uploads', 'products')
  const candidate = resolve(root, ...keySegments)
  return candidate.startsWith(`${root}${sep}`) ? candidate : null
}

/** Convert validated URL segments into an S3 object key. */
function resolveStorageKey(keySegments: string[] | undefined): string | null {
  if (!keySegments || keySegments.length === 0) return null
  if (
    keySegments.some(
      (seg) =>
        !seg ||
        seg === '.' ||
        seg === '..' ||
        seg.includes('\\') ||
        seg.includes('/') ||
        seg.startsWith('~'),
    )
  )
    return null
  return keySegments.join('/')
}

/** Handle CORS preflight requests from Meta's crawler. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/** Stream an uploaded product image from disk (public — browser + Meta crawler). */
export async function GET(_req: Request, props: Params) {
  const { key: keySegments } = await props.params
  const storageKey = resolveStorageKey(keySegments)
  const filePath = resolveFilePath(keySegments)
  if (!storageKey || !filePath) {
    return NextResponse.json({ error: 'INVALID_KEY' }, { status: 400 })
  }

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const contentType = EXT_TO_MIME[ext] || 'application/octet-stream'

  try {
    let buf: Buffer | null = null
    if (isStorageConfigured()) {
      try {
        buf = await downloadFile(BUCKETS.products, storageKey)
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
        const name = (error as { name?: string }).name
        if (status !== 404 && name !== 'NotFound' && name !== 'NoSuchKey') throw error
      }
    }
    if (!buf && existsSync(filePath)) buf = await readFile(filePath)
    if (!buf) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    // Meta's crawler REQUIRES an explicit Content-Length header — without it
    // Meta treats the file as 0 bytes and returns "Upload failed (code=100)".
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buf.byteLength),
        // Uploaded media is immutable (timestamp + UUID key / URL-hash cache).
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[product-media] read failed', error)
    return NextResponse.json({ error: 'READ_FAILED' }, { status: 500 })
  }
}

/** Delete an uploaded product image from disk (operator only, own workspace). */
export async function DELETE(_req: Request, props: Params) {
  const { key: keySegments } = await props.params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!keySegments || keySegments[0] !== user.workspaceId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  // The shared image-proxy cache is NOT deletable by tenants.
  if (keySegments[1] === 'proxy') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const filePath = resolveFilePath(keySegments)
  const storageKey = resolveStorageKey(keySegments)
  if (!filePath || !storageKey) {
    return NextResponse.json(
      { error: 'INVALID_KEY or forbidden (only products/ allowed)' },
      { status: 400 },
    )
  }

  try {
    if (isStorageConfigured()) await deleteFile(BUCKETS.products, storageKey)
    if (existsSync(filePath)) await unlink(filePath)
    return NextResponse.json({ ok: true, key: keySegments.join('/') })
  } catch (error) {
    console.error('[product-media] delete failed', error)
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
  }
}
