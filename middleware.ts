import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig, PROTECTED_PREFIXES } from '@/auth.config'

const { auth } = NextAuth(authConfig)

// The `authorized` callback in authConfig gates access (and redirects).
// When access is allowed, we forward the current pathname so server layouts can
// make routing decisions (e.g. onboarding redirects). This MUST be set on the
// outgoing *request* headers — a header set on `NextResponse.next()`'s response
// is never visible to `headers()` in a server component, which left the layout
// reading an empty pathname and redirecting /onboarding → /onboarding in a loop
// (blank page after a new user's first login).
export default auth((req) => {
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
    res.cookies.set('locale', 'en', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
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
    '/api/agents/:path*',
    '/api/products/:path*',
    '/api/campaigns/:path*',
    '/api/integrations/:path*',
    '/api/sync/:path*',
    '/api/settings/:path*',
    '/api/operator-channel/:path*',
    '/api/workspace/:path*',
    '/api/billing/checkout',
    // English public URL prefix (see the /en handling above).
    '/en',
    '/en/:path*',
  ],
}
