/**
 * After the money: a paid order is the owner's to deliver (send the goods,
 * start the service). Until they mark it handled its conversation carries a
 * «خرید موفق» flag in the inbox, and the buyer is filed in the customers
 * list as a customer with what they bought.
 */
import type { CardPayment, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { readPayItems, type PayItem } from '@/lib/payments/card/items'
import { contactPhoneLookupVariants as phoneVariants } from '@/lib/phone'

/** Paid orders the owner has not handled yet (setup test transfers aside). */
export function awaitingHandlingWhere(workspaceId: string): Prisma.CardPaymentWhereInput {
  return { workspaceId, status: 'PAID', purpose: 'ORDER', handledAt: null, NOT: { reference: { startsWith: 'TEST-' } } }
}

/** Conversations with a paid order waiting for the owner, newest payment first. */
export async function conversationsAwaitingHandling(workspaceId: string, take = 500): Promise<string[]> {
  const rows = await prisma.cardPayment.findMany({
    where: { ...awaitingHandlingWhere(workspaceId), conversationId: { not: null } },
    orderBy: { paidAt: 'desc' },
    distinct: ['conversationId'],
    take,
    select: { conversationId: true },
  }).catch(() => [])
  return rows.flatMap((row) => (row.conversationId ? [row.conversationId] : []))
}

/** The owner delivered a paid order (or takes that back). False when it is not a paid order of theirs. */
export async function setPaymentHandled(workspaceId: string, paymentId: string, handled: boolean, now = new Date()): Promise<boolean> {
  const changed = await prisma.cardPayment.updateMany({
    where: { id: paymentId, workspaceId, status: 'PAID' },
    data: { handledAt: handled ? now : null },
  })
  return changed.count > 0
}

/**
 * The buyer of a confirmed payment becomes a customer: filed under the name
 * and number they gave (a new profile when the chat had none), moved to the
 * «مشتری» stage, and the conversation's sales reading says «خرید کرده»
 * instead of a probability. Best-effort: a failure here never undoes the payment.
 */
export async function recordPaidCustomer(payment: CardPayment): Promise<void> {
  try {
    const draft = payment.orderDraftId
      ? await prisma.orderDraft.findUnique({
          where: { id: payment.orderDraftId },
          select: { contactId: true, customerName: true, customerPhone: true, city: true, address: true, postalCode: true, province: true },
        })
      : null
    const conversation = payment.conversationId
      ? await prisma.conversation.findFirst({ where: { id: payment.conversationId, workspaceId: payment.workspaceId }, select: { id: true, contactId: true } })
      : null
    const name = payment.customerName ?? draft?.customerName ?? null
    const phone = payment.customerPhone ?? draft?.customerPhone ?? null

    let contactId = conversation?.contactId ?? draft?.contactId ?? null
    if (conversation) {
      const { recordConfirmedCustomer } = await import('@/lib/crm/confirmed-customer')
      const address = draft && (draft.address || draft.city)
        ? { city: draft.city, address: draft.address, postalCode: draft.postalCode, province: draft.province }
        : null
      contactId = await recordConfirmedCustomer({
        workspaceId: payment.workspaceId,
        conversationId: conversation.id,
        contactId,
        name,
        phone,
        address,
        source: 'order',
      }).catch((error) => {
        captureError('cardpay:customer', error, { workspaceId: payment.workspaceId })
        return contactId
      })
    }

    const stage = { stage: 'customer' }
    if (contactId) {
      await prisma.contact.updateMany({ where: { id: contactId, workspaceId: payment.workspaceId, deletedAt: null, stage: { not: 'customer' } }, data: stage })
    } else if (phone) {
      // A link paid outside any chat: the profile with that number, when there is one.
      await prisma.contact.updateMany({ where: { workspaceId: payment.workspaceId, deletedAt: null, phone: { in: phoneVariants(phone) }, stage: { not: 'customer' } }, data: stage })
    }

    if (conversation) {
      const { refreshConversationSalesInsight } = await import('@/lib/ai/sales-intelligence')
      await refreshConversationSalesInsight(conversation.id)
    }
  } catch (error) {
    captureError('cardpay:customer', error, { workspaceId: payment.workspaceId })
  }
}

// ─── What a customer bought ─────────────────────────────────────────────────

export interface PurchaseLine {
  name: string
  variant: string | null
  quantity: number
  /** Whole tomans per unit; null when unknown. */
  unitPrice: number | null
}

export interface Purchase {
  /** The payment id for a card-to-card purchase; the draft id otherwise. */
  id: string
  /** Set for card-to-card purchases: the owner can mark them handled. */
  paymentId: string | null
  code: string
  paidAt: Date
  lines: PurchaseLine[]
  /** What the customer paid for the order, whole tomans. */
  total: number
  shipping: { label: string | null; cost: number | null } | null
  discount: number | null
  method: string
  /** Bank card the money went to («…5880»), card-to-card only. */
  card: { bankKey: string; last4: string } | null
  confirmedBy: string | null
  address: string | null
  conversationId: string | null
  /** The order on the store, when it was placed there. */
  storeOrder: string | null
  handledAt: Date | null
  customerName: string | null
  customerPhone: string | null
}

function draftLines(value: Prisma.JsonValue): PurchaseLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const row = raw as Record<string, unknown>
    if (typeof row.name !== 'string' || !row.name.trim()) return []
    return [{
      name: row.name.trim(),
      variant: typeof row.variant === 'string' && row.variant.trim() ? row.variant.trim() : null,
      quantity: typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1,
      unitPrice: typeof row.unitPrice === 'number' ? row.unitPrice : null,
    }]
  })
}

const linesOf = (items: PayItem[]): PurchaseLine[] => items.map((item) => ({ name: item.name, variant: null, quantity: item.quantity, unitPrice: item.unitPrice }))

/**
 * Everything one customer paid for: card-to-card payments (chat orders and
 * links sent in their chats or to their number) and orders paid through the
 * store's own checkout from a chat. Newest first.
 */
export async function loadContactPurchases(workspaceId: string, contact: { id: string; phone: string | null }, conversationIds: string[], take = 30): Promise<Purchase[]> {
  const payments: Prisma.CardPaymentWhereInput[] = []
  if (conversationIds.length) payments.push({ conversationId: { in: conversationIds } })
  if (contact.phone) payments.push({ customerPhone: { in: phoneVariants(contact.phone) } })
  return loadPurchases(workspaceId, {
    payments,
    drafts: [{ contactId: contact.id }, ...(conversationIds.length ? [{ conversationId: { in: conversationIds } }] : [])],
  }, take)
}

/** Paid orders of one conversation; `awaitingOnly` keeps those the owner has not handled. */
export async function loadConversationPurchases(workspaceId: string, conversationId: string, opts: { awaitingOnly?: boolean } = {}): Promise<Purchase[]> {
  return loadPurchases(workspaceId, {
    payments: [{ conversationId, ...(opts.awaitingOnly ? { handledAt: null } : {}) }],
    drafts: opts.awaitingOnly ? [] : [{ conversationId }],
  }, 10)
}

/**
 * Orders paid by card-to-card in Vigent (chat orders and payment links) that
 * did not become a store order: the orders page lists them beside the
 * store's. `handled` narrows to those delivered (true) or waiting (false).
 */
export async function loadGatewayOrders(workspaceId: string, opts: { query?: string[]; handled?: boolean; take?: number } = {}): Promise<Purchase[]> {
  const search: Prisma.CardPaymentWhereInput[] = (opts.query ?? []).flatMap((term) => [
    { reference: { contains: term, mode: 'insensitive' as const } },
    { customerName: { contains: term, mode: 'insensitive' as const } },
    { customerPhone: { contains: term } },
  ])
  const purchases = await loadPurchases(workspaceId, {
    payments: [{
      source: { in: ['CHAT', 'LINK'] },
      ...(opts.handled === true ? { handledAt: { not: null } } : opts.handled === false ? { handledAt: null } : {}),
      ...(search.length ? { OR: search } : {}),
    }],
    drafts: [],
  }, opts.take ?? 30)
  // One the store took is listed as the store's own order.
  return purchases.filter((purchase) => !purchase.storeOrder)
}

async function loadPurchases(workspaceId: string, who: { payments: Prisma.CardPaymentWhereInput[]; drafts: Prisma.OrderDraftWhereInput[] }, take: number): Promise<Purchase[]> {
  const [payments, ownDrafts] = await Promise.all([
    who.payments.length
      ? prisma.cardPayment.findMany({
          where: { workspaceId, status: 'PAID', purpose: 'ORDER', NOT: { reference: { startsWith: 'TEST-' } }, OR: who.payments },
          orderBy: { paidAt: 'desc' },
          take,
          include: { card: { select: { bankKey: true, last4: true } } },
        })
      : [],
    who.drafts.length
      ? prisma.orderDraft.findMany({ where: { workspaceId, status: 'PAID', OR: who.drafts }, orderBy: { paidAt: 'desc' }, take })
      : [],
  ]).catch(() => [[], []] as const)
  // A card payment's cart may sit outside the drafts asked for (a number match).
  const missing = payments.flatMap((payment) => (payment.orderDraftId && !ownDrafts.some((draft) => draft.id === payment.orderDraftId) ? [payment.orderDraftId] : []))
  const drafts = missing.length
    ? [...ownDrafts, ...(await prisma.orderDraft.findMany({ where: { id: { in: missing }, workspaceId } }).catch(() => []))]
    : ownDrafts

  const draftById = new Map(drafts.map((draft) => [draft.id, draft]))
  const address = (draft: (typeof drafts)[number] | undefined) =>
    draft ? [draft.province, draft.city, draft.address].filter(Boolean).join('، ') + (draft.postalCode ? ` · کد پستی ${draft.postalCode}` : '') || null : null

  const purchases: Purchase[] = payments.map((payment) => {
    const draft = payment.orderDraftId ? draftById.get(payment.orderDraftId) : undefined
    const lines = draft ? draftLines(draft.items) : linesOf(readPayItems(payment.items))
    return {
      id: payment.id,
      paymentId: payment.id,
      code: payment.reference,
      paidAt: payment.paidAt ?? payment.updatedAt,
      lines: lines.length ? lines : [{ name: payment.description || 'پرداخت', variant: null, quantity: 1, unitPrice: payment.baseAmount }],
      total: payment.baseAmount + payment.partialAmount,
      shipping: draft && (draft.shippingTotal != null || draft.shippingLabel) ? { label: draft.shippingLabel, cost: draft.shippingTotal == null ? null : Math.round(draft.shippingTotal) } : null,
      discount: draft?.discountTotal ? Math.round(draft.discountTotal) : null,
      method: 'کارت‌به‌کارت',
      card: payment.card,
      confirmedBy: payment.confirmedBy,
      address: address(draft),
      conversationId: payment.conversationId,
      storeOrder: draft?.externalOrderNumber ?? draft?.externalOrderId ?? null,
      handledAt: payment.handledAt,
      customerName: payment.customerName ?? draft?.customerName ?? null,
      customerPhone: payment.customerPhone ?? draft?.customerPhone ?? null,
    }
  })
  const viaCard = new Set(payments.flatMap((payment) => (payment.orderDraftId ? [payment.orderDraftId] : [])))
  for (const draft of ownDrafts) {
    if (viaCard.has(draft.id) || draft.checkoutMode === 'CARD_TRANSFER') continue
    purchases.push({
      id: draft.id,
      paymentId: null,
      code: draft.code,
      paidAt: draft.paidAt ?? draft.updatedAt,
      lines: draftLines(draft.items),
      total: Math.round(draft.grandTotal ?? draft.total ?? 0),
      shipping: draft.shippingTotal != null || draft.shippingLabel ? { label: draft.shippingLabel, cost: draft.shippingTotal == null ? null : Math.round(draft.shippingTotal) } : null,
      discount: draft.discountTotal ? Math.round(draft.discountTotal) : null,
      method: draft.paymentMethodTitle || 'پرداخت آنلاین',
      card: null,
      confirmedBy: null,
      address: address(draft),
      conversationId: draft.conversationId,
      storeOrder: draft.externalOrderNumber ?? draft.externalOrderId,
      handledAt: null,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
    })
  }
  return purchases.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()).slice(0, take)
}
