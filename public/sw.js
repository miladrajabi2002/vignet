/* Vigent service worker — makes the app installable and serves a friendly
 * offline page. Deliberately privacy-preserving:
 *
 *   • NOTHING authenticated is ever cached: /api/*, auth, and dashboard
 *     navigations go straight to the network. If the network is down the
 *     user sees the offline page — never a stale copy of private data.
 *   • Only fingerprinted build assets (/_next/static) and public files
 *     (fonts, brand icons, app icons) are cached — they are immutable and
 *     safe to reuse offline.
 */

const VERSION = 'v1'
const STATIC_CACHE = `vigent-static-${VERSION}`
const OFFLINE_URL = '/offline.html'

/* Same-origin GET paths that are public + immutable — cache-first. */
const CACHEABLE = [
  /^\/_next\/static\//,
  /^\/fonts\//,
  /^\/brands\//,
  /^\/icons?\//,
  /^\/android-chrome-/,
  /^\/favicon/,
  /^\/apple-touch-icon/,
  /^\/logo(-white)?\.svg$/,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/android-chrome-192x192.png', '/android-chrome-512x512.png']))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never intercept API/auth traffic.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Page navigations: network-only, with the offline page as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL)
        return (
          cached ||
          new Response('<h1 dir="rtl">اتصال اینترنت قطع است</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        )
      }),
    )
    return
  }

  // Immutable public assets: cache-first with background refresh.
  if (CACHEABLE.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
            }
            return response
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})
