import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

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
  ],
}
