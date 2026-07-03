import { prisma } from '@/lib/prisma'

/**
 * Per-workspace daily series helpers for the USER dashboard.
 * All functions return a 7-element array (oldest → newest) of daily counts,
 * aligned to the local day boundary, so they can be fed directly into
 * Sparkline / MiniTrend components without N+1 queries.
 *
 * These mirror lib/admin/charts.ts but are scoped to a single workspace,
 * so the user dashboard only sees its own data.
 */

export interface DailySeries {
  /** 7 daily counts, oldest → newest. */
  series: number[]
  /** Sum of the series. */
  total: number
}

function buildSeries(
  rows: { d: Date; c: bigint }[],
  days: number,
): DailySeries {
  const byKey = new Map<string, number>()
  for (const r of rows) {
    const key = new Date(r.d).toISOString().slice(0, 10)
    byKey.set(key, (byKey.get(key) ?? 0) + Number(r.c))
  }
  const series: number[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let total = 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const v = byKey.get(d.toISOString().slice(0, 10)) ?? 0
    series.push(v)
    total += v
  }
  return { series, total }
}

/** Daily new conversations for a workspace. */
export async function conversationsDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily new messages (all roles) for a workspace. */
export async function messagesDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', m."createdAt") AS d, count(*) AS c
    FROM "Message" m
    JOIN "Conversation" conv ON conv."id" = m."conversationId"
    WHERE conv."workspaceId" = ${workspaceId} AND m."createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily token usage (prompt + completion) for a workspace. */
export async function tokensDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "date") AS d,
           COALESCE(sum("promptTokens" + "completionTokens"), 0) AS c
    FROM "UsageLog"
    WHERE "workspaceId" = ${workspaceId} AND "date" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily new contacts (customers) for a workspace. */
export async function contactsDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Contact"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily new products for a workspace. */
export async function productsDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Product"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily handoffs (conversations escalated to human operator). */
export async function handoffsDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "handedOff" = true AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily resolved conversations. */
export async function resolvedDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "status" = 'RESOLVED' AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

/** Daily count of conversations that received a rating. */
export async function ratingsDailyByWorkspace(
  workspaceId: string,
  days = 7,
): Promise<DailySeries> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "rating" IS NOT NULL AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return buildSeries(rows, days)
}

// ─── PER-AGENT SPARKLINE (for agents list) ────────────────────────

/**
 * Daily conversation counts for the last N days, grouped by agentId,
 * scoped to a single workspace. Used for inline sparklines on the
 * agents list page.
 */
export async function conversationsDailyByAgent(
  workspaceId: string,
  days = 7,
): Promise<Map<string, DailySeries>> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ agentId: string; d: Date; c: bigint }[]>`
    SELECT "agentId", date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

  const out = new Map<string, DailySeries>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const r of rows) {
    let entry = out.get(r.agentId)
    if (!entry) {
      entry = { series: new Array(days).fill(0), total: 0 }
      out.set(r.agentId, entry)
    }
    const d = new Date(r.d)
    d.setHours(0, 0, 0, 0)
    const idx = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
    if (idx >= 0 && idx < days) {
      const n = Number(r.c)
      entry.series[days - 1 - idx] = n
      entry.total += n
    }
  }
  return out
}

// ─── SAVINGS ESTIMATE ─────────────────────────────────────────────

/**
 * Estimate time/cost saved by the AI agent handling conversations
 * without human intervention.
 *
 * Logic:
 *  - Resolved conversations (not handed off) = "automated"
 *  - Average human handling time per conversation: ~8 minutes (industry estimate)
 *  - Hourly cost of a human operator: ~75,000 IRR (configurable via env)
 *
 * Returns { conversations, minutesSaved, hoursSaved, costSavedIRR, series }.
 */
export interface SavingsEstimate {
  /** Conversations fully handled by AI (resolved, not handed off). */
  conversations: number
  /** Total minutes of human work saved. */
  minutesSaved: number
  /** Total hours of human work saved. */
  hoursSaved: number
  /** Estimated cost saved in IRR (Toman). */
  costSavedIRR: number
  /** 7-day series of daily automated-conversation counts. */
  series: number[]
}

const MIN_PER_CONVERSATION = Number(process.env.SAVINGS_MIN_PER_CONV ?? 8)
const IRR_PER_HOUR = Number(process.env.SAVINGS_IRR_PER_HOUR ?? 75_000)

export async function getSavingsEstimate(
  workspaceId: string,
  days = 7,
): Promise<SavingsEstimate> {
  const since = new Date(Date.now() - days * 86_400_000)

  const [totalAgg, dailyRows] = await Promise.all([
    prisma.conversation.count({
      where: {
        workspaceId,
        status: 'RESOLVED',
        handedOff: false,
      },
    }),
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
      FROM "Conversation"
      WHERE "workspaceId" = ${workspaceId}
        AND "status" = 'RESOLVED'
        AND "handedOff" = false
        AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
  ])

  // Build the 7-day series.
  const byKey = new Map<string, number>()
  for (const r of dailyRows) {
    const key = new Date(r.d).toISOString().slice(0, 10)
    byKey.set(key, (byKey.get(key) ?? 0) + Number(r.c))
  }
  const series: number[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    series.push(byKey.get(d.toISOString().slice(0, 10)) ?? 0)
  }

  const minutesSaved = totalAgg * MIN_PER_CONVERSATION
  const hoursSaved = Math.round((minutesSaved / 60) * 10) / 10
  const costSavedIRR = Math.round((minutesSaved / 60) * IRR_PER_HOUR)

  return {
    conversations: totalAgg,
    minutesSaved,
    hoursSaved,
    costSavedIRR,
    series,
  }
}
