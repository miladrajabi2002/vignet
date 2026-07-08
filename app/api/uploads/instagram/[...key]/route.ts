import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getS3Client, getBucket, deleteFile } from '@/lib/storage/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * Instagram automation media — GET (stream from S3) + DELETE.
 *
 * GET streams the object bytes to the browser so uploaded images/audio/video
 * render in the dashboard and the live iPhone preview. It is PUBLIC (no login)
 * because:
 *   - The operator's browser needs to load the preview without auth headers on
 *     an <img src="..."> tag.
 *   - Meta's Instagram API crawler fetches the same URL server-side to send
 *     the media as a DM attachment — it can't authenticate either.
 * The key (timestamp + 6-char random) is unguessable enough for the threat model.
 *
 * DELETE removes the object — auth required (operator only).
 *
 * Safety: only keys starting with `instagram/` are servable/deletable, so this
 * route can't be abused as a generic S3 proxy.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ key?: string[] }> }

function resolveKey(keySegments: string[] | undefined): string | null {
  if (!keySegments || keySegments.length === 0) return null
  // Reject path-traversal attempts in any single segment (e.g. `..`).
  if (keySegments.some((seg) => seg === '..' || seg.includes('\\'))) return null
  const key = keySegments.join('/')
  if (!key.startsWith('instagram/')) return null
  return key
}

/** MIME map from file extension — so images render inline instead of downloading. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  weba: 'audio/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

/** Stream an uploaded media file from S3 to the browser (public). */
export async function GET(_req: Request, props: Params) {
  const { key: keySegments } = await props.params
  const key = resolveKey(keySegments)
  if (!key) {
    return NextResponse.json({ error: 'INVALID_KEY' }, { status: 400 })
  }

  let body
  try {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    )
    body = res.Body
    if (!body) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  const contentType = EXT_TO_MIME[ext] || 'application/octet-stream'

  const headers = new Headers({
    'Content-Type': contentType,
    // Cache for a year — uploaded media is immutable (timestamp + random key).
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  })

  // Prefer a streaming response (Node 18+ supports transformToWebStream).
  const streamable = body as { transformToWebStream?: () => ReadableStream }
  if (typeof streamable.transformToWebStream === 'function') {
    return new NextResponse(streamable.transformToWebStream() as unknown as ReadableStream, {
      headers,
    })
  }

  // Fallback: buffer the whole body.
  try {
    const buffered = body as { transformToByteArray?: () => Promise<Uint8Array> }
    if (typeof buffered.transformToByteArray === 'function') {
      const bytes = await buffered.transformToByteArray()
      // Copy into a standalone ArrayBuffer so NextResponse accepts it as BodyInit.
      const ab = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(ab).set(bytes)
      return new NextResponse(ab, { headers })
    }
  } catch {
    /* fall through to 500 */
  }
  return NextResponse.json({ error: 'STREAM_FAILED' }, { status: 500 })
}

/** Delete an uploaded media file (operator only). */
export async function DELETE(_req: Request, props: Params) {
  const { key: keySegments } = await props.params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const key = resolveKey(keySegments)
  if (!key) {
    return NextResponse.json(
      { error: 'INVALID_KEY or forbidden (only instagram/ allowed)' },
      { status: 400 },
    )
  }

  try {
    await deleteFile(key)
  } catch (e) {
    return NextResponse.json(
      { error: `DELETE_FAILED: ${(e as Error).message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, key })
}
