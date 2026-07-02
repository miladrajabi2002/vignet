import { prisma } from '@/lib/prisma'
import { processIngestion } from '@/lib/knowledge/ingest'
import { parseUrl } from '@/lib/knowledge/parsers'

/**
 * URL crawler (F2). Two responsibilities:
 *   1. `crawlUrlToKnowledge` — re-fetch a single URL-type knowledge base,
 *      re-chunk + re-embed it, and stamp `lastIngestedAt`. Used both for
 *      manual refresh and the periodic sweep below.
 *   2. `refreshStaleUrlKnowledge` — find every URL knowledge base whose
 *      `refreshIntervalHours` has elapsed since its last ingestion and re-crawl
 *      each. Wired into the scheduler (`worker/scheduler.ts`) on an hourly tick.
 *
 * The crawl reuses `parseUrl` from `lib/knowledge/parsers` (which strips
 * scripts/styles and HTML tags, decodes entities) and `processIngestion` from
 * `lib/knowledge/ingest` (chunks + embeds + persists vectors). Each refresh is
 * wrapped in try/catch so one bad URL doesn't kill the sweep.
 */

/**
 * Re-fetch a URL knowledge base and re-ingest its content. The KB's
 * `sourceUrl` is updated to the supplied `url` (useful when the admin changes
 * the URL via the dashboard), then `processIngestion` runs — it in turn calls
 * `parseUrl` to fetch + strip the HTML. `lastIngestedAt` is stamped only on
 * success so a failed crawl is retried on the next sweep.
 *
 * Returns the new chunk count for caller convenience (e.g. display in UI).
 */
export async function crawlUrlToKnowledge(
	_workspaceId: string,
	_agentId: string,
	kbId: string,
	url: string,
): Promise<{ chunkCount: number }> {
	// Persist the (possibly new) source URL before ingesting so processIngestion
	// sees the up-to-date value when it resolves the URL text.
	await prisma.knowledgeBase.update({
		where: { id: kbId },
		data: { sourceUrl: url, status: 'PROCESSING', errorMsg: null },
	})

	// processIngestion resolves the URL text via parseUrl, chunks it, embeds
	// the chunks, and updates KB.status + KB.chunkCount.
	await processIngestion({ kbId })

	// Stamp the freshness marker. Do this after a successful ingest only.
	await prisma.knowledgeBase.update({
		where: { id: kbId },
		data: { lastIngestedAt: new Date() },
	})

	const kb = await prisma.knowledgeBase.findUnique({
		where: { id: kbId },
		select: { chunkCount: true },
	})
	return { chunkCount: kb?.chunkCount ?? 0 }
}

/**
 * Walk every URL knowledge base with a non-zero `refreshIntervalHours` and
 * re-crawl any whose `lastIngestedAt` is null or older than its interval.
 * Returns the number of KBs actually refreshed (skipped ones don't count).
 *
 * Called from `worker/scheduler.ts` on an hourly tick. Errors are logged and
 * swallowed per-KB so the sweep continues.
 */
export async function refreshStaleUrlKnowledge(): Promise<{ refreshed: number }> {
	const candidates = await prisma.knowledgeBase.findMany({
		where: {
			type: 'URL',
			refreshIntervalHours: { gt: 0 },
		},
		select: {
			id: true,
			workspaceId: true,
			agentId: true,
			sourceUrl: true,
			lastIngestedAt: true,
			refreshIntervalHours: true,
		},
		take: 500,
	})

	const now = Date.now()
	let refreshed = 0

	for (const kb of candidates) {
		if (!kb.sourceUrl) continue
		const staleMs = kb.refreshIntervalHours * 60 * 60 * 1000
		const lastMs = kb.lastIngestedAt ? kb.lastIngestedAt.getTime() : 0
		if (lastMs > 0 && now - lastMs < staleMs) continue // not stale yet

		try {
			await crawlUrlToKnowledge(kb.workspaceId, kb.agentId, kb.id, kb.sourceUrl)
			refreshed++
		} catch (e) {
			console.error(
				`[crawler] refresh failed for KB ${kb.id} (${kb.sourceUrl}):`,
				e instanceof Error ? e.message : e,
			)
		}
	}

	if (refreshed > 0) {
		console.log(`[crawler] refreshed ${refreshed} stale URL knowledge base(s)`)
	}
	return { refreshed }
}

/**
 * Convenience helper for one-off crawls of an arbitrary URL (e.g. a CUSTOM_URL
 * store integration that we want to surface as a knowledge base). Fetches the
 * URL text via `parseUrl` and returns it; the caller decides what to do with
 * it (e.g. feed it into a knowledge base or product catalog).
 */
export async function fetchUrlText(url: string): Promise<string> {
	return parseUrl(url)
}
