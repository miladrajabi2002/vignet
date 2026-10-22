import type { Plan, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isPlatformOwnerPhone } from '@/lib/admin/owner'
import { planStanding, SOON_DAYS, type PlanStanding } from '@/lib/billing/plan-standing'

export type SwitchableUser = {
  id: string
  name: string | null
  phone: string
  workspaceName: string
  /** The plan, whether it still grants access, and the days left in its period. */
  standing: PlanStanding
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
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    workspaceName: row.workspaceName,
    standing: planStanding(row, now),
    lastActivityAt: row.lastActivityAt.toISOString(),
  }))
}

/**
 * Customer plans (trials included) that run out within the next week: the
 * count on the switcher button. Same scope as the switcher's own list.
 */
export async function countPlansEndingSoon(now: Date = new Date()): Promise<number> {
  return prisma.workspace.count({
    where: {
      excludeFromAdminReports: false,
      owner: { is: { platformRole: 'USER' } },
      ...planEndingSoonWhere(now),
    },
  })
}

/** Workspaces whose trial or live subscription period ends within the next week. */
export function planEndingSoonWhere(now: Date = new Date()): Prisma.WorkspaceWhereInput {
  const until = new Date(now.getTime() + SOON_DAYS * 86_400_000)
  return {
    OR: [
      { plan: 'TRIAL', trialEndsAt: { gte: now, lte: until } },
      {
        plan: { not: 'TRIAL' },
        subscriptions: { some: { status: 'ACTIVE', currentPeriodEnd: { gte: now, lte: until } } },
      },
    ],
  }
}
