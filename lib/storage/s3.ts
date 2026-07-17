import { S3Client } from '@aws-sdk/client-s3'

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

let cachedClient: S3Client | null = null

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
