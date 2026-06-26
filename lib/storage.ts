import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured')
  }
  client = createClient(url, key, { auth: { persistSession: false } })
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
  const { error } = await getClient()
    .storage.from(params.bucket)
    .upload(params.path, params.body, {
      contentType: params.contentType,
      upsert: true,
    })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return params.path
}

/** Download a file from storage as a Buffer. */
export async function downloadFile(
  bucket: string,
  path: string,
): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(bucket).download(path)
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`)
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/** Create a time-limited signed URL for private files (e.g. product images). */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await getClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn)
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`)
  return data.signedUrl
}

export function isStorageConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
}
