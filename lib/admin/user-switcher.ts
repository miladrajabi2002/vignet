import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isPlatformOwnerPhone } from '@/lib/admin/owner'
import { planStanding } from '@/lib/billing/plan-standing'

export type SwitchableUser = {
  id: string
  name: string | null
  phone: string
  workspaceName: string
  plan: Plan
  /** Whether that plan still grants access (trial running, subscription live). */
  planActive: boolean
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
    plan: Plan
    trialEndsAt: Date | null
    periodEnd: Date | null
    lastActivityAt: Date
  }[]>`
    SELECT u."id"    AS "id",
           u."name"  AS "name",
           u."phone" AS "phone",
           w."name"  AS "workspaceName",
           w."plan"::text       AS "plan",
           w."trialEndsAt"      AS "trialEndsAt",
           s."currentPeriodEnd" AS "periodEnd",
           GREATEST(
             u."createdAt",
             COALESCE(u."lastLoginAt", u."createdAt"),
             COALESCE(lc."updatedAt", u."createdAt")
           ) AS "lastActivityAt"
    FROM "User" u
    JOIN "Workspace" w
      ON w."id" = u."workspaceId"
     AND w."excludeFromAdminReports" = false
    LEFT JOIN "Subscription" s
      ON s."workspaceId" = w."id"
     AND s."status" = 'ACTIVE'
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
  const now = new Date()
  return rows.map((row) => {
    const standing = planStanding(row, now)
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      workspaceName: row.workspaceName,
      plan: standing.plan,
      planActive: standing.active,
      lastActivityAt: row.lastActivityAt.toISOString(),
    }
  })
}
