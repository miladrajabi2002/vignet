import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'
import { ADMIN_VISIBLE_WORKSPACE_WHERE, adminVisibleWorkspaceSql } from '@/lib/admin/reporting-scope'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'

export interface DailyPoint {
        day: string // Persian label, e.g. "۲۱ تیر"
        value: number
}

/** A labeled monthly bucket for revenue/usage charts. */
export interface MonthPoint {
        month: string // Persian month label, e.g. "ژوئیه ۲۰۲۶"
        value: number
        raw?: string // ISO year-month key for sorting
}

/** Timezone used for day-boundary alignment. Defaults to Iran. */
const DASHBOARD_TZ = process.env.DASHBOARD_TZ || 'Asia/Tehran'

/** Format a Date as YYYY-MM-DD in the dashboard timezone. */
function tzDayKey(d: Date): string {
        try {
                return new Intl.DateTimeFormat('en-CA', {
                        timeZone: DASHBOARD_TZ,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                }).format(d)
        } catch {
                return d.toISOString().slice(0, 10)
        }
}

function label(d: Date): string {
        return new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, {
                timeZone: DASHBOARD_TZ,
                month: 'short',
                day: 'numeric',
        }).format(d)
}

function monthLabel(d: Date): string {
        return new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, {
                timeZone: DASHBOARD_TZ,
                year: 'numeric',
                month: 'long',
        }).format(d)
}

/** Turn sparse {date->value} rows into a continuous series over the last N days. */
function fillSeries(rows: { d: string; v: number }[], days: number): DailyPoint[] {
        const byKey = new Map<string, number>()
        for (const r of rows) {
                byKey.set(r.d, r.v)
        }
        const out: DailyPoint[] = []
        const now = Date.now()
        for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now - i * 86_400_000)
                const key = tzDayKey(d)
                out.push({ day: label(d), value: byKey.get(key) ?? 0 })
        }
        return out
}

/** Build a continuous monthly series over the last N months. */
function fillMonthly(rows: { m: string; v: number }[], months: number): MonthPoint[] {
        const byKey = new Map<string, number>()
        for (const r of rows) byKey.set(r.m, r.v)

        const out: MonthPoint[] = []
        const now = new Date()
        for (let i = months - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                out.push({ month: monthLabel(d), value: byKey.get(key) ?? 0, raw: key })
        }
        return out
}

// ─── DAILY SERIES ─────────────────────────────────────────────────

export async function conversationsDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Conversation"
    WHERE "createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

export async function errorsDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "ErrorLog"
    WHERE "createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

/** Error-log volume for one severity, aligned to the dashboard timezone. */
export async function errorsDailyByLevel(
        level: 'error' | 'warn',
        days = 14,
): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "ErrorLog"
    WHERE "createdAt" >= ${since} AND "level" = ${level}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(rows.map((row) => ({ d: row.d, v: Number(row.c) })), days)
}

export async function usageChargesDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           COALESCE(sum("chargedIRR"), 0) AS c
    FROM "UsageLog"
    WHERE "date" >= ${since} AND "status" = 'CAPTURED'
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c ?? 0) })), days)
}

/** New user sign-ups per day. */
export async function newUsersDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "User"
    WHERE "createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

/** New channel connections (AgentChannel rows) created per day. */
export async function connectionsDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "AgentChannel"."createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "AgentChannel"
    JOIN "Agent" ON "Agent"."id" = "AgentChannel"."agentId"
    WHERE "AgentChannel"."createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"Agent"."workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

/** Successful payments count per day. */
export async function paymentsDaily(days = 14): Promise<DailyPoint[]> {        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "paidAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

// ─── REVENUE SERIES ───────────────────────────────────────────────
//
// Revenue is split by currency because ZarinPay charges in IRR and
// NowPayments charges in USD. We report each series separately so the
// admin always sees the true numbers without a flaky FX assumption.

/** Daily revenue in IRR (ZarinPay PAID payments). */
export async function revenueIRRDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "paidAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, COALESCE(sum("amount"), 0) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "currency" = 'IRR' AND "paidAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c ?? 0) })),
                days,
        )
}

/** Monthly revenue in IRR over the last N months. */
export async function revenueIRRMonthly(months = 12): Promise<MonthPoint[]> {
        const since = new Date()
        since.setMonth(since.getMonth() - (months - 1))
        since.setDate(1)
        since.setHours(0, 0, 0, 0)
        const rows = await prisma.$queryRaw<{ m: string; c: bigint }[]>`
    SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS m,
           COALESCE(sum("amount"), 0) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "currency" = 'IRR' AND "paidAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1 ORDER BY 1
  `
        return fillMonthly(
                rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })),
                months,
        )
}

// ─── DISTRIBUTIONS ────────────────────────────────────────────────

export interface Slice {
        key: string
        label: string
        value: number
}

/** Workspace count grouped by plan. */
export async function planDistribution(): Promise<Slice[]> {
        const rows = await prisma.workspace.groupBy({
                by: ['plan'],
                where: ADMIN_VISIBLE_WORKSPACE_WHERE,
                _count: { _all: true },
        })
        const labels: Record<string, string> = {
                TRIAL: 'آزمایشی',
                STARTER: 'استارتر',
                PRO: 'حرفه‌ای',
                BUSINESS: 'سازمانی',
        }
        return rows.map((r) => ({
                key: r.plan,
                label: labels[r.plan] ?? r.plan,
                value: r._count._all,
        }))
}

// ─── PER-WORKSPACE SPARKLINE ──────────────────────────────────────

export interface WorkspaceSpark {
        workspaceId: string
        /** 7 daily counts, oldest → newest. */
        series: number[]
        total: number
}

export interface AgentSpark {
        agentId: string
        series: number[]
        total: number
}

/** Daily conversation counts grouped by agent, suitable for list sparklines. */
export async function conversationsDailyByAgent(
        days = 7,
): Promise<Map<string, AgentSpark>> {
        const since = new Date(Date.now() - days * 86_400_000)
        const rows = await prisma.$queryRaw<{ agentId: string; d: string; c: bigint }[]>`
    SELECT "agentId",
           to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           count(*) AS c
    FROM "Conversation"
    WHERE "createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

        const out = new Map<string, AgentSpark>()
        const now = Date.now()
        const dayKeys = Array.from({ length: days }, (_, index) =>
                tzDayKey(new Date(now - (days - 1 - index) * 86_400_000)),
        )

        for (const row of rows) {
                let entry = out.get(row.agentId)
                if (!entry) {
                        entry = { agentId: row.agentId, series: new Array(days).fill(0), total: 0 }
                        out.set(row.agentId, entry)
                }
                const index = dayKeys.indexOf(row.d)
                if (index >= 0) {
                        const value = Number(row.c)
                        entry.series[index] = value
                        entry.total += value
                }
        }

        return out
}

/**
 * Daily conversation counts for the last 7 days, grouped by workspaceId.
 * Used to render inline sparklines on the users list without N+1 queries.
 * Only includes workspaces that had at least one conversation in the window.
 */
export async function conversationsDailyByWorkspace(
        days = 7,
): Promise<Map<string, WorkspaceSpark>> {
        const since = new Date(Date.now() - days * 86_400_000)
        const rows = await prisma.$queryRaw<{ workspaceId: string; d: string; c: bigint }[]>`
    SELECT "workspaceId",
           to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           count(*) AS c
    FROM "Conversation"
    WHERE "createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

        const out = new Map<string, WorkspaceSpark>()
        const now = Date.now()
        const dayKeys: string[] = []
        for (let i = days - 1; i >= 0; i--) {
                dayKeys.push(tzDayKey(new Date(now - i * 86_400_000)))
        }
        for (const r of rows) {
                let entry = out.get(r.workspaceId)
                if (!entry) {
                        entry = { workspaceId: r.workspaceId, series: new Array(days).fill(0), total: 0 }
                        out.set(r.workspaceId, entry)
                }
                const idx = dayKeys.indexOf(r.d)
                if (idx >= 0 && idx < days) {
                        const n = Number(r.c)
                        entry.series[idx] = n
                        entry.total += n
                }
        }
        return out
}

// ─── ERROR SPARKLINE (by source) ───────────────────────────────────

export interface ErrorSpark {
        source: string
        series: number[]
        total: number
}

/**
 * Daily error counts for the last N days, grouped by source.
 * Used for inline sparklines on the errors page and a top-of-page trend.
 */
export async function errorsDailyBySource(days = 7): Promise<Map<string, ErrorSpark>> {
        const since = new Date(Date.now() - days * 86_400_000)
        const rows = await prisma.$queryRaw<{ source: string | null; d: string; c: bigint }[]>`
    SELECT "source",
           to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           count(*) AS c
    FROM "ErrorLog"
    WHERE "createdAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

        const out = new Map<string, ErrorSpark>()
        const now = Date.now()
        const dayKeys: string[] = []
        for (let i = days - 1; i >= 0; i--) {
                dayKeys.push(tzDayKey(new Date(now - i * 86_400_000)))
        }
        for (const r of rows) {
                const key = r.source ?? 'unknown'
                let entry = out.get(key)
                if (!entry) {
                        entry = { source: key, series: new Array(days).fill(0), total: 0 }
                        out.set(key, entry)
                }
                const idx = dayKeys.indexOf(r.d)
                if (idx >= 0 && idx < days) {
                        const n = Number(r.c)
                        entry.series[idx] = n
                        entry.total += n
                }
        }
        return out
}

// ─── PAYMENT SPARKLINE (by workspace) ──────────────────────────────

export interface PaymentSpark {
        workspaceId: string
        series: number[]
        total: number
}

/**
 * Daily PAID payment counts for the last N days, grouped by workspaceId.
 * Used for inline sparklines next to top workspaces on the revenue page.
 */
export async function paymentsDailyByWorkspace(
        days = 7,
): Promise<Map<string, PaymentSpark>> {
        const since = new Date(Date.now() - days * 86_400_000)
        const rows = await prisma.$queryRaw<{ workspaceId: string; d: string; c: bigint }[]>`
    SELECT "workspaceId",
           to_char(date_trunc('day', "paidAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           count(*) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" >= ${since}
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

        const out = new Map<string, PaymentSpark>()
        const now = Date.now()
        const dayKeys: string[] = []
        for (let i = days - 1; i >= 0; i--) {
                dayKeys.push(tzDayKey(new Date(now - i * 86_400_000)))
        }
        for (const r of rows) {
                let entry = out.get(r.workspaceId)
                if (!entry) {
                        entry = { workspaceId: r.workspaceId, series: new Array(days).fill(0), total: 0 }
                        out.set(r.workspaceId, entry)
                }
                const idx = dayKeys.indexOf(r.d)
                if (idx >= 0 && idx < days) {
                        const n = Number(r.c)
                        entry.series[idx] = n
                        entry.total += n
                }
        }
        return out
}

// ─── NET REVENUE (credit-based, minus OpenRouter cost) ──────────────
//
// The user-facing "revenue" on this platform is the credit deducted from
// each workspace's wallet when an AI reply is sent (UsageLog.chargedIRR).
// That gross number is reduced by the real provider cost (UsageLog.cost in
// USD, converted to IRR with the platform rate) to get the true daily net
// revenue. Showing gross vs net side-by-side makes the unit economics
// visible at a glance.

export interface NetRevenuePoint {
        /** Persian day label, e.g. "۲۱ تیر" */
        day: string
        /** Credit charged to users, gross (IRR) */
        grossIRR: number
        /** OpenRouter cost in IRR (USD × platform rate) */
        costIRR: number
        /** Net revenue = gross − cost (IRR) */
        netIRR: number
}

/**
 * Daily net revenue = sum(chargedIRR) − sum(cost USD × usdToIrrRate).
 * Returns a continuous N-day series aligned to the dashboard timezone.
 */
export async function revenueNetDaily(days = 7): Promise<NetRevenuePoint[]> {
        const since = new Date(Date.now() - days * 86_400_000)

        // Resolve USD→IRR rate from platform commercial config (DB override)
        // falling back to FINANCE_USD_TO_IRR env var. When neither is set we
        // can't compute a meaningful net, so we report cost as 0 and surface
        // only the gross number — better than silently using a wrong rate.
        const commercialConfig = await getPlatformCommercialConfig()
        const usdToIrr =
                (commercialConfig.financeUsdToIRR && commercialConfig.financeUsdToIRR > 0
                        ? commercialConfig.financeUsdToIRR
                        : null) ??
                (Number(process.env.FINANCE_USD_TO_IRR) > 0
                        ? Math.round(Number(process.env.FINANCE_USD_TO_IRR))
                        : 0)

        const rows = await prisma.$queryRaw<{ d: string; gross: bigint; costUSD: number | null }[]>`
    SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           COALESCE(sum("chargedIRR"), 0) AS gross,
           COALESCE(sum("cost"), 0)    AS "costUSD"
    FROM "UsageLog"
    WHERE "date" >= ${since}
      AND "status" = 'CAPTURED'
      AND ${adminVisibleWorkspaceSql(Prisma.sql`"workspaceId"`)}
    GROUP BY 1
    ORDER BY 1
  `

        const byKey = new Map<string, { gross: number; costUSD: number }>()
        for (const r of rows) {
                byKey.set(r.d, { gross: Number(r.gross ?? 0), costUSD: Number(r.costUSD ?? 0) })
        }

        const out: NetRevenuePoint[] = []
        const now = Date.now()
        for (let i = days - 1; i >= 0; i -= 1) {
                const d = new Date(now - i * 86_400_000)
                const key = tzDayKey(d)
                const v = byKey.get(key)
                const gross = v?.gross ?? 0
                const costIRR = Math.round((v?.costUSD ?? 0) * usdToIrr)
                out.push({
                        day: label(d),
                        grossIRR: gross,
                        costIRR,
                        netIRR: gross - costIRR,
                })
        }
        return out
}

// ─── TOP ACTIVE USERS ──────────────────────────────────────────────
//
// "Active" = the user's workspace had at least one conversation in the
// last N days. We rank by conversation count so the busiest business
// owners surface to the top of the admin overview.

export interface ActiveUserRow {
        userId: string
        name: string | null
        phone: string
        workspaceId: string
        workspaceName: string
        plan: string
        conversationCount: number
        lastActivityAt: Date | null
}

/**
 * Top N active users by conversation volume in their workspace over the
 * last `days` days. Excludes admin-hidden workspaces. Returns at most
 * `limit` rows, ordered by conversation count desc then recency desc.
 */
export async function topActiveUsers(limit = 5, days = 30): Promise<ActiveUserRow[]> {
        const since = new Date(Date.now() - days * 86_400_000)
        const rows = await prisma.$queryRaw<{
                userId: string
                name: string | null
                phone: string
                workspaceId: string
                workspaceName: string
                plan: string
                conversationCount: bigint
                lastActivityAt: Date | null
        }[]>`
    SELECT u."id"          AS "userId",
           u."name"         AS "name",
           u."phone"        AS "phone",
           u."workspaceId"  AS "workspaceId",
           w."name"         AS "workspaceName",
           w."plan"::text   AS "plan",
           COUNT(c."id")    AS "conversationCount",
           MAX(c."createdAt") AS "lastActivityAt"
    FROM "User" u
    JOIN "Workspace" w
      ON w."id" = u."workspaceId"
     AND w."excludeFromAdminReports" = false
    JOIN "Conversation" c
      ON c."workspaceId" = u."workspaceId"
     AND c."createdAt" >= ${since}
    GROUP BY u."id", u."name", u."phone", u."workspaceId", w."name", w."plan"
    ORDER BY "conversationCount" DESC, "lastActivityAt" DESC
    LIMIT ${limit}
  `
        return rows.map((r) => ({
                userId: r.userId,
                name: r.name,
                phone: r.phone,
                workspaceId: r.workspaceId,
                workspaceName: r.workspaceName,
                plan: r.plan,
                conversationCount: Number(r.conversationCount),
                lastActivityAt: r.lastActivityAt,
        }))
}
