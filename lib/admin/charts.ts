import { prisma } from '@/lib/prisma'

export interface DailyPoint {
  day: string // Persian short label, e.g. ۰۶/۲۹
  value: number
}

function label(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { month: '2-digit', day: '2-digit' }).format(d)
}

/** Turn sparse {date->value} rows into a continuous series over the last N days. */
function fillSeries(
  rows: { d: Date; v: number }[],
  days: number,
): DailyPoint[] {
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
