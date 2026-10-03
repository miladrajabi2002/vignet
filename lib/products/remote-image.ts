import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { safeHttpGet } from '@/lib/security/safe-http'
import { prisma } from '@/lib/prisma'
import { canonicalImageUrl, productImageSrc } from '@/lib/products/image-src'
import { BUCKETS, deleteFile, fileExists, isStorageConfigured, listFiles, uploadFile } from '@/lib/storage'

/**
 * Shared server-side cache for product photos hosted on shop domains.
 *
 * Two consumers read through it:
 *   - Instagram Generic Template cards: Meta's crawler is refused by many
 *     WooCommerce hosts (hotlink rules / WAF), and its renderer drops webp.
 *   - The dashboard and public pages: operators and customers on networks
 *     that cannot reach the shop (VPN exits, geo-blocks, filtering) saw broken
 *     thumbnails even though our server reaches the shop fine.
 *
 * Bytes are stored under `products/proxy/{sha1(url)}.{ext}` and served from
 * our origin by `app/media/products/[...key]`.
 */

const PRODUCT_IMAGE_PROXY_DIR = join(process.cwd(), 'public', 'uploads', 'products', 'proxy')

const PROXY_IMAGE_EXTS = ['jpg', 'png', 'webp', 'gif', 'avif'] as const
/** Formats Meta's Generic Template renderer displays. */
const TEMPLATE_IMAGE_EXTS = new Set(['jpg', 'png', 'gif'])
const PROXY_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export interface CachedRemoteImage {
  /** `{sha1}.{ext}` inside the shared `proxy/` cache. */
  filename: string
  /** True when the file lives only in the legacy local-disk cache. */
  legacyLocal?: boolean
}

export interface CacheRemoteImageOptions {
  /** Re-encode webp/avif as JPEG so Meta's template renderer shows it. */
  templateSafe?: boolean
}

function remoteImageHash(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

async function findCached(hash: string, templateSafe: boolean): Promise<CachedRemoteImage | null> {
  let legacy: CachedRemoteImage | null = null
  for (const ext of PROXY_IMAGE_EXTS) {
    if (templateSafe && !TEMPLATE_IMAGE_EXTS.has(ext)) continue
    const filename = `${hash}.${ext}`
    if (!legacy && existsSync(join(PRODUCT_IMAGE_PROXY_DIR, filename))) {
      legacy = { filename, legacyLocal: true }
      if (!isStorageConfigured()) return { filename }
    }
    if (isStorageConfigured() && (await fileExists(BUCKETS.products, `proxy/${filename}`))) {
      return { filename }
    }
  }
  return legacy
}

async function storeCached(filename: string, body: Buffer, contentType: string): Promise<void> {
  if (isStorageConfigured()) {
    // Deterministic keys make concurrent writes harmless and keep the cache
    // shared when the app runs on multiple instances.
    await uploadFile({
      bucket: BUCKETS.products,
      path: `proxy/${filename}`,
      body,
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    })
    return
  }
  await mkdir(PRODUCT_IMAGE_PROXY_DIR, { recursive: true })
  try {
    await writeFile(join(PRODUCT_IMAGE_PROXY_DIR, filename), body, { flag: 'wx' })
  } catch (e) {
    // Two requests racing on the same image: the loser gets EEXIST — the
    // cache file is already there, which is success.
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
  }
}

/**
 * Download `url` once (SSRF-guarded) and keep it in the shared proxy cache.
 * `url` must already be in its canonical percent-encoded form so the cache key
 * matches across callers. Throws when the source cannot be fetched; a legacy
 * local-only cache entry is returned before any network attempt only when no
 * object storage is configured.
 */
export async function cacheRemoteImage(
  url: string,
  options: CacheRemoteImageOptions = {},
): Promise<CachedRemoteImage> {
  const templateSafe = options.templateSafe ?? false
  const hash = remoteImageHash(url)
  const cached = await findCached(hash, templateSafe)
  if (cached && !cached.legacyLocal) return cached

  try {
    const res = await safeHttpGet(url, {
      timeoutMs: 15_000,
      maxBytes: 8 * 1024 * 1024,
      maxRedirects: 3,
      allowedContentTypes: ['image/'],
    })
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`source returned HTTP ${res.status}`)
    }
    const ct = String(res.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    const ext = PROXY_MIME_EXT[ct]
    if (!ext) throw new Error(`unsupported content-type "${ct}"`)

    let body = Buffer.from(res.body)
    let finalExt = ext
    let finalType = ct
    if (templateSafe && !TEMPLATE_IMAGE_EXTS.has(ext)) {
      body = await sharp(body, { failOn: 'error' })
        .rotate()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
      finalExt = 'jpg'
      finalType = 'image/jpeg'
    }

    const filename = `${hash}.${finalExt}`
    await storeCached(filename, body, finalType)
    console.log(
      `[product-image] cached ${body.byteLength}B → ${filename}` +
        (finalExt !== ext ? ` (converted from ${ext})` : '') +
        ` (src: ${url.slice(0, 120)})`,
    )
    return { filename }
  } catch (e) {
    if (cached) return cached
    throw e
  }
}

// ─── Per-workspace display thumbnails ─────────────────────────────────────
//
// The browser loads shop photos directly first (components/products/
// product-image.tsx) and only falls back to our copy when the shop is
// unreachable for that viewer. Fallback copies are small webp thumbnails kept
// per workspace under `products/thumbs/{workspaceId}/` with a byte quota; the
// oldest files are evicted first, and an evicted photo is simply rebuilt the
// next time someone needs it.

const THUMB_DIR = join(process.cwd(), 'public', 'uploads', 'products', 'thumbs')
const THUMB_MAX_PX = 480
const DEFAULT_THUMB_QUOTA_BYTES = 20 * 1024 * 1024

export class ThumbnailQuotaError extends Error {
  constructor() {
    super('PRODUCT_IMAGE_CACHE_QUOTA_REACHED')
    this.name = 'ThumbnailQuotaError'
  }
}

export function productImageQuotaBytes(): number {
  const raw = Number(process.env.PRODUCT_IMAGE_CACHE_QUOTA_BYTES)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_THUMB_QUOTA_BYTES
}

function safeWorkspaceId(workspaceId: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId)) throw new Error('INVALID_WORKSPACE_ID')
  return workspaceId
}

/** Storage key (inside the products bucket) of a workspace thumbnail. */
export function thumbnailKey(url: string, workspaceId: string): string {
  return `thumbs/${safeWorkspaceId(workspaceId)}/${remoteImageHash(url)}.webp`
}

interface ThumbFile {
  key: string
  size: number
  modifiedAt: number
}

async function listThumbnails(workspaceId: string): Promise<ThumbFile[]> {
  const prefix = `thumbs/${safeWorkspaceId(workspaceId)}/`
  if (isStorageConfigured()) {
    const objects = await listFiles(BUCKETS.products, prefix)
    return objects.map((o) => ({ key: o.key, size: o.size, modifiedAt: o.lastModified?.getTime() ?? 0 }))
  }
  const dir = join(THUMB_DIR, workspaceId)
  const names = await readdir(dir).catch(() => [] as string[])
  const files = await Promise.all(
    names.map(async (name) => {
      const info = await stat(join(dir, name)).catch(() => null)
      return info?.isFile() ? { key: `${prefix}${name}`, size: info.size, modifiedAt: info.mtimeMs } : null
    }),
  )
  return files.filter((f): f is ThumbFile => f !== null)
}

async function thumbnailExists(key: string): Promise<boolean> {
  if (isStorageConfigured()) return fileExists(BUCKETS.products, key)
  return existsSync(join(THUMB_DIR, ...key.split('/').slice(1)))
}

async function removeThumbnail(key: string): Promise<void> {
  if (isStorageConfigured()) {
    await deleteFile(BUCKETS.products, key)
    return
  }
  await unlink(join(THUMB_DIR, ...key.split('/').slice(1))).catch(() => undefined)
}

async function writeThumbnail(key: string, body: Buffer): Promise<void> {
  if (isStorageConfigured()) {
    await uploadFile({
      bucket: BUCKETS.products,
      path: key,
      body,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    })
    return
  }
  const [, workspaceId, filename] = key.split('/')
  await mkdir(join(THUMB_DIR, workspaceId), { recursive: true })
  await writeFile(join(THUMB_DIR, workspaceId, filename), body)
}

async function downloadThumbnail(url: string): Promise<Buffer> {
  const res = await safeHttpGet(url, {
    timeoutMs: 15_000,
    maxBytes: 8 * 1024 * 1024,
    maxRedirects: 3,
    allowedContentTypes: ['image/'],
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`source returned HTTP ${res.status}`)
  return sharp(Buffer.from(res.body), { failOn: 'error' })
    .rotate()
    .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer()
}

/** The cached thumbnail key for `url`, or null when it is not cached yet. */
export async function findWorkspaceThumbnail(url: string, workspaceId: string): Promise<string | null> {
  const key = thumbnailKey(url, workspaceId)
  return (await thumbnailExists(key)) ? key : null
}

/**
 * Download, shrink and store a display thumbnail for `url` (canonical
 * percent-encoded form) within the workspace quota. With `evict` the oldest
 * thumbnails make room; without it a full quota throws ThumbnailQuotaError.
 */
export async function cacheWorkspaceThumbnail(
  url: string,
  workspaceId: string,
  options: { evict?: boolean; existing?: ThumbFile[] } = {},
): Promise<string> {
  const key = thumbnailKey(url, workspaceId)
  const body = await downloadThumbnail(url)
  const quota = productImageQuotaBytes()
  const files = (options.existing ?? (await listThumbnails(workspaceId))).filter((f) => f.key !== key)
  let used = files.reduce((sum, f) => sum + f.size, 0)
  if (used + body.byteLength > quota) {
    if (!options.evict) throw new ThumbnailQuotaError()
    for (const file of [...files].sort((a, b) => a.modifiedAt - b.modifiedAt)) {
      if (used + body.byteLength <= quota) break
      await removeThumbnail(file.key)
      used -= file.size
    }
  }
  await writeThumbnail(key, body)
  if (options.existing) {
    options.existing.push({ key, size: body.byteLength, modifiedAt: Date.now() })
  }
  return key
}

/**
 * Pre-cache the cover photo of a workspace's products so they stay visible
 * when shops become unreachable (e.g. a national-internet cutoff). Stops at
 * the quota instead of evicting, skips covers already cached, and never
 * throws.
 */
export async function warmWorkspaceThumbnails(
  workspaceId: string,
  coverUrls: string[],
): Promise<{ cached: number; skipped: number; failed: number }> {
  const result = { cached: 0, skipped: 0, failed: 0 }
  let existing: ThumbFile[]
  try {
    existing = await listThumbnails(workspaceId)
  } catch {
    return result
  }
  const present = new Set(existing.map((f) => f.key))
  const queue = coverUrls.filter((url) => {
    const cached = present.has(thumbnailKey(url, workspaceId))
    if (cached) result.skipped++
    return !cached
  })
  let consecutiveFailures = 0
  let stop = false
  const worker = async () => {
    while (!stop && queue.length) {
      const url = queue.shift()!
      try {
        await cacheWorkspaceThumbnail(url, workspaceId, { existing })
        result.cached++
        consecutiveFailures = 0
      } catch (e) {
        if (e instanceof ThumbnailQuotaError) {
          stop = true
          return
        }
        result.failed++
        // A dead shop host: stop instead of timing out on every product.
        if (++consecutiveFailures >= 5) stop = true
      }
    }
  }
  await Promise.all([worker(), worker()])
  return result
}

const warmingWorkspaces = new Set<string>()

/**
 * Fire-and-forget after a catalog sync: pre-cache each active product's cover
 * photo (newest first) within the workspace quota.
 */
export function warmCatalogCovers(workspaceId: string): void {
  if (warmingWorkspaces.has(workspaceId)) return
  warmingWorkspaces.add(workspaceId)
  void (async () => {
    try {
      const products = await prisma.product.findMany({
        where: { workspaceId, active: true, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { images: true },
      })
      const covers = [
        ...new Set(
          products
            .map((p) => p.images?.[0])
            .filter((url): url is string => !!url && productImageSrc(url) !== url)
            .map((url) => canonicalImageUrl(url)),
        ),
      ]
      if (!covers.length) return
      const result = await warmWorkspaceThumbnails(workspaceId, covers)
      if (result.cached || result.failed) {
        console.log(
          `[product-image] warmed covers for ${workspaceId}: cached=${result.cached} skipped=${result.skipped} failed=${result.failed}`,
        )
      }
    } catch (e) {
      console.warn(`[product-image] cover warm-up failed for ${workspaceId}: ${(e as Error).message}`)
    } finally {
      warmingWorkspaces.delete(workspaceId)
    }
  })()
}
