/**
 * What each Instagram automation achieved in a window (default 30 days):
 * how many people it reached, how the follow gate converted, and what those
 * people did next in the same conversation within 7 days — kept talking,
 * placed an order, booked, or enrolled. Read from InstagramAutomationRun.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface AutomationReport {
  automationId: string
  runs: number
  people: number
  reached: number
  gated: number
  followConfirmed: number
  failed: number
  engaged: number
  orders: number
  bookings: number
  enrollments: number
  lastRunAt: string | null
}

export type AutomationReportMap = Record<string, AutomationReport>

function empty(automationId: string): AutomationReport {
  return {
    automationId, runs: 0, people: 0, reached: 0, gated: 0, followConfirmed: 0, failed: 0,
    engaged: 0, orders: 0, bookings: 0, enrollments: 0, lastRunAt: null,
  }
}

/** Share of `part` in `whole` as a whole percent, or null when nothing to divide. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

export async function getAutomationReports(params: {
  workspaceId: string
  automationIds: readonly string[]
  days?: number
}): Promise<AutomationReportMap> {
  const ids = [...params.automationIds]
  const map: AutomationReportMap = Object.fromEntries(ids.map((id) => [id, empty(id)]))
  if (!ids.length) return map
  const since = new Date(Date.now() - (params.days ?? 30) * 86_400_000)

  try {
    const counts = await prisma.$queryRaw<Array<{
      automationId: string
      runs: bigint
      people: bigint
      reached: bigint
      gated: bigint
      confirmed: bigint
      failed: bigint
      last_at: Date | null
    }>>`
      SELECT "automationId",
        COUNT(*) AS runs,
        COUNT(DISTINCT "igUserId") AS people,
        COUNT(DISTINCT "igUserId") FILTER (WHERE outcome IN ('SENT', 'FOLLOW_CONFIRMED')) AS reached,
        COUNT(DISTINCT "igUserId") FILTER (WHERE outcome = 'GATED') AS gated,
        COUNT(DISTINCT "igUserId") FILTER (WHERE outcome = 'FOLLOW_CONFIRMED') AS confirmed,
        COUNT(*) FILTER (WHERE outcome = 'FAILED') AS failed,
        MAX("createdAt") AS last_at
      FROM "InstagramAutomationRun"
      WHERE "workspaceId" = ${params.workspaceId}
        AND "automationId" IN (${Prisma.join(ids)})
        AND "createdAt" >= ${since}
      GROUP BY "automationId"`

    // First successful touch per person and conversation, then what that
    // conversation shows in the following 7 days.
    const outcomes = await prisma.$queryRaw<Array<{
      automationId: string
      engaged: bigint
      orders: bigint
      bookings: bigint
      enrollments: bigint
    }>>`
      WITH touch AS (
        SELECT "automationId", "igUserId", "conversationId", MIN("createdAt") AS at
        FROM "InstagramAutomationRun"
        WHERE "workspaceId" = ${params.workspaceId}
          AND "automationId" IN (${Prisma.join(ids)})
          AND "createdAt" >= ${since}
          AND outcome IN ('SENT', 'GATED', 'FOLLOW_CONFIRMED')
          AND "conversationId" IS NOT NULL
        GROUP BY 1, 2, 3
      )
      SELECT t."automationId",
        COUNT(DISTINCT t."igUserId") FILTER (WHERE EXISTS (
          SELECT 1 FROM "Message" m
          WHERE m."conversationId" = t."conversationId" AND m.role = 'USER'
            AND m."createdAt" > t.at + INTERVAL '1 minute' AND m."createdAt" < t.at + INTERVAL '7 days'
        )) AS engaged,
        COUNT(DISTINCT t."igUserId") FILTER (WHERE EXISTS (
          SELECT 1 FROM "OrderDraft" o
          WHERE o."conversationId" = t."conversationId"
            AND o.status IN ('SUBMITTED', 'PAID', 'ON_HOLD')
            AND o."updatedAt" > t.at AND o."updatedAt" < t.at + INTERVAL '7 days'
        )) AS orders,
        COUNT(DISTINCT t."igUserId") FILTER (WHERE EXISTS (
          SELECT 1 FROM "Appointment" a
          WHERE a."workspaceId" = ${params.workspaceId}
            AND a.metadata->>'conversationId' = t."conversationId"
            AND a."createdAt" > t.at AND a."createdAt" < t.at + INTERVAL '7 days'
        )) AS bookings,
        COUNT(DISTINCT t."igUserId") FILTER (WHERE EXISTS (
          SELECT 1 FROM "CourseEnrollment" e
          WHERE e."conversationId" = t."conversationId" AND e.status <> 'CANCELLED'
            AND e."createdAt" > t.at AND e."createdAt" < t.at + INTERVAL '7 days'
        )) AS enrollments
      FROM touch t
      GROUP BY t."automationId"`

    for (const row of counts) {
      const report = map[row.automationId]
      if (!report) continue
      report.runs = Number(row.runs)
      report.people = Number(row.people)
      report.reached = Number(row.reached)
      report.gated = Number(row.gated)
      report.followConfirmed = Number(row.confirmed)
      report.failed = Number(row.failed)
      report.lastRunAt = row.last_at ? row.last_at.toISOString() : null
    }
    for (const row of outcomes) {
      const report = map[row.automationId]
      if (!report) continue
      report.engaged = Number(row.engaged)
      report.orders = Number(row.orders)
      report.bookings = Number(row.bookings)
      report.enrollments = Number(row.enrollments)
    }
  } catch {
    // Before the migration the run table does not exist: an empty report.
  }
  return map
}
