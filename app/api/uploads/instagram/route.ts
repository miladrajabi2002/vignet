import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import {
  uploadFile,
  assertS3Configured,
  MAX_UPLOAD_SIZE,
} from '@/lib/storage/s3'

/**
 * Multipart upload endpoint for Instagram automation media.
 *
 * Accepts `multipart/form-data` with one or more files under the `files` field,
 * uploads each to the configured S3/MinIO bucket under the `instagram/` folder,
 * and returns the public HTTPS URLs the client should store against the
 * automation scenario (so `lib/instagram/media.ts` can later pass them to the
 * Instagram Messaging API as `attachment.payload.url`).
 *
 * Allowed types: image/*, audio/*, video/*.
 * Max size per file: 25 MB. Max files per request: 10.
 */

export const runtime = 'nodejs' // AWS SDK requires the Node.js runtime (not edge)
export const dynamic = 'force-dynamic'

const ALLOWED_PREFIXES = ['image/', 'audio/', 'video/'] as const
const MAX_FILES_PER_REQUEST = 10

interface UploadedFile {
  url: string
  key: string
  size: number
  contentType: string
  originalName: string
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Fail fast with a clear message if S3 env vars are missing — the operator
  // needs to fix .env, not debug an opaque AWS SDK stack trace.
  try {
    assertS3Configured()
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_FORM: expected multipart/form-data' },
      { status: 400 },
    )
  }

  const raw = form.getAll('files')
  const files = raw.filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json(
      { error: 'NO_FILES: provide one or more files in the "files" field' },
      { status: 400 },
    )
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `TOO_MANY_FILES: max ${MAX_FILES_PER_REQUEST} per request`,
      },
      { status: 400 },
    )
  }

  // Validate every file BEFORE uploading any — a bad file should 400, not leave
  // half an upload behind that the client then has to clean up.
  for (const f of files) {
    if (!ALLOWED_PREFIXES.some((p) => f.type.startsWith(p))) {
      return NextResponse.json(
        {
          error: `INVALID_TYPE: "${f.name}" has type "${f.type}" — only image/*, audio/*, video/* are allowed`,
        },
        { status: 400 },
      )
    }
    if (f.size === 0) {
      return NextResponse.json(
        { error: `EMPTY_FILE: "${f.name}" is empty` },
        { status: 400 },
      )
    }
    if (f.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          error: `TOO_LARGE: "${f.name}" is ${(f.size / 1024 / 1024).toFixed(2)} MB — max ${MAX_UPLOAD_SIZE / 1024 / 1024} MB`,
        },
        { status: 400 },
      )
    }
  }

  const uploaded: UploadedFile[] = []
  for (const f of files) {
    try {
      const res = await uploadFile(f, { folder: 'instagram' })
      uploaded.push({
        url: res.url,
        key: res.key,
        size: res.size,
        contentType: res.contentType,
        originalName: f.name,
      })
    } catch (e) {
      // Return what we have so far so the client can DELETE the orphaned
      // uploads (the delete endpoint is right next to this one).
      return NextResponse.json(
        {
          error: `UPLOAD_FAILED for "${f.name}": ${(e as Error).message}`,
          uploaded,
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ files: uploaded })
}
