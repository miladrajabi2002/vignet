/**
 * A reply that promises a person will follow up («همکارم تماس می‌گیرد»,
 * «برای کارشناس فرستادم») is a commitment the system must keep.
 *
 * The reply model declares it in the hidden status line (f=y, see
 * lib/ai/turn-signal.ts); this files the request for the owner as a handoff
 * alert WITHOUT taking the thread away from the assistant. Before this, such
 * promises were only caught by a regex that missed most wordings, and in the
 * week to 2026-10-23 28% of real conversations carried a promise that nothing
 * stood behind.
 */
import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notifyHandoff } from '@/lib/ai/handoff'

/** One open follow-up per conversation and day is enough for the owner. */
const DEDUPE_MS = 24 * 60 * 60_000

export async function fileFollowUpRequest(params: {
  workspaceId: string
  conversationId: string
  agentId: string
  channel: ChannelType
  contactId: string | null
  contactName: string | null
  contactPhone: string | null
  customerMessage: string
}): Promise<'filed' | 'already_open' | 'failed'> {
  try {
    const open = await prisma.handoffAlert.findFirst({
      where: {
        conversationId: params.conversationId,
        state: 'open',
        createdAt: { gte: new Date(Date.now() - DEDUPE_MS) },
      },
      select: { id: true },
    })
    if (open) return 'already_open'
    const agent = await prisma.agent.findUnique({ where: { id: params.agentId }, select: { name: true } })
    const alertId = await notifyHandoff({
      workspaceId: params.workspaceId,
      conversationId: params.conversationId,
      agentId: params.agentId,
      agentName: agent?.name ?? 'ایجنت',
      channel: params.channel,
      contactId: params.contactId,
      contactName: params.contactName,
      contactPhone: params.contactPhone,
      reason: `ایجنت به مشتری قول پیگیری همکار داد: «${params.customerMessage.replace(/\s+/g, ' ').slice(0, 160)}»`,
    })
    if (alertId) return 'filed'
    // A dashboard test chat never queues a real alert; the promise is still honest there.
    const playground = await prisma.conversation.count({ where: { id: params.conversationId, isPlayground: true } })
    return playground > 0 ? 'filed' : 'failed'
  } catch (error) {
    console.error('[follow-up] filing failed:', error)
    return 'failed'
  }
}
