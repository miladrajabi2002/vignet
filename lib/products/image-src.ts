/**
 * Browser-facing `src` for a product photo.
 *
 * Synced catalogs keep the shop's own image URLs (e.g. ceeports.ir). Viewers
 * whose network cannot reach that shop — VPN exits blocked by the shop's
 * firewall, geo-blocks, filtering — got broken thumbnails, so external URLs go
 * through `app/media/products/remote`, which serves a server-side cached copy
 * from our origin. Our own uploads, data/blob URLs and relative paths pass
 * through untouched. Safe to call from client and server components.
 */
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
