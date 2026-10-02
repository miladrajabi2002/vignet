import { prisma } from '@/lib/prisma'
import { isPlatformOwnerPhone } from '@/lib/admin/owner'

export type SwitchableUser = {
  id: string
  name: string | null
  phone: string
  workspaceName: string
  /** ISO timestamp of the newest sign-in or conversation activity. */
  lastActivityAt: string
}

const SWITCHABLE_USER_LIMIT = 300

/**
 * The header account switcher belongs to the platform owner only: either their
 * own signed-in session, or a support session they opened from it.
 */
export function canSwitchUsers(user: {
  phone: string
  platformRole: string
  impersonatedByAdmin?: boolean
}): boolean {
  if (user.impersonatedByAdmin) return true
  return user.platformRole === 'ADMIN' && isPlatformOwnerPhone(user.phone)
}

/**
 * Customer accounts ordered by their most recent activity — the newest of the
 * last panel sign-in and the last conversation update in their workspace.
 * Excludes admin-hidden workspaces, like every other admin listing.
 */
export async function listSwitchableUsers(): Promise<SwitchableUser[]> {
  const rows = await prisma.$queryRaw<{
    id: string
    name: string | null
    phone: string
    workspaceName: string
    lastActivityAt: Date
  }[]>`
    SELECT u."id"    AS "id",
           u."name"  AS "name",
           u."phone" AS "phone",
           w."name"  AS "workspaceName",
           GREATEST(
             u."createdAt",
             COALESCE(u."lastLoginAt", u."createdAt"),
             COALESCE(lc."updatedAt", u."createdAt")
           ) AS "lastActivityAt"
    FROM "User" u
    JOIN "Workspace" w
      ON w."id" = u."workspaceId"
     AND w."excludeFromAdminReports" = false
    LEFT JOIN LATERAL (
      SELECT c."updatedAt"
      FROM "Conversation" c
      WHERE c."workspaceId" = u."workspaceId"
      ORDER BY c."updatedAt" DESC
      LIMIT 1
    ) lc ON true
    WHERE u."platformRole" = 'USER'
    ORDER BY "lastActivityAt" DESC
    LIMIT ${SWITCHABLE_USER_LIMIT}
  `
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    workspaceName: row.workspaceName,
    lastActivityAt: row.lastActivityAt.toISOString(),
  }))
}
