import { prisma } from '@/lib/prisma'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'

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
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(rows.map((row) => ({ d: row.d, v: Number(row.c) })), days)
}

export async function usageTokensDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           sum("promptTokens" + "completionTokens") AS c
    FROM "UsageLog"
    WHERE "date" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c ?? 0) })),
                days,
        )
}

export async function usageChargesDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           COALESCE(sum("chargedIRR"), 0) AS c
    FROM "UsageLog"
    WHERE "date" >= ${since} AND "status" = 'CAPTURED'
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
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

/** New workspace registrations per day. */
export async function newWorkspacesDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Workspace"
    WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
        return fillSeries(
                rows.map((r) => ({ d: r.d, v: Number(r.c) })),
                days,
        )
}

/** Successful payments count per day. */
export async function paymentsDaily(days = 14): Promise<DailyPoint[]> {
        const since = new Date(Date.now() - days * 86400000)
        const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "paidAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" >= ${since}
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
    GROUP BY 1 ORDER BY 1
  `
        return fillMonthly(
                rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })),
                months,
        )
}

/** Monthly revenue in USD over the last N months. */
export async function revenueUSDMonthly(months = 12): Promise<MonthPoint[]> {
        const since = new Date()
        since.setMonth(since.getMonth() - (months - 1))
        since.setDate(1)
        since.setHours(0, 0, 0, 0)
        const rows = await prisma.$queryRaw<{ m: string; c: bigint }[]>`
    SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS m,
           COALESCE(sum("amount"), 0) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "currency" = 'USD' AND "paidAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
        return fillMonthly(
                rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })),
                months,
        )
}

/** Count of successful payments per month over the last N months. */
export async function paymentsMonthly(months = 12): Promise<MonthPoint[]> {
        const since = new Date()
        since.setMonth(since.getMonth() - (months - 1))
        since.setDate(1)
        since.setHours(0, 0, 0, 0)
        const rows = await prisma.$queryRaw<{ m: string; c: bigint }[]>`
    SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS m, count(*) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
        return fillMonthly(
                rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })),
                months,
        )
}

/** New user sign-ups per month. */
export async function newUsersMonthly(months = 12): Promise<MonthPoint[]> {
        const since = new Date()
        since.setMonth(since.getMonth() - (months - 1))
        since.setDate(1)
        since.setHours(0, 0, 0, 0)
        const rows = await prisma.$queryRaw<{ m: string; c: bigint }[]>`
    SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS m, count(*) AS c
    FROM "User"
    WHERE "createdAt" >= ${since}
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

/** Successful payments grouped by gateway. */
export async function gatewayBreakdown(): Promise<Slice[]> {
        const rows = await prisma.payment.groupBy({
                by: ['gateway'],
                where: { status: 'PAID' },
                _count: { _all: true },
        })
        const labels: Record<string, string> = {
                ZARINPAY: 'زرین‌پال',
                NOWPAYMENTS: 'کریپتو (NowPayments)',
        }
        return rows.map((r) => ({
                key: r.gateway,
                label: labels[r.gateway] ?? r.gateway,
                value: r._count._all,
        }))
}

/** Conversations grouped by channel. */
export async function channelBreakdown(): Promise<Slice[]> {
        const rows = await prisma.conversation.groupBy({
                by: ['channel'],
                _count: { _all: true },
        })
        const labels: Record<string, string> = {
                TELEGRAM: 'تلگرام',
                WHATSAPP: 'واتساپ',
                INSTAGRAM: 'اینستاگرام',
                RUBIKA: 'روبیکا',
                BALE: 'بله',
                WEB_WIDGET: 'ویجت وب',
                API: 'API',
                CHAT_LINK: 'لینک چت',
        }
        return rows.map((r) => ({
                key: r.channel,
                label: labels[r.channel] ?? r.channel,
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

// ─── CONVERSATION SPARKLINE (by channel) ───────────────────────────

export interface ChannelSpark {
        channel: string
        series: number[]
        total: number
}

/**
 * Daily conversation counts for the last N days, grouped by channel.
 * Used for inline sparklines on the conversations page.
 */
export async function conversationsDailyByChannel(
        days = 7,
): Promise<Map<string, ChannelSpark>> {
        const since = new Date(Date.now() - days * 86_400_000)
        const rows = await prisma.$queryRaw<{ channel: string; d: string; c: bigint }[]>`
    SELECT "channel",
           to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           count(*) AS c
    FROM "Conversation"
    WHERE "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

        const out = new Map<string, ChannelSpark>()
        const now = Date.now()
        const dayKeys: string[] = []
        for (let i = days - 1; i >= 0; i--) {
                dayKeys.push(tzDayKey(new Date(now - i * 86_400_000)))
        }
        for (const r of rows) {
                let entry = out.get(r.channel)
                if (!entry) {
                        entry = { channel: r.channel, series: new Array(days).fill(0), total: 0 }
                        out.set(r.channel, entry)
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
