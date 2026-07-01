/**
 * Lightweight Redis-backed caches for hot reads.
 *
 * Architecture
 * ────────────
 * Vigent uses Postgres as the source of truth and Redis (ioredis) for:
 *   1. OTP storage (auth)
 *   2. Rate-limit counters (lib/ratelimit.ts)
 *   3. BullMQ job queue (lib/queue/)
 *   4. **Embedding cache** (lib/ai/embeddings.ts, 7-day TTL) — query embeddings
 *      are deterministic per (model, text) and re-asked a lot, so caching them
 *      cuts both cost and latency.
 *
 * The caches below extend (4) to other read-heavy paths.
 *
 * All caches are best-effort: on Redis failure, callers fall through to the
 * DB. They never *block* a request — only speed it up.
 */

import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { normalizeWidgetSettings, type WidgetSettings } from '@/lib/widget/config'

/** TTL: widget config is small + read on every chat message; cache 60s. */
const WIDGET_CONFIG_TTL = 60 // seconds

interface CachedWidgetPayload {
	agent: {
		id: string
		name: string
		welcomeMessage: string | null
		language: string
		avatar: string | null
		active: boolean
	}
	settings: WidgetSettings
}

function widgetCacheKey(agentId: string): string {
	return `widget:cfg:${agentId}`
}

/**
 * Get a public widget config (agent + appearance) for `agentId`.
 *
 * Hit path: 1 Redis GET (~1ms).
 * Miss path: 1 Prisma findUnique + 1 channel lookup (~10–30ms) + write-back.
 *
 * Invalidation: callers should `invalidateWidgetConfig(agentId)` after a save.
 */
export async function getCachedWidgetConfig(
	agentId: string,
): Promise<CachedWidgetPayload | null> {
	const redis = getRedis()
	const key = widgetCacheKey(agentId)
	try {
		const raw = await redis.get(key)
		if (raw) {
			const parsed = JSON.parse(raw) as CachedWidgetPayload
			if (parsed && parsed.agent && parsed.settings) return parsed
		}
	} catch {
		// fall through to DB
	}

	// Cache miss → DB.
	const agent = await prisma.agent.findUnique({
		where: { id: agentId },
		select: {
			id: true,
			name: true,
			welcomeMessage: true,
			language: true,
			avatar: true,
			active: true,
			channels: {
				where: { type: 'WEB_WIDGET' },
				select: { config: true },
				take: 1,
			},
		},
	})
	if (!agent || !agent.active) return null

	const settings = normalizeWidgetSettings(agent.channels[0]?.config)
	const payload: CachedWidgetPayload = { agent, settings }

	// Write-back (fire-and-forget).
	try {
		void redis.set(key, JSON.stringify(payload), 'EX', WIDGET_CONFIG_TTL)
	} catch {
		// ignore
	}

	return payload
}

/** Invalidate the widget-config cache after a settings change. */
export async function invalidateWidgetConfig(agentId: string): Promise<void> {
	try {
		await getRedis().del(widgetCacheKey(agentId))
	} catch {
		// ignore — cache will expire naturally in 60s
	}
}
