import { prisma } from '@/lib/prisma'

/**
 * Per-workspace daily series helpers for the USER dashboard.
 * All functions return a 7-element array (oldest → newest) of daily counts,
 * aligned to the Asia/Tehran day boundary, so they can be fed directly into
 * Sparkline / MiniTrend components without N+1 queries.
 *
 * These mirror lib/admin/charts.ts but are scoped to a single workspace,
 * so the user dashboard only sees its own data.
 *
 * ── Timezone correctness ──
 * Previously the SQL grouped by `date_trunc('day', "createdAt")` (UTC) while
 * the JS built day keys with `setHours(0,0,0,0)` (server-local). In Iran
 * (UTC+3:30) this caused an off-by-one-day drift: a contact created "today"
 * at 14:00 Tehran (= 10:30 UTC) was bucketed to today in the SQL, but the
 * JS loop's "today" key resolved to *yesterday's* UTC date, so the lookup
 * missed and the count stayed 0.
 *
 * Now both sides use the same Asia/Tehran day boundary:
 *  • SQL: `date_trunc('day', <ts> AT TIME ZONE 'Asia/Tehran')` then
 *    `to_char(..., 'YYYY-MM-DD')` → a stable string key.
 *  • JS:  `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' })`.
 */

export interface DailySeries {
	/** 7 daily counts, oldest → newest. */
	series: number[]
	/** Sum of the series. */
	total: number
}

/** Timezone used for day-boundary alignment. Defaults to Iran. */
const DASHBOARD_TZ = process.env.DASHBOARD_TZ || 'Asia/Tehran'

/** Format a Date as YYYY-MM-DD in Asia/Tehran (or the configured DASHBOARD_TZ). */
function tzDayKey(d: Date): string {
	try {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: DASHBOARD_TZ,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(d)
	} catch {
		// Fallback if the runtime doesn't recognise the timezone — use UTC.
		return d.toISOString().slice(0, 10)
	}
}

/**
 * Build a DailySeries from rows that already carry a pre-formatted
 * `YYYY-MM-DD` day key (produced by the SQL `to_char(... AT TIME ZONE ...)`).
 */
function buildSeries(rows: { d: string; c: bigint }[], days: number): DailySeries {
	const byKey = new Map<string, number>()
	for (const r of rows) {
		byKey.set(r.d, (byKey.get(r.d) ?? 0) + Number(r.c))
	}
	const series: number[] = []
	const now = Date.now()
	let total = 0
	for (let i = days - 1; i >= 0; i--) {
		const key = tzDayKey(new Date(now - i * 86_400_000))
		const v = byKey.get(key) ?? 0
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1
  `
	return buildSeries(rows, days)
}

/** Daily successful AI charges in Iranian rials for a workspace. */
export async function chargesDailyByWorkspace(
	workspaceId: string,
	days = 7,
): Promise<DailySeries> {
	const since = new Date(Date.now() - days * 86_400_000)
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           COALESCE(sum("chargedIRR"), 0) AS c
    FROM "UsageLog"
    WHERE "workspaceId" = ${workspaceId} AND "date" >= ${since} AND "status" = 'CAPTURED'
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Product"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "status" = 'RESOLVED' AND "createdAt" >= ${since}
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
	const rows = await prisma.$queryRaw<{ agentId: string; d: string; c: bigint }[]>`
    SELECT "agentId",
           to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
           count(*) AS c
    FROM "Conversation"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

	const out = new Map<string, DailySeries>()
	const now = Date.now()
	// Pre-compute the list of day keys (oldest → newest) for the window.
	const dayKeys: string[] = []
	for (let i = days - 1; i >= 0; i--) {
		dayKeys.push(tzDayKey(new Date(now - i * 86_400_000)))
	}
	for (const r of rows) {
		let entry = out.get(r.agentId)
		if (!entry) {
			entry = { series: new Array(days).fill(0), total: 0 }
			out.set(r.agentId, entry)
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
