/**
 * Order status updates in chat (agent.orderUpdatesEnabled).
 *
 * When the agent shows a customer a verified order, that conversation starts
 * following it (OrderWatch). Each later change the store reports — a new
 * status or a tracking code — is sent once, in the same conversation, through
 * the same delivery path as checkout notices. Following is keyed by
 * conversation, not phone, so an order placed with another number still
 * reaches the person who asked about it; one conversation can follow several
 * orders.
 *
 * Every entry point swallows its own errors: an update that cannot be sent
 * must never fail a store webhook or a customer's turn.
 */
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { synthesizeTrackingLink } from '@/lib/ai/order-context'
import { deliverAssistantNotice, lastCustomerLang } from '@/lib/commerce/checkout-service'
import {
  composeOrderUpdate,
  normalizeStatus,
  orderChange,
  TERMINAL_STATUSES,
  type UpdateLang,
} from '@/lib/commerce/order-updates-text'

/** A conversation follows an order this long after it last asked. */
export const FOLLOW_DAYS = 30
const DAY_MS = 86_400_000
/* Instagram and WhatsApp only accept business messages within 24h of the
   customer's last message; later updates wait for the next customer turn. */
const WINDOWED = new Set(['INSTAGRAM', 'WHATSAPP'])
const WINDOW_MS = 23 * 3_600_000

/* Before the migration ships, the generated client has no OrderWatch model:
   every entry point is then a silent no-op instead of an error per order. */
function ready(): boolean {
  return Boolean((prisma as unknown as { orderWatch?: unknown }).orderWatch)
}

/** The agent's switch, read so a database without the column reads as off. */
async function orderUpdatesOn(agentId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ orderUpdatesEnabled: boolean; active: boolean }>>`
      SELECT "orderUpdatesEnabled", "active" FROM "Agent" WHERE id = ${agentId}`
    return rows[0]?.orderUpdatesEnabled === true && rows[0]?.active === true
  } catch {
    return false
  }
}

/** Start (or refresh) following an order the agent just showed the customer. */
export async function followOrder(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  integrationId: string
  externalOrderId: string
  status: string
  trackingCode: string | null
}): Promise<boolean> {
  if (!ready()) return false
  try {
    const expiresAt = new Date(Date.now() + FOLLOW_DAYS * DAY_MS)
    // The customer has just seen the current state: only later changes count.
    const seen = { notifiedStatus: normalizeStatus(params.status), notifiedTracking: params.trackingCode?.trim() || null, expiresAt }
    await prisma.orderWatch.upsert({
      where: {
        conversationId_integrationId_externalOrderId: {
          conversationId: params.conversationId,
          integrationId: params.integrationId,
          externalOrderId: params.externalOrderId,
        },
      },
      update: seen,
      create: {
        workspaceId: params.workspaceId,
        agentId: params.agentId,
        conversationId: params.conversationId,
        integrationId: params.integrationId,
        externalOrderId: params.externalOrderId,
        ...seen,
      },
    })
    return true
  } catch (error) {
    captureError('order-updates:follow', error, { workspaceId: params.workspaceId })
    return false
  }
}

/**
 * Called after the store mirror of an order changed (webhook or poll).
 * Cheap when nobody follows the order: one indexed lookup.
 */
export async function notifyOrderWatchers(integrationId: string, externalOrderId: string, now = new Date()): Promise<number> {
  if (!ready()) return 0
  try {
    const watches = await prisma.orderWatch.findMany({
      where: { integrationId, externalOrderId, expiresAt: { gt: now } },
      take: 5,
    })
    if (!watches.length) return 0
    const order = await prisma.storeOrder.findUnique({
      where: { integrationId_externalOrderId: { integrationId, externalOrderId } },
      select: { externalOrderId: true, status: true, trackingCode: true, courierName: true, trackingLink: true },
    })
    if (!order) return 0

    let sent = 0
    for (const watch of watches) {
      const change = orderChange(watch, order)
      if (!change) continue
      if (!(await orderUpdatesOn(watch.agentId))) continue
      const conversation = await prisma.conversation.findUnique({
        where: { id: watch.conversationId },
        select: { id: true, agentId: true, channel: true, externalId: true, deletedAt: true },
      })
      if (!conversation || conversation.deletedAt) continue
      if (WINDOWED.has(conversation.channel)) {
        const lastCustomer = await prisma.message.findFirst({
          where: { conversationId: conversation.id, role: 'USER' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
        if (!lastCustomer || now.getTime() - lastCustomer.createdAt.getTime() > WINDOW_MS) continue
      }

      const status = normalizeStatus(order.status)
      const tracking = order.trackingCode?.trim() || null
      // Claim first, so a duplicate webhook or a parallel poll never sends twice.
      const claimed = await prisma.orderWatch.updateMany({
        where: { id: watch.id, notifiedStatus: watch.notifiedStatus, notifiedTracking: watch.notifiedTracking },
        data: {
          notifiedStatus: status,
          notifiedTracking: tracking,
          // Nothing follows a cancelled/refunded order; a tracking code is the
          // last useful news for a shipped one.
          ...(TERMINAL_STATUSES.has(status) || (tracking && status === 'completed') ? { expiresAt: now } : {}),
        },
      })
      if (!claimed.count) continue

      const lang: UpdateLang = await lastCustomerLang(conversation.id).catch((): UpdateLang => 'fa')
      const link = order.trackingLink || synthesizeTrackingLink(order.trackingCode, order.courierName)
      const text = composeOrderUpdate(order, change, lang, link)
      if (!text) continue
      const result = await deliverAssistantNotice(conversation, text, { orderUpdate: true, externalOrderId, status })
      if (result !== 'failed') sent += 1
    }
    return sent
  } catch (error) {
    captureError('order-updates:notify', error, { metadata: { integrationId, externalOrderId } })
    return 0
  }
}

/**
 * A cart paid through the in-chat payment link: follow its store order so
 * the buyer hears when it ships.
 */
export async function followPaidCheckout(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  integrationId: string
  externalOrderId: string
  status: string
}): Promise<void> {
  if (!ready() || !(await orderUpdatesOn(params.agentId))) return
  await followOrder({ ...params, trackingCode: null })
}

/** Housekeeping: drop follows that ended (worker sweep). */
export async function purgeExpiredOrderWatches(now = new Date()): Promise<number> {
  if (!ready()) return 0
  try {
    const removed = await prisma.orderWatch.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY_MS) } } })
    return removed.count
  } catch (error) {
    captureError('order-updates:purge', error)
    return 0
  }
}
