import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { deleteFile } from '@/lib/storage/s3'

/**
 * DELETE endpoint for an Instagram automation media upload.
 *
 * Used when the user picks a file in the automation form, then deletes it
 * before saving — so we don't leak orphaned objects in the bucket.
 *
 * Path: `DELETE /api/uploads/instagram/{key}` where `{key}` is the full S3 key
 * (URL-encoded slashes are decoded by Next.js). We use a catch-all segment so
 * keys like `instagram/2024/01/1700000000000-a1b2c3.jpg` work as-is.
 *
 * Auth: any logged-in user (no per-user ownership check — the upload endpoint
 * doesn't record ownership either; the key itself is unguessable enough for
 * the threat model of an internal operator dashboard).
 *
 * Safety: only keys that start with `instagram/` are deletable — this prevents
 * a malicious caller from deleting product images, knowledge base files, etc.
 * by guessing their keys.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ key?: string[] }> }

export async function DELETE(_req: Request, props: Params) {
  const { key: keySegments } = await props.params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!keySegments || keySegments.length === 0) {
    return NextResponse.json({ error: 'MISSING_KEY' }, { status: 400 })
  }

  // Reject path-traversal attempts in any single segment (e.g. `..`).
  if (keySegments.some((seg) => seg === '..' || seg.includes('\\'))) {
    return NextResponse.json(
      { error: 'INVALID_KEY: bad segments' },
      { status: 400 },
    )
  }

  const key = keySegments.join('/')

  // Only allow deleting files uploaded for Instagram automation. This is the
  // critical guardrail — without it, anyone with a valid session could delete
  // objects from other buckets/prefixes that happen to live in the same bucket.
  if (!key.startsWith('instagram/')) {
    return NextResponse.json(
      {
        error:
          'FORBIDDEN: this endpoint only deletes files in the instagram/ folder',
      },
      { status: 403 },
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
