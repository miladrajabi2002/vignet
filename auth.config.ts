import type { NextAuthConfig } from 'next-auth'

/**
 * Top-level page route prefixes that require an authenticated session.
 * The dashboard lives in the (dashboard) route group, so its pages are
 * served at these root paths (no /dashboard prefix).
 */
export const PROTECTED_PREFIXES = [
  '/overview',
  '/agents',
  '/products',
  '/conversations',
  '/contacts',
  '/analytics',
  '/integrations',
  '/billing',
  '/settings',
  '/onboarding',
]

/**
 * Edge-safe auth config — shared by middleware and the Node auth instance.
 * Contains NO providers that need Node APIs (Prisma, ioredis); those are
 * added in auth.ts.
 */
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname

      if (path.startsWith('/login')) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/overview', nextUrl))
        }
        return true
      }

      const isProtected = PROTECTED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      )
      if (isProtected) return isLoggedIn // false → redirect to signIn page

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.workspaceId = user.workspaceId
        token.role = user.role
        token.phone = user.phone
        token.name = user.name ?? null
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.workspaceId = token.workspaceId as string
        session.user.role = token.role as string
        session.user.phone = token.phone as string
      }
      return session
    },
  },
} satisfies NextAuthConfig
