import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dispatchSummary } from '@/lib/queue/jobs'
import { MESSENGER_TYPES } from '@/lib/channels/registry'
import { notifyWorkspace } from '@/lib/notifications/create'

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

/** Start periodic tasks. Returns a function that stops them. */
export function startScheduler(): () => void {
  console.log(
    '[scheduler] started — hourly stale-conversation sweep + 6h channel-health check',
  )
  // Kick off shortly after boot, then on their own cadences.
  const initialSweep = setTimeout(runSweep, 30_000)
  const sweepInterval = setInterval(runSweep, HOUR_MS)

  const initialChannel = setTimeout(runChannelCheck, 60_000)
  const channelInterval = setInterval(runChannelCheck, CHANNEL_CHECK_MS)

  return () => {
    clearTimeout(initialSweep)
    clearInterval(sweepInterval)
    clearTimeout(initialChannel)
    clearInterval(channelInterval)
  }
}
