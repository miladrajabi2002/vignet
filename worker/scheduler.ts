import { prisma } from '@/lib/prisma'
import { dispatchSummary } from '@/lib/queue/jobs'

/**
 * Lightweight in-process scheduler for the background worker. Uses plain
 * intervals (no extra cron dependency) to run periodic maintenance tasks.
 *
 * Currently:
 *  - Every hour, auto-resolve conversations that have been idle for over
 *    STALE_HOURS and enqueue a summary for each. This keeps the inbox tidy and
 *    populates conversation summaries without manual action.
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

/** Start periodic tasks. Returns a function that stops them. */
export function startScheduler(): () => void {
  console.log('[scheduler] started — hourly stale-conversation sweep')
  // Kick off shortly after boot, then hourly.
  const initial = setTimeout(runSweep, 30_000)
  const interval = setInterval(runSweep, HOUR_MS)
  return () => {
    clearTimeout(initial)
    clearInterval(interval)
  }
}
