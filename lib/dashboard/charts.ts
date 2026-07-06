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

/** Daily new messages (all roles) for a workspace. */
export async function messagesDailyByWorkspace(
	workspaceId: string,
	days = 7,
): Promise<DailySeries> {
	const since = new Date(Date.now() - days * 86_400_000)
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', m."createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "date" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d,
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

/** Daily handoffs (conversations escalated to human operator). */
export async function handoffsDailyByWorkspace(
	workspaceId: string,
	days = 7,
): Promise<DailySeries> {
	const since = new Date(Date.now() - days * 86_400_000)
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
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
	const rows = await prisma.$queryRaw<{ d: string; c: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
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
		prisma.$queryRaw<{ d: string; c: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${DASHBOARD_TZ}), 'YYYY-MM-DD') AS d, count(*) AS c
      FROM "Conversation"
      WHERE "workspaceId" = ${workspaceId}
        AND "status" = 'RESOLVED'
        AND "handedOff" = false
        AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
	])

	// Build the 7-day series (timezone-aware).
	const byKey = new Map<string, number>()
	for (const r of dailyRows) {
		byKey.set(r.d, (byKey.get(r.d) ?? 0) + Number(r.c))
	}
	const series: number[] = []
	const now = Date.now()
	for (let i = days - 1; i >= 0; i--) {
		const key = tzDayKey(new Date(now - i * 86_400_000))
		series.push(byKey.get(key) ?? 0)
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
