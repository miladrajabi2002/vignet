import { prisma } from '@/lib/prisma'
import { awaitingHandlingWhere } from '@/lib/payments/card/fulfilment'
import { REQUEST_ACTION_STATUSES } from '@/lib/commerce/request-states'

export interface CommerceAttention {
  /** Paid orders waiting to be delivered (the gateway's «خرید موفق»). */
  orders: number
  /** Pre-orders waiting for the owner, and back-in-stock customers to call by hand. */
  requests: number
}

/**
 * What waits for the owner under «محصولات»: the counts on the Orders and
 * Requests tabs and, together, on the menu item. Payments a customer claims
 * are counted on «درگاه پرداخت» instead, so nothing is counted twice.
 * Never throws: a missing count is a zero, not a broken page.
 */
export async function loadCommerceAttention(workspaceId: string): Promise<CommerceAttention> {
  const [orders, drafts, followUps] = await Promise.all([
    prisma.cardPayment.count({ where: awaitingHandlingWhere(workspaceId) }).catch(() => 0),
    prisma.orderDraft.count({ where: { workspaceId, status: { in: [...REQUEST_ACTION_STATUSES] }, submittedAt: { not: null } } }).catch(() => 0),
    prisma.restockAlert.count({ where: { workspaceId, status: 'NEEDS_FOLLOW_UP' } }).catch(() => 0),
  ])
  return { orders, requests: drafts + followUps }
}
