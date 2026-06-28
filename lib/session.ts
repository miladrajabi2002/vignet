import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export interface SessionUser {
  id: string
  workspaceId: string
  role: string
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
  return session.user as SessionUser
}

/** Return the current user or redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
