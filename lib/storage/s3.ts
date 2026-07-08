import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3'

/**
 * S3 / MinIO object storage helpers for Instagram automation media.
 *
 * The Instagram Messaging API (`/me/messages` with `attachment.type=image|audio|video`)
 * requires the media URL to be **publicly reachable over HTTPS** — Meta's crawler
 * fetches the bytes server-side. A local MinIO at `http://127.0.0.1:9000` does NOT
 * satisfy that requirement on its own; the operator must put MinIO behind a public
 * HTTPS reverse proxy (Caddy/Nginx) and expose the bucket base URL via the
 * `S3_PUBLIC_URL` env var (e.g. `https://cdn.vigent.ir`).
 *
 * Required env vars:
 *   - S3_ENDPOINT      e.g. http://127.0.0.1:9000   (MinIO API)
 *   - S3_ACCESS_KEY    e.g. vignet
 *   - S3_SECRET_KEY
 *   - S3_REGION        e.g. us-east-1
 *   - S3_BUCKET        e.g. vignet-media             (must already exist)
 *   - S3_PUBLIC_URL    e.g. https://cdn.vigent.ir    (public HTTPS base; optional
 *                       but REQUIRED for Instagram API — a warning is logged if absent)
 */

const DEFAULT_BUCKET = 'vignet-media'
const DEFAULT_FOLDER = 'instagram'

/** Max upload size enforced by the API route (Instagram media cap is 25 MB). */
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024 // 25 MB

export interface UploadResult {
  /** Public HTTPS URL — pass this to the Instagram Messaging API as `attachment.payload.url`. */
  url: string
  /** Storage key, e.g. `instagram/2024/01/1700000000000-a1b2c3.jpg`. */
  key: string
  /** Object size in bytes. */
  size: number
  /** MIME type as reported by the browser. */
  contentType: string
}

export interface UploadOptions {
  /** Folder prefix for the key. Defaults to `instagram`. */
  folder?: string
}

let cachedClient: S3Client | null = null
let publicUrlWarned = false

/**
 * Validate that every required S3 env var is present. Throws a clear, actionable
 * error listing exactly what is missing — surfaced as a 500 by the API route so
 * the operator can fix `.env` instead of debugging an opaque SDK stack trace.
 *
 * Only 4 vars are strictly required: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY,
 * S3_REGION. S3_BUCKET defaults to "vignet-media"; S3_PUBLIC_URL is optional
 * (without it, URLs fall back to the endpoint — fine for local dev, but
 * Instagram API requires a public HTTPS URL).
 */
export function assertS3Configured(): void {
  const required = [
    'S3_ENDPOINT',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_REGION',
  ] as const
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      'S3 storage not configured. Set ' +
        missing.join(', ') +
        ' in .env. (S3_BUCKET defaults to "vignet-media"; S3_PUBLIC_URL is optional but required for Instagram API.)',
    )
  }
}

/** Returns true when every required S3 env var is set (does NOT touch the network). */
export function isS3Configured(): boolean {
  try {
    assertS3Configured()
    return true
  } catch {
    return false
  }
}

/** Get the configured bucket name (defaults to `vignet-media`). */
export function getBucket(): string {
  return process.env.S3_BUCKET || DEFAULT_BUCKET
}

let bucketEnsured = false

/**
 * Ensure the configured bucket exists. Creates it if missing. Idempotent —
 * checks once per process lifetime. This avoids the "bucket does not exist"
 * error when the operator hasn't pre-created the bucket in MinIO.
 */
export async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return
  const client = getS3Client()
  const bucket = getBucket()
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    bucketEnsured = true
  } catch {
    // Bucket doesn't exist (or we lack HeadBucket perms). Try to create it.
    try {
      await client.send(
        new CreateBucketCommand({ Bucket: bucket }),
      )
      console.log(`[storage/s3] Created bucket "${bucket}"`)
      bucketEnsured = true
    } catch (e) {
      // If creation fails because it already exists (race), treat as success.
      console.error(`[storage/s3] Failed to create bucket "${bucket}":`, e)
      bucketEnsured = true // don't retry every request
    }
  }
}

/**
 * Returns a singleton S3Client configured for MinIO (path-style addressing).
 * Validates env vars on first call. The same client is reused for the lifetime
 * of the process — S3Client is designed to be long-lived (it pools connections).
 */
export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient
  assertS3Configured()
  cachedClient = new S3Client({
    endpoint: process.env.S3_ENDPOINT as string,
    region: process.env.S3_REGION as string,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
    // MinIO requires path-style bucket addressing (https://endpoint/bucket/key
    // rather than https://bucket.endpoint/key). Also works fine against AWS S3.
    forcePathStyle: true,
  })
  return cachedClient
}

/** Map common MIME types to a safe file extension (used when the file has no name/ext). */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'weba',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

/**
 * Build a safe, unique S3 key for an uploaded file.
 *
 * Format: `{folder}/{YYYY}/{MM}/{timestamp}-{random6}.{ext}`
 *
 * - `YYYY/MM` partitions objects by month so a flat bucket listing stays
 *   manageable as uploads accumulate.
 * - `timestamp` (ms) + 6-char base36 random gives uniqueness without a UUID
 *   dependency and stays filesystem-safe.
 * - `ext` is taken from the original filename when present (lower-cased),
 *   otherwise derived from the MIME type. Falls back to `bin` as a last resort.
 */
function buildKey(file: File, folder: string): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear().toString()
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0')
  const ts = now.getTime()
  const rand = Math.random().toString(36).slice(2, 8).padStart(6, '0')
  const nameExt = (file.name.split('.').pop() || '').toLowerCase()
  const ext = nameExt || MIME_TO_EXT[file.type] || 'bin'
  return `${folder}/${yyyy}/${mm}/${ts}-${rand}.${ext}`
}

/**
 * Public HTTPS URL for an object.
 *
 * Two modes:
 *
 * 1. **Through the Next.js app (default):** returns
 *    `${S3_PUBLIC_URL}/uploads/${key}`. The app's `/api/uploads/instagram/[...key]`
 *    route streams the object from S3 — this works with ANY S3_PUBLIC_URL that
 *    points at the public app origin (e.g. `https://vigent.ir`) without any
 *    extra reverse-proxy config. This is the recommended mode because it also
 *    enforces the route's auth/key-prefix checks.
 *
 * 2. **Direct-to-S3 (when `S3_DIRECT_S3=1`):** returns `${S3_PUBLIC_URL}/${key}`.
 *    Use this ONLY when S3_PUBLIC_URL points directly at a public S3/MinIO endpoint
 *    (e.g. `https://cdn.vigent.ir` → MinIO). Requires a reverse-proxy from the
 *    public host to MinIO. Faster (no app hop) but bypasses the route's checks.
 *
 * Without `S3_PUBLIC_URL`, falls back to `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
 * (loopback — fine for local browsing but NOT for the Instagram API, which
 * requires a publicly reachable HTTPS URL).
 */
export function publicUrl(key: string): string {
  const publicBase = process.env.S3_PUBLIC_URL
  if (publicBase) {
    const base = publicBase.replace(/\/+$/, '')
    // Route through the Next.js app's `/uploads/` proxy by default — this is
    // the mode that works out-of-the-box with `S3_PUBLIC_URL=https://vigent.ir`.
    const directS3 = process.env.S3_DIRECT_S3 === '1'
    return directS3 ? `${base}/${key}` : `${base}/uploads/${key}`
  }
  if (!publicUrlWarned) {
    console.warn(
      '[storage/s3] S3_PUBLIC_URL is not set — falling back to S3_ENDPOINT. ' +
        'The Instagram Messaging API will NOT be able to fetch these media URLs ' +
        '(Meta requires publicly reachable HTTPS). Set S3_PUBLIC_URL to the public ' +
        'HTTPS base of your bucket (e.g. https://cdn.vigent.ir).',
    )
    publicUrlWarned = true
  }
  const endpoint = process.env.S3_ENDPOINT || ''
  return `${endpoint.replace(/\/+$/, '')}/${getBucket()}/${key}`
}

/**
 * Upload a single File/Blob to the configured S3 bucket.
 *
 * The object is marked `ACL: 'public-read'` so the public URL returned by
 * `publicUrl(key)` is fetchable without signing. (For S3 providers that have
 * ACLs disabled — e.g. AWS S3 buckets created after April 2023 — switch to a
 * bucket policy; MinIO supports ACLs by default.)
 *
 * @aws-sdk/lib-storage is NOT installed in this project, so we use PutObjectCommand
 * directly. For files up to 25 MB this is fine — lib-storage's multipart upload
 * is only needed for objects > 5 GB.
 */
export async function uploadFile(
  file: File,
  opts?: UploadOptions,
): Promise<UploadResult> {
  assertS3Configured()
  const client = getS3Client()
  await ensureBucket()
  const bucket = getBucket()
  const folder = (opts?.folder ?? DEFAULT_FOLDER).replace(/^\/+|\/+$/g, '')
  const key = buildKey(file, folder)
  const contentType = file.type || 'application/octet-stream'
  const body = Buffer.from(await file.arrayBuffer())

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
      ACL: 'public-read',
    }),
  )

  return {
    url: publicUrl(key),
    key,
    size: body.byteLength,
    contentType,
  }
}

/** Delete an object by key. No-op if the object does not exist (S3 semantics). */
export async function deleteFile(key: string): Promise<void> {
  assertS3Configured()
  const client = getS3Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  )
}
