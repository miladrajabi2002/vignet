import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

const { auth } = NextAuth(authConfig)

// The `authorized` callback in authConfig gates access (and redirects).
// When access is allowed, we forward the current pathname as a header so
// server layouts can make routing decisions (e.g. onboarding redirects).
export default auth((req) => {
  const res = NextResponse.next()
  res.headers.set('x-pathname', req.nextUrl.pathname)
  return res
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|widget|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)$).*)',
  ],
}
