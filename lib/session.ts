import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasWorkspacePermission, permissionForApiMutation } from '@/lib/workspace-permissions'

export interface SessionUser {
  id: string
  workspaceId: string
  role: string
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
  // workspace moves and role downgrades revoke old privileges immediately.
  const current = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: {
      id: true,
      workspaceId: true,
      role: true,
      platformRole: true,
      phone: true,
      name: true,
    },
  })
  if (!current) return null

  // Middleware supplies these trusted request headers for protected API paths.
  // Its fast JWT check remains useful, while this second gate uses the current
  // database role so a stale ADMIN token cannot authorize a later mutation.
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-pathname') ?? ''
  const method = requestHeaders.get('x-vigent-method') ?? 'GET'
  const permission = permissionForApiMutation(pathname, method)
  if (permission && !hasWorkspacePermission(current.role, permission)) return null

  return current
}

/** Return the current user or redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
