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
  try {
    const session = await auth()
    if (!session?.user) return null
    return session.user as SessionUser
  } catch (e) {
    // A transient JWT decode/secret error must not throw out of a Server
    // Component render (that blanks the whole page). Treat it as logged-out so
    // requireUser() cleanly redirects to /login instead.
    console.error('[session] auth() failed:', e)
    return null
  }
}

/** Return the current user or redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
