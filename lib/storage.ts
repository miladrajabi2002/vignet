import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// S3-compatible object storage (self-hosted MinIO, or any S3 provider).
// Configure via env: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION.
let client: S3Client | null = null

function getClient(): S3Client {
  if (client) return client
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY not configured')
  }
  client = new S3Client({
    endpoint,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for MinIO (path-style bucket addressing)
  })
  return client
}

export const BUCKETS = {
  knowledge: 'knowledge',
  products: 'products',
} as const

/** Upload a file buffer and return its storage key (path within the bucket). */
export async function uploadFile(params: {
  bucket: string
  path: string
  body: Buffer | Uint8Array
  contentType: string
}): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.path,
      Body: params.body,
      ContentType: params.contentType,
    }),
  )
  return params.path
}

/** Download a file from storage as a Buffer. */
export async function downloadFile(
  bucket: string,
  path: string,
): Promise<Buffer> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: path }),
  )
  if (!res.Body) throw new Error(`Storage download failed: empty body for ${path}`)
  const bytes = await res.Body.transformToByteArray()
  return Buffer.from(bytes)
}

/** Create a time-limited signed URL for private files (e.g. product images). */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket, Key: path }),
    { expiresIn },
  )
}

export function isStorageConfigured(): boolean {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY
  )
}
