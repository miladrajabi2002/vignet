import { prisma } from '@/lib/prisma'

export interface DailyPoint {
  day: string // Persian short label, e.g. ۰۶/۲۹
  value: number
}

/** A labeled monthly bucket for revenue/usage charts. */
export interface MonthPoint {
  month: string // Persian short month label, e.g. ۱۴۰۳/۰۷
  value: number
  raw?: string // ISO year-month key for sorting
}

function label(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { month: '2-digit', day: '2-digit' }).format(d)
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { year: '2-digit', month: '2-digit' }).format(d)
}

/** Turn sparse {date->value} rows into a continuous series over the last N days. */
function fillSeries(rows: { d: Date; v: number }[], days: number): DailyPoint[] {
  const byKey = new Map<string, number>()
  for (const r of rows) {
    const key = new Date(r.d).toISOString().slice(0, 10)
    byKey.set(key, r.v)
  }
  const out: DailyPoint[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
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
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c) })), days)
}

export async function errorsDaily(days = 14): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "ErrorLog"
    WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c) })), days)
}

export async function usageTokensDaily(days = 14): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "date") AS d,
           sum("promptTokens" + "completionTokens") AS c
    FROM "UsageLog"
    WHERE "date" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c ?? 0) })), days)
}

/** New user sign-ups per day. */
export async function newUsersDaily(days = 14): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "User"
    WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c) })), days)
}

/** New workspace registrations per day. */
export async function newWorkspacesDaily(days = 14): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Workspace"
    WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c) })), days)
}

/** Successful payments count per day. */
export async function paymentsDaily(days = 14): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "paidAt") AS d, count(*) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c) })), days)
}

// ─── REVENUE SERIES ───────────────────────────────────────────────
//
// Revenue is split by currency because ZarinPay charges in IRR and
// NowPayments charges in USD. We report each series separately so the
// admin always sees the true numbers without a flaky FX assumption.

/** Daily revenue in IRR (ZarinPay PAID payments). */
export async function revenueIRRDaily(days = 14): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.$queryRaw<{ d: Date; c: bigint }[]>`
    SELECT date_trunc('day', "paidAt") AS d, COALESCE(sum("amount"), 0) AS c
    FROM "Payment"
    WHERE "status" = 'PAID' AND "currency" = 'IRR' AND "paidAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
  return fillSeries(rows.map((r) => ({ d: r.d, v: Number(r.c ?? 0) })), days)
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
  return fillMonthly(rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })), months)
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
  return fillMonthly(rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })), months)
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
  return fillMonthly(rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })), months)
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
  return fillMonthly(rows.map((r) => ({ m: r.m, v: Number(r.c ?? 0) })), months)
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

/**
 * Daily conversation counts for the last 7 days, grouped by workspaceId.
 * Used to render inline sparklines on the users list without N+1 queries.
 * Only includes workspaces that had at least one conversation in the window.
 */
export async function conversationsDailyByWorkspace(days = 7): Promise<Map<string, WorkspaceSpark>> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.$queryRaw<{ workspaceId: string; d: Date; c: bigint }[]>`
    SELECT "workspaceId", date_trunc('day', "createdAt") AS d, count(*) AS c
    FROM "Conversation"
    WHERE "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

  const out = new Map<string, WorkspaceSpark>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const r of rows) {
    let entry = out.get(r.workspaceId)
    if (!entry) {
      entry = { workspaceId: r.workspaceId, series: new Array(days).fill(0), total: 0 }
      out.set(r.workspaceId, entry)
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
