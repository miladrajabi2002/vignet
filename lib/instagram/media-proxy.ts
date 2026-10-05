/**
 * SINGLE source of truth for "which hosts may be relayed as Instagram media".
 *
 * Used by BOTH server-side proxies — no more duplicated allow-lists:
 *   - /api/instagram/media-image  (public, streaming — post/story thumbnails)
 *   - /api/agents/[id]/channels/[id]/avatar + /api/contacts/[id]/avatar
 *     (authenticated, buffered — channel bot + contact profile pictures)
 * and by this client-side helper that rewrites CDN urls onto the proxy route.
 *
 * WHY: Instagram's CDN (scontent*.cdninstagram.com / *.fbcdn.net and Meta's
 * sibling CDNs) is blocked from Iranian IPs. A browser without a VPN cannot
 * load these images directly, so every <img> that renders an Instagram media
 * URL must go through a same-origin server-side relay instead. Our own upload
 * URLs (uploads/…) and any other hosts pass through untouched.
 *
 * The proxies do NOT store anything shared — bytes are streamed (media-image)
 * or buffered for one response (avatars), and the BROWSER caches each image,
 * which is why toggling a VPN on/off never breaks or re-downloads anything.
 */

const PROXY_ROUTE = '/api/instagram/media-image'

/**
 * Meta-owned media hostnames we are willing to relay.
 * One shared allow-list so the streaming proxy and the avatar proxies can
 * never drift apart (they previously each kept a private copy).
 */
const META_MEDIA_HOST_SUFFIXES = [
  'cdninstagram.com',
  'fbcdn.net',
  'fbsbx.com',
  'akamaihd.net',
  'instagram.com',
] as const

/** True when the hostname belongs to an Instagram/Meta media CDN. */
export function isInstagramMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return META_MEDIA_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  )
}

/** True when the URL points at an Instagram/Meta media CDN host. */
export function isInstagramCdnUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return isInstagramMediaHost(hostname)
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
