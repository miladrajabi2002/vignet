import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { safeHttpGet } from '@/lib/security/safe-http'
import { BUCKETS, fileExists, isStorageConfigured, uploadFile } from '@/lib/storage'

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

/** Cached copy of `url` (canonical percent-encoded form), without fetching. */
export async function findCachedRemoteImage(url: string): Promise<CachedRemoteImage | null> {
  return findCached(remoteImageHash(url), false)
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
