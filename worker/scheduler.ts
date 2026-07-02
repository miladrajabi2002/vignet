import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dispatchSummary } from '@/lib/queue/jobs'
import { MESSENGER_TYPES } from '@/lib/channels/registry'
import { notifyWorkspace } from '@/lib/notifications/create'
import {
	syncWooOrders,
	syncWooProducts,
	resolveWooCredentials,
	type StoreIntegrationInput,
} from '@/lib/integrations/woocommerce'
import { refreshStaleUrlKnowledge } from '@/lib/integrations/crawler'

/**
 * Lightweight in-process scheduler for the background worker. Uses plain
 * intervals (no extra cron dependency) to run periodic maintenance tasks.
 *
 * Currently:
 *  - Every hour, auto-resolve conversations that have been idle for over
 *    STALE_HOURS and enqueue a summary for each. This keeps the inbox tidy and
 *    populates conversation summaries without manual action.
 *  - Every 6 hours, alert workspaces whose active messenger channels have
 *    gone silent (suspected revoked token).
 *  - Every 10 minutes, poll active store integrations whose pollInterval has
 *    elapsed and re-sync their products/orders (F2).
 *  - Every hour, re-crawl stale URL knowledge bases whose refreshInterval has
 *    elapsed (F2/F4).
 */

const HOUR_MS = 60 * 60 * 1000
const STALE_HOURS = 24
const BATCH = 100

async function sweepStaleConversations(): Promise<void> {
	const cutoff = new Date(Date.now() - STALE_HOURS * HOUR_MS)
	const stale = await prisma.conversation.findMany({
		where: {
			status: 'OPEN',
			lastMessageAt: { lt: cutoff },
			messageCount: { gt: 0 },
		},
		select: { id: true },
		take: BATCH,
	})
	if (!stale.length) return

	const ids = stale.map((c) => c.id)
	await prisma.conversation.updateMany({
		where: { id: { in: ids } },
		data: { status: 'RESOLVED' },
	})
	for (const id of ids) {
		await dispatchSummary({ conversationId: id })
	}
	console.log(`[scheduler] auto-resolved ${ids.length} stale conversation(s)`)
}

async function runSweep(): Promise<void> {
	try {
		await sweepStaleConversations()
	} catch (e) {
		console.error('[scheduler] sweep failed:', e)
	}
}

const CHANNEL_CHECK_MS = 6 * HOUR_MS
const CHANNEL_SILENT_MS = 3 * 24 * HOUR_MS // a connected channel silent >3d is suspect

/**
 * Alert workspaces whose active messenger channels have gone silent (no inbound
 * message for over CHANNEL_SILENT_MS) — usually a revoked/expired bot token.
 * Deduped via healthAlertedAt so each silence episode alerts at most once.
 */
async function alertSilentChannels(): Promise<void> {
	const cutoff = new Date(Date.now() - CHANNEL_SILENT_MS)
	const channels = await prisma.agentChannel.findMany({
		where: { active: true, type: { in: [...MESSENGER_TYPES] as ChannelType[] } },
		select: {
			id: true,
			type: true,
			lastInboundAt: true,
			healthAlertedAt: true,
			createdAt: true,
			agent: { select: { name: true, workspaceId: true } },
		},
		take: 500,
	})

	for (const ch of channels) {
		const lastActivity = ch.lastInboundAt ?? ch.createdAt
		if (lastActivity >= cutoff) continue
		// Only alert once per silence episode (not already alerted since last activity).
		if (ch.healthAlertedAt && ch.healthAlertedAt >= lastActivity) continue

		await notifyWorkspace({
			workspaceId: ch.agent.workspaceId,
			type: 'CHANNEL_DOWN',
			title: `اتصال ${ch.type} قطع به نظر می‌رسد`,
			body: `کانال «${ch.agent.name}» بیش از ۳ روز پیامی دریافت نکرده است. ممکن است توکن منقضی شده باشد.`,
			link: '/integrations',
			sms: true,
			opsEmail: true,
		})
		await prisma.agentChannel.update({
			where: { id: ch.id },
			data: { healthAlertedAt: new Date() },
		})
	}
}

async function runChannelCheck(): Promise<void> {
	try {
		await alertSilentChannels()
	} catch (e) {
		console.error('[scheduler] channel-health check failed:', e)
	}
}

// ─── store integration polling (F2) ─────────────────────────────────────────

const STORE_SYNC_INTERVAL_MS = 10 * 60 * 1000 // every 10 minutes

/**
 * Find every active store integration whose `pollIntervalMinutes` has elapsed
 * since `lastSyncAt` and re-sync its products + orders. For non-WooCommerce
 * types (CUSTOM_URL) the polling path is a no-op — those are handled by the
 * URL crawler instead. Per-integration errors are caught and logged so a
 * single failing store doesn't block the rest.
 */
async function syncStoreIntegrations(): Promise<void> {
	const now = Date.now()
	const rows = await prisma.storeIntegration.findMany({
		where: { active: true, pollIntervalMinutes: { gt: 0 } },
		select: {
			id: true,
			workspaceId: true,
			storeUrl: true,
			credentials: true,
			type: true,
			pollIntervalMinutes: true,
			lastSyncAt: true,
		},
		take: 100,
	})

	for (const row of rows) {
		if (row.type !== 'WOOCOMMERCE') continue
		const lastMs = row.lastSyncAt ? row.lastSyncAt.getTime() : 0
		const elapsed = now - lastMs
		if (elapsed < row.pollIntervalMinutes * 60 * 1000) continue

		let credentials
		try {
			credentials = resolveWooCredentials(row.credentials)
		} catch (e) {
			console.error(
				`[scheduler] store ${row.id} credential resolve failed:`,
				e instanceof Error ? e.message : e,
			)
			continue
		}

		const integration: StoreIntegrationInput = {
			id: row.id,
			workspaceId: row.workspaceId,
			storeUrl: row.storeUrl,
			credentials,
		}

		try {
			const products = await syncWooProducts(integration)
			const orders = await syncWooOrders(integration, { sinceDays: 30 })
			console.log(
				`[scheduler] store ${row.id} synced: ${products.count} products, ${orders.count} orders`,
			)
		} catch (e) {
			console.error(
				`[scheduler] store ${row.id} sync failed:`,
				e instanceof Error ? e.message : e,
			)
		}
	}
}

async function runStoreSync(): Promise<void> {
	try {
		await syncStoreIntegrations()
	} catch (e) {
		console.error('[scheduler] store-sync failed:', e)
	}
}

// ─── stale URL knowledge refresh (F2/F4) ────────────────────────────────────

async function runKnowledgeRefresh(): Promise<void> {
	try {
		const { refreshed } = await refreshStaleUrlKnowledge()
		if (refreshed > 0) {
			console.log(`[scheduler] refreshed ${refreshed} stale URL knowledge base(s)`)
		}
	} catch (e) {
		console.error('[scheduler] knowledge refresh failed:', e)
	}
}

// ─── scheduler entry point ──────────────────────────────────────────────────

/** Start periodic tasks. Returns a function that stops them. */
export function startScheduler(): () => void {
	console.log(
		'[scheduler] started — hourly stale-conversation sweep + 6h channel-health check + 10m store sync + 1h knowledge refresh',
	)
	// Kick off shortly after boot, then on their own cadences.
	const initialSweep = setTimeout(runSweep, 30_000)
	const sweepInterval = setInterval(runSweep, HOUR_MS)

	const initialChannel = setTimeout(runChannelCheck, 60_000)
	const channelInterval = setInterval(runChannelCheck, CHANNEL_CHECK_MS)

	const initialStore = setTimeout(runStoreSync, 60_000)
	const storeInterval = setInterval(runStoreSync, STORE_SYNC_INTERVAL_MS)

	const initialKnowledge = setTimeout(runKnowledgeRefresh, 2 * 60_000)
	const knowledgeInterval = setInterval(runKnowledgeRefresh, HOUR_MS)

	return () => {
		clearTimeout(initialSweep)
		clearInterval(sweepInterval)
		clearTimeout(initialChannel)
		clearInterval(channelInterval)
		clearTimeout(initialStore)
		clearInterval(storeInterval)
		clearTimeout(initialKnowledge)
		clearInterval(knowledgeInterval)
	}
}
