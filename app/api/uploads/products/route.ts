import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { rateLimitCost } from '@/lib/ratelimit'
import { BUCKETS, isStorageConfigured, uploadFile } from '@/lib/storage'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DEFAULT_DAILY_BYTES = 100 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

function publicOrigin(request: Request): string {
  for (const candidate of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    new URL(request.url).origin,
  ]) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (
        url.protocol === 'https:' ||
        (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')
      ) {
        return url.origin
      }
    } catch {
      // Try the next configured origin.
    }
  }
  throw new Error('PUBLIC_ORIGIN_MISSING')
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 })

  const mime = file.type.toLowerCase()
  const ext = MIME_EXT[mime]
  if (!ext) return NextResponse.json({ error: 'INVALID_IMAGE_TYPE' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'IMAGE_TOO_LARGE', maxBytes: MAX_IMAGE_BYTES },
      { status: 413 },
    )
  }

  const configuredDailyBytes = Number(process.env.PRODUCT_IMAGE_UPLOAD_DAILY_BYTES)
  const dailyBytes =
    Number.isFinite(configuredDailyBytes) && configuredDailyBytes >= MAX_IMAGE_BYTES
      ? Math.floor(configuredDailyBytes)
      : DEFAULT_DAILY_BYTES
  const withinQuota = await rateLimitCost(
    `product-image-upload:${user.workspaceId}`,
    dailyBytes,
    86_400,
    file.size,
    { failClosed: true },
  )
  if (!withinQuota) return NextResponse.json({ error: 'UPLOAD_QUOTA_EXCEEDED' }, { status: 429 })

  const now = new Date()
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const filename = `${now.getTime()}-${randomUUID()}.${ext}`
  // The public URL goes through the crawler-facing [...key] serving route, NOT the
  // /uploads/... static path. Next.js production (`next start`) only serves
  // `public/` files that existed at build time — a file written at runtime
  // 404s from the static handler. The serving route streams it from disk so
  // the operator's browser AND Meta's crawler can fetch it. Its public URL is
  // deliberately outside `/api`: crawlers may retain a cached robots.txt deny
  // for that prefix even after a more-specific allow rule is deployed.
  const urlPath = `/media/products/${user.workspaceId}/${year}/${month}/${filename}`
  const relativePath = `/uploads/products/${user.workspaceId}/${year}/${month}/${filename}`
  const storagePath = `${user.workspaceId}/${year}/${month}/${filename}`
  const bytes = Buffer.from(await file.arrayBuffer())

  if (isStorageConfigured()) {
    // Shared object storage keeps uploads available across deploys and across
    // multiple application instances. The public route below remains stable,
    // so moving MinIO to external S3/CDN later requires no database migration.
    await uploadFile({
      bucket: BUCKETS.products,
      path: storagePath,
      body: bytes,
      contentType: mime,
      cacheControl: 'public, max-age=31536000, immutable',
    })
  } else {
    // Local-development fallback. Production validates S3/MinIO variables.
    const directory = join(
      process.cwd(),
      'public',
      'uploads',
      'products',
      user.workspaceId,
      year,
      month,
    )
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, filename), bytes, { flag: 'wx' })
  }

  return NextResponse.json(
    { url: `${publicOrigin(request)}${urlPath}`, path: relativePath },
    { status: 201 },
  )
}
