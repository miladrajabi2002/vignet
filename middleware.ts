import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig, PROTECTED_PREFIXES } from '@/auth.config'
import { LOCALE_COOKIE } from '@/lib/locale'
import { hasSessionCookie, isMarketingPath, SITE_ROUTE_PREFIX, siteVariant } from '@/lib/marketing/site-variant'

const { auth } = NextAuth(authConfig)

const SITE_REWRITE_HEADER = 'x-vigent-site-rewrite'

const LOCALE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
} as const

// ── Public site → its static variant ────────────────────────────────────
// /pricing (or /en/pricing) is served from /vg-site/<variant>/pricing, the
// page prerendered for this visitor's locale and signed-in state (see
// lib/marketing/site-variant.ts). The URL in the browser stays the same.
// Runs before Auth.js: public pages never need the session decoded.
function routePublicSite(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl
  // The internal paths are not public URLs (they would duplicate every page
  // for crawlers). Middleware runs again for our own rewrite below, which is
  // marked with SITE_REWRITE_HEADER; anything else gets the 404. The header
  // only reveals public pages, so a hand-set one exposes nothing.
  if (pathname === SITE_ROUTE_PREFIX || pathname.startsWith(`${SITE_ROUTE_PREFIX}/`)) {
    if (req.headers.get(SITE_REWRITE_HEADER) === '1') return NextResponse.next()
    return NextResponse.rewrite(new URL('/vg-site-not-found', req.url))
  }

  const onEnPrefix = pathname === '/en' || pathname.startsWith('/en/')
  const rest = onEnPrefix ? pathname.slice(3) || '/' : pathname
  if (!isMarketingPath(rest)) return null
  // Blog and status are fa-only: the /en handling below redirects them.
  if (onEnPrefix && (rest.startsWith('/blog') || rest === '/status')) return null

  const locale = onEnPrefix || req.cookies.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'fa'
  const signedIn = hasSessionCookie(req.cookies.getAll().map(({ name }) => name))
  const url = req.nextUrl.clone()
  url.pathname = `${SITE_ROUTE_PREFIX}/${siteVariant(locale, signedIn)}${rest === '/' ? '' : rest}`
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(SITE_REWRITE_HEADER, '1')
  const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  // Persist English for this visitor, exactly like the /en rewrite below.
  if (onEnPrefix) res.cookies.set(LOCALE_COOKIE, 'en', LOCALE_COOKIE_OPTIONS)
  return res
}

// The `authorized` callback in authConfig gates access (and redirects).
// When access is allowed, we forward the current pathname so server layouts can
// make routing decisions (e.g. onboarding redirects). This MUST be set on the
// outgoing *request* headers — a header set on `NextResponse.next()`'s response
// is never visible to `headers()` in a server component, which left the layout
// reading an empty pathname and redirecting /onboarding → /onboarding in a loop
// (blank page after a new user's first login).
const authMiddleware = auth((req) => {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  // ── English URL prefix (/en, /en/pricing, …) ──────────────────────────
  // Rendering is locale-cookie based, so English previously had no URL of its
  // own: /en 404'd, sharing an English page meant sharing a cookie, and no
  // hreflang alternates could exist. Now /en/<path> rewrites to <path> with a
  // request-level locale override (i18n/request.ts reads the header first), so
  // crawlers and shared links get stable, indexable English URLs.
  const { pathname } = req.nextUrl
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.slice(3) || '/'

    // Never rewrite API, build assets or auth-protected dashboard paths —
    // those must keep flowing through their own matcher rules/auth checks.
    // A 308 redirect strips the prefix and re-enters middleware normally.
    // Blog and status pages are fa-only ISR pages (Persian content; a shared
    // rewrite would let /en/* serve the cached fa HTML at an English URL), so
    // they redirect too instead of pretending to be bilingual.
    const isPassthrough =
      rest.startsWith('/api/') ||
      rest.startsWith('/_next/') ||
      rest === '/api' ||
      rest === '/_next' ||
      rest.startsWith('/blog') ||
      rest === '/status' ||
      PROTECTED_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`))
    if (isPassthrough) {
      const url = req.nextUrl.clone()
      url.pathname = rest
      return NextResponse.redirect(url, 308)
    }

    const url = req.nextUrl.clone()
    url.pathname = rest
    requestHeaders.set('x-vigent-locale', 'en')
    requestHeaders.set('x-pathname', rest)
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    // Persist English for this visitor so navigation inside the app stays
    // English even when links drop the /en prefix (mirrors /api/locale).
    res.cookies.set(LOCALE_COOKIE, 'en', LOCALE_COOKIE_OPTIONS)
    return res
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}) as unknown as NextMiddleware

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  return routePublicSite(req) ?? authMiddleware(req, event)
}

export const config = {
  // Node.js runtime (stable since Next 15.5). The app only ever runs on
  // `next start` under Node, so the Edge sandbox bought nothing, and bundling
  // next-auth for Edge produced a jose CompressionStream warning on every build.
  runtime: 'nodejs',
  matcher: [
        '/login',
        '/overview/:path*',
        '/agents/:path*',
        '/products/:path*',
        '/services/:path*',
        '/conversations/:path*',
        '/contacts/:path*',
        '/analytics/:path*',
        '/integrations/:path*',
        '/billing/:path*',
        '/settings/:path*',
        '/onboarding/:path*',
        '/appointments/:path*',
        '/instagram/:path*',
        '/vigento/:path*',
        '/payments/:path*',
        '/store/:path*',
    '/api/agents/:path*',
    '/api/products/:path*',
    '/api/campaigns/:path*',
    '/api/integrations/:path*',
    '/api/payments/:path*',
    // /api/sync/* is deliberately NOT matched: the WooCommerce webhook posts
    // bodies up to 4 MB there, and routing them through Node middleware left
    // the route handler with an already-disturbed body stream ("Response body
    // object should not be disturbed or locked"). The route authenticates
    // itself (webhook token + signature, or getCurrentUser for manual sync).
    '/api/settings/:path*',
    '/api/operator-channel/:path*',
    '/api/workspace/:path*',
    '/api/billing/checkout',
    // English public URL prefix (see the /en handling above).
    '/en',
    '/en/:path*',
    // Public site, served from its static variants (routePublicSite).
    '/',
    '/pricing',
    '/privacy',
    '/terms',
    '/status',
    '/solutions/:path*',
    '/docs/:path*',
    '/blog/:path*',
    '/vg-site/:path*',
  ],
}
