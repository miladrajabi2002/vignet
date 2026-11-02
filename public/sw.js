/* Vigent service worker — installable panel, push notifications and a
 * read-only offline copy of the dashboard.
 *
 *   • /api/* and auth traffic are never intercepted.
 *   • Fingerprinted build assets (/_next/static) and public files (fonts,
 *     brand icons, app icons) are cache-first: immutable and public.
 *   • Dashboard pages are network-first. The last copy of each page opened
 *     (at most PRIVATE_LIMIT) is kept so the panel still opens without a
 *     connection — read-only, under the «آفلاین» banner. That copy belongs to
 *     the signed-in user: it is wiped on /logout and /login, and whenever the
 *     panel reports a different user (message `vigent:session`).
 *   • Push: shows the alert from lib/notifications/web-push, sets the app
 *     badge, and a tap opens (or focuses) the panel on the alert's link.
 */

const VERSION = 'v2'
const STATIC_CACHE = `vigent-static-${VERSION}`
const PRIVATE_CACHE = 'vigent-pages'
const SESSION_KEY = '/__vigent/session'
const PRIVATE_LIMIT = 30
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

/* Dashboard page prefixes (auth.config.ts PROTECTED_PREFIXES). */
const DASHBOARD = /^\/(overview|agents|products|services|conversations|contacts|analytics|integrations|billing|settings|appointments|instagram|vigento|payments|store)(\/|$)/

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
      .then((keys) => Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== PRIVATE_CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

function wipePrivate() {
  return caches.delete(PRIVATE_CACHE)
}

async function rememberPage(request, response) {
  const cache = await caches.open(PRIVATE_CACHE)
  await cache.put(request, response)
  const keys = (await cache.keys()).filter((key) => !key.url.endsWith(SESSION_KEY))
  // Oldest entries first: keep the most recent PRIVATE_LIMIT pages.
  for (const key of keys.slice(0, Math.max(0, keys.length - PRIVATE_LIMIT))) await cache.delete(key)
}

async function offlinePage(request) {
  const cache = await caches.open(PRIVATE_CACHE)
  const url = new URL(request.url)
  const page = (await cache.match(request, { ignoreSearch: false })) || (await cache.match(url.pathname, { ignoreSearch: true }))
  if (page) return page
  const fallback = await caches.match(OFFLINE_URL)
  return (
    fallback ||
    new Response('<h1 dir="rtl">اتصال اینترنت قطع است</h1>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  )
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'vigent:session' && typeof data.userId === 'string') {
    event.waitUntil((async () => {
      const cache = await caches.open(PRIVATE_CACHE)
      const stored = await cache.match(SESSION_KEY)
      const previous = stored ? await stored.text() : null
      if (previous !== data.userId) {
        await wipePrivate()
        const fresh = await caches.open(PRIVATE_CACHE)
        await fresh.put(SESSION_KEY, new Response(data.userId))
      }
    })())
  }
  if (data.type === 'vigent:logout') event.waitUntil(wipePrivate())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never intercept API/auth traffic.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  if (request.mode === 'navigate') {
    // Leaving the account: nothing of it may stay on the device.
    if (url.pathname === '/logout' || url.pathname.startsWith('/login')) {
      event.respondWith(wipePrivate().then(() => fetch(request)).catch(() => offlinePage(request)))
      return
    }

    if (DASHBOARD.test(url.pathname)) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const type = response.headers.get('content-type') || ''
            if (response.ok && !response.redirected && type.includes('text/html')) {
              const copy = response.clone()
              event.waitUntil(rememberPage(request, copy).catch(() => undefined))
            }
            return response
          })
          .catch(() => offlinePage(request)),
      )
      return
    }

    event.respondWith(fetch(request).catch(() => offlinePage(request)))
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

/* ── Push ─────────────────────────────────────────────────────────────── */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'ویجنت', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'ویجنت'
  const link = typeof data.link === 'string' && data.link.startsWith('/') ? data.link : '/overview'

  event.waitUntil(Promise.all([
    // Safari revokes a subscription whose pushes show nothing, so every push
    // shows a notification — even with the panel open (same tag = replaced).
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || link,
      renotify: true,
      lang: 'fa',
      dir: 'rtl',
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      data: { link },
    }),
    typeof data.badge === 'number' && 'setAppBadge' in self.navigator
      ? (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => undefined)
      : Promise.resolve(),
    // An open panel refreshes its bell right away.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) client.postMessage({ type: 'vigent:push', link })
    }),
  ]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/overview'
  const target = new URL(link, self.location.origin).href

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin) continue
      await client.focus()
      if ('navigate' in client) {
        await client.navigate(target).catch(() => client.postMessage({ type: 'vigent:open', link }))
      }
      return
    }
    await self.clients.openWindow(target)
  })())
})

/* The browser rotated the subscription: hand the new one to the panel. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const response = await fetch('/api/push/subscription', { credentials: 'include' }).catch(() => null)
    const json = response && response.ok ? await response.json().catch(() => null) : null
    if (!json || !json.publicKey) return
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(json.publicKey),
    })
    await fetch('/api/push/subscription', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
  })().catch(() => undefined))
})

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}
