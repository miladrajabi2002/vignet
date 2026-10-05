/**
 * Client-side helper — rewrite Instagram CDN image URLs through our
 * same-origin streaming proxy (`/api/instagram/media-image`).
 *
 * WHY: Instagram's CDN (scontent*.cdninstagram.com / *.fbcdn.net) is blocked
 * from Iranian IPs. A browser without a VPN cannot load these thumbnails
 * directly, so every <img> that renders an Instagram media URL must go
 * through the server-side relay instead. Our own upload URLs (uploads/…) and
 * any other hosts pass through untouched.
 *
 * The proxy does NOT store anything — it streams bytes server→browser and
 * lets the BROWSER cache each image for an hour, which is why toggling a VPN
 * on/off never breaks or re-downloads anything.
 */

const PROXY_ROUTE = '/api/instagram/media-image'

/** True when the URL points at an Instagram/Meta media CDN host. */
export function isInstagramCdnUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    const host = hostname.toLowerCase()
    if (host === 'cdninstagram.com' || host.endsWith('.cdninstagram.com')) return true
    if (host === 'fbcdn.net' || host.endsWith('.fbcdn.net')) return true
    return false
  } catch {
    return false
  }
}

/**
 * Map an Instagram CDN url to the same-origin proxy url.
 * Non-CDN urls (our uploads, product images, …) are returned unchanged so
 * existing behavior is preserved everywhere else.
 */
export function igProxySrc(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (!isInstagramCdnUrl(url)) return url
  return `${PROXY_ROUTE}?u=${encodeURIComponent(url)}`
}
