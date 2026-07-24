import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export interface SessionUser {
  id: string
  workspaceId: string
  platformRole: string
  phone: string
  name?: string | null
}

/** Return the current session user, or null if unauthenticated. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // NB: do not wrap auth() in try/catch — Next.js throws control-flow errors
  // (DynamicServerError, NEXT_REDIRECT) through it, and swallowing them breaks
  // the build/render. next-auth already returns a null session on a bad token.
  const session = await auth()
  if (!session?.user) return null
  const tokenUser = session.user as SessionUser

  // JWT claims describe the login-time snapshot. Re-read the user so deletion,
  // workspace moves and account deletion revoke stale sessions immediately.
  const current = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: {
      id: true,
      workspaceId: true,
      platformRole: true,
      phone: true,
      name: true,
    },
  })
  if (!current) return null

  return current
}

/**
 * Return the current user or redirect to clear the session + go to /login.
 *
 * IMPORTANT: we redirect to `/api/auth/force-logout` (NOT directly to /login)
 * when the user is missing. This breaks the redirect loop that happens when
 * a user's row is deleted from the database while their JWT cookie is still
 * valid:
 *
 *   /overview → middleware sees valid JWT → lets user in
 *            → requireUser() finds no user in DB → redirect to /login
 *            → /login → middleware sees valid JWT → redirect to /overview
 *            → INFINITE LOOP
 *
 * By redirecting to /api/auth/force-logout (which is NOT in the middleware
 * matcher and NOT in any protected prefix), the JWT cookie is properly
 * cleared BEFORE the user lands on /login — so the middleware sees no
 * session and lets the login form render normally.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/api/auth/force-logout')
  return user
}
