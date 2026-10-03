/**
 * Canonical percent-encoded form of an image URL (Meta payloads and cache
 * keys): keeps the reserved ASCII structure
 * intact, encodes non-ASCII (Persian) path segments. `encodeURI` semantics are
 * exactly what a browser address bar does, and Meta's crawler accepts it.
 *
 * IDEMPOTENT (v3.3): callers upstream (`pickTemplateImageUrl`, `safeProductUrl`)
 * frequently pass an ALREADY percent-encoded URL. Naively re-encoding would
 * escape the percent signs themselves (%D8 → %25D8 — double encoding), which
 * made Meta's crawler 404 on Persian product-image URLs and drop the image.
 * We only encode when the URL contains no percent-escapes yet.
 */
export function canonicalImageUrl(url: string): string {
  try {
    if (/%[0-9A-Fa-f]{2}/.test(url)) return url
    return encodeURI(url)
  } catch {
    return url
  }
}

export const REMOTE_PRODUCT_IMAGE_PATH = '/media/products/remote'

function ownHostname(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  if (!base) return null
  try {
    return new URL(base).hostname
  } catch {
    return null
  }
}

/**
 * Our-origin fallback `src` for a product photo hosted on a shop domain.
 *
 * Synced catalogs keep the shop's own image URLs (e.g. ceeports.ir). Viewers
 * whose network cannot reach that shop — VPN exits blocked by the shop's
 * firewall, geo-blocks, filtering — get this URL from <ProductImage> after the
 * direct load fails; `app/media/products/remote` serves a cached thumbnail.
 * Our own uploads, data/blob URLs and relative paths are returned unchanged.
 * Safe to call from client and server components.
 */
export function productImageSrc(url: string): string
export function productImageSrc(url: string | null | undefined): string | undefined
export function productImageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const value = url.trim()
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const parsed = new URL(value)
    if (parsed.hostname === ownHostname()) return value
  } catch {
    return value
  }
  return `${REMOTE_PRODUCT_IMAGE_PATH}?u=${encodeURIComponent(value)}`
}
