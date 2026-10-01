/**
 * A proactive message to a customer in an existing conversation (booking
 * reminder, a freed course seat…), through the same delivery path as order
 * and checkout notices. Instagram and WhatsApp only accept business messages
 * within 24 hours of the customer's last message; outside that window the
 * notice is not sent and the caller learns why.
 */
import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deliverAssistantNotice, lastCustomerLang } from '@/lib/commerce/checkout-service'

const WINDOWED = new Set<ChannelType>(['INSTAGRAM', 'WHATSAPP'])
const WINDOW_MS = 23 * 3_600_000

export type CustomerNoticeResult = 'sent' | 'stored' | 'skipped_window' | 'no_conversation' | 'failed'

export interface NoticeTarget {
  id: string
  agentId: string
  channel: ChannelType
  externalId: string | null
}

export async function findNoticeTarget(workspaceId: string, conversationId: string | null | undefined): Promise<NoticeTarget | null> {
  if (!conversationId) return null
  return prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId, deletedAt: null },
    select: { id: true, agentId: true, channel: true, externalId: true },
  })
}

/** The contact's most recent conversation, for records made outside a chat. */
export async function latestContactConversation(workspaceId: string, contactId: string | null | undefined): Promise<NoticeTarget | null> {
  if (!contactId) return null
  return prisma.conversation.findFirst({
    where: { workspaceId, contactId, deletedAt: null },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, agentId: true, channel: true, externalId: true },
  })
}

export async function withinMessagingWindow(target: NoticeTarget, now = new Date()): Promise<boolean> {
  if (!WINDOWED.has(target.channel)) return true
  const lastCustomer = await prisma.message.findFirst({
    where: { conversationId: target.id, role: 'USER' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return Boolean(lastCustomer && now.getTime() - lastCustomer.createdAt.getTime() <= WINDOW_MS)
}

/**
 * Compose in the customer's language and send. `compose` gets the language
 * of their last message ('fa' when unknown).
 */
export async function sendCustomerNotice(
  target: NoticeTarget | null,
  compose: (lang: 'fa' | 'en') => string,
  metadata: Record<string, unknown>,
  now = new Date(),
): Promise<CustomerNoticeResult> {
  if (!target) return 'no_conversation'
  if (!(await withinMessagingWindow(target, now))) return 'skipped_window'
  const lang = await lastCustomerLang(target.id).catch((): 'fa' | 'en' => 'fa')
  return deliverAssistantNotice(target, compose(lang), metadata)
}
