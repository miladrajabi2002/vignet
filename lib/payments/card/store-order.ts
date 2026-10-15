/**
 * A chat order paid by the card-to-card gateway becomes a real WooCommerce
 * order on the connected store (vigent-woo 5.2+, POST checkout/place): the
 * same products at the price the customer paid, the customer's address,
 * «کارت‌به‌کارت (ویجنت)» as the payment method, marked paid, so stock,
 * emails and the store's own order list behave as for a sale on the site.
 *
 * Runs right after the payment is confirmed and again from the worker's
 * sweep until it succeeds (a store that is down for a while still gets the
 * order). The plugin is idempotent on the chat code, so a retry never makes
 * a second order. Once placed, the draft carries the store's integration
 * and order id: the store's status events (shipped, completed, refunded)
 * then flow back to the conversation like a payment-link order's.
 */
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { notifyWorkspace } from '@/lib/notifications/create'
import { pluginVersionAtLeast } from '@/lib/commerce/checkout-link'
import { callStore, StoreApiError, type StoreCheckoutStatus } from '@/lib/commerce/store-api'

export const MIN_CARD_ORDER_PLUGIN_VERSION = '5.2.0'

/** Waits before each retry; after the last one the owner is told. */
export const STORE_SYNC_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000, 24 * 3_600_000]

export type StoreSyncResult = 'placed' | 'skipped' | 'retry' | 'failed'

export function pluginPlacesCardOrders(version: string | null | undefined): boolean {
  return pluginVersionAtLeast(version, MIN_CARD_ORDER_PLUGIN_VERSION)
}

/** Next attempt after `tries` failed ones; null when it is time to give up. */
export function nextStoreSyncAt(tries: number, now: Date): Date | null {
  const wait = STORE_SYNC_BACKOFF_MS[tries - 1]
  return wait == null ? null : new Date(now.getTime() + wait)
}

/** A store answer that no retry will change. */
export function isFinalStoreError(error: unknown): boolean {
  if (!(error instanceof StoreApiError)) return false
  return error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404 || error.status === 422
}

function reason(error: unknown): string {
  if (error instanceof StoreApiError) {
    if (error.status === 404) return 'افزونهٔ ویجنت روی سایت قدیمی است؛ آن را به نسخهٔ ۵.۲ یا بالاتر به‌روز کنید.'
    if (error.status === 401) return 'کلید اتصال افزونه با ویجنت یکی نیست؛ اتصال ووکامرس را دوباره برقرار کنید.'
    if (error.status === 403) return 'سایت درخواست ویجنت را رد کرد (فایروال یا ووکامرس قدیمی).'
    if (error.status === 422) return 'هیچ‌کدام از محصولات این سفارش روی سایت پیدا نشد.'
    if (error.status === 0) return 'سایت در دسترس نبود.'
    return `سایت خطا داد (${error.status}).`
  }
  return error instanceof Error ? error.message.slice(0, 200) : 'خطای ناشناخته'
}

interface PlaceResponse extends StoreCheckoutStatus {
  created?: boolean
}

/**
 * Place one paid card-to-card draft on its store. Safe to call more than
 * once: it does nothing for a draft already placed or not due.
 */
export async function placeCardOrderOnStore(draftId: string, now = new Date()): Promise<StoreSyncResult> {
  const draft = await prisma.orderDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.checkoutMode !== 'CARD_TRANSFER' || draft.status !== 'PAID' || draft.externalOrderId || !draft.storeSyncAt) return 'skipped'

  const skip = async (error: string | null = null): Promise<StoreSyncResult> => {
    await prisma.orderDraft.update({ where: { id: draft.id }, data: { storeSyncAt: null, storeSyncError: error } }).catch(() => {})
    return 'skipped'
  }

  const { findCheckoutIntegration, parseDraftItems, storeLinesForItems, customerBlock } = await import('@/lib/commerce/checkout-service')
  const integration = draft.integrationId
    ? await prisma.storeIntegration.findFirst({ where: { id: draft.integrationId, active: true, webhookSecret: { not: null } }, select: { id: true, storeUrl: true, webhookSecret: true, pluginVersion: true } })
    : (await findCheckoutIntegration(draft.workspaceId)).integration
  if (!integration?.webhookSecret) return skip()
  if (!pluginPlacesCardOrders(integration.pluginVersion)) return skip('افزونهٔ ویجنت روی سایت قدیمی است؛ برای ثبت خودکار سفارش‌های کارت‌به‌کارت آن را به نسخهٔ ۵.۲ یا بالاتر به‌روز کنید.')

  const items = parseDraftItems(draft.items)
  // A cart with anything not from this store's catalog cannot be placed there.
  const lines = await storeLinesForItems(integration.id, items)
  if (!lines) return skip()

  const payment = await prisma.cardPayment.findFirst({
    where: { orderDraftId: draft.id, status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    include: { card: { select: { last4: true } } },
  })
  if (!payment) return skip()

  // Claim the attempt (and tie the draft to the store first, so the status
  // event the store sends while placing it is accepted).
  const claimed = await prisma.orderDraft.updateMany({
    where: { id: draft.id, storeSyncAt: draft.storeSyncAt, externalOrderId: null },
    data: { integrationId: integration.id, storeSyncAt: new Date(now.getTime() + 2 * 60_000), storeSyncTries: { increment: 1 } },
  })
  if (!claimed.count) return 'skipped'
  const tries = draft.storeSyncTries + 1

  const prices = new Map(items.map((item) => [`${item.productId}:${item.variationId ?? 0}`, item.unitPrice]))
  try {
    const placed = await callStore<PlaceResponse>(
      { storeUrl: integration.storeUrl, webhookSecret: integration.webhookSecret },
      'place',
      {
        code: draft.code,
        channel: draft.channel,
        items: lines.map((line, index) => ({ ...line, unit_price: prices.get(`${items[index].productId}:${items[index].variationId ?? 0}`) ?? null })),
        customer: customerBlock(draft, draft.province),
        note: draft.note ?? '',
        shipping: draft.shippingTotal != null || draft.shippingLabel ? { label: draft.shippingLabel ?? '', cost: draft.shippingTotal ?? 0 } : null,
        payment: {
          amount: payment.baseAmount,
          reference: payment.reference,
          title: 'کارت‌به‌کارت (ویجنت)',
          card: payment.card ? `…${payment.card.last4}` : '',
          confirmed_by: payment.confirmedBy ?? '',
        },
      },
      20_000,
    )
    if (!placed?.ok || !placed.order_id) throw new StoreApiError('STORE_BAD_ANSWER', 502)
    await prisma.orderDraft.update({
      where: { id: draft.id },
      data: {
        externalOrderId: String(placed.order_id),
        externalOrderNumber: placed.order_number ? String(placed.order_number) : String(placed.order_id),
        storeSyncAt: null,
        storeSyncError: null,
      },
    })
    // Shipping news for this order, as for a payment-link order.
    await import('@/lib/commerce/order-updates')
      .then((updates) => updates.followPaidCheckout({
        workspaceId: draft.workspaceId,
        agentId: draft.agentId,
        conversationId: draft.conversationId,
        integrationId: integration.id,
        externalOrderId: String(placed.order_id),
        status: placed.status || 'processing',
      }))
      .catch((error) => captureError('cardpay:store-follow', error, { workspaceId: draft.workspaceId }))
    return 'placed'
  } catch (error) {
    const final = isFinalStoreError(error)
    const next = final ? null : nextStoreSyncAt(tries, now)
    const why = reason(error)
    await prisma.orderDraft.update({ where: { id: draft.id }, data: { storeSyncAt: next, storeSyncError: why } }).catch(() => {})
    if (next) return 'retry'
    captureError('cardpay:store-order', error, { workspaceId: draft.workspaceId })
    await notifyWorkspace({
      workspaceId: draft.workspaceId,
      type: 'SYSTEM',
      title: `سفارش ${draft.code} پرداخت شد ولی در ووکامرس ثبت نشد`,
      body: `${why}\nسفارش را دستی در ووکامرس ثبت کنید؛ پرداخت در ویجنت تأیید شده است.`,
      link: `/conversations/${draft.conversationId}`,
      operatorTelegram: 'orders',
    }).catch(() => {})
    return 'failed'
  }
}

/** Worker sweep: drafts whose next attempt is due. */
export async function sweepStoreOrders(now = new Date()): Promise<{ placed: number; failed: number }> {
  const due = await prisma.orderDraft.findMany({ where: { storeSyncAt: { lte: now }, externalOrderId: null }, select: { id: true }, orderBy: { storeSyncAt: 'asc' }, take: 20 })
  const stats = { placed: 0, failed: 0 }
  for (const row of due) {
    const result = await placeCardOrderOnStore(row.id, now).catch((error) => {
      captureError('cardpay:store-sweep', error)
      return 'retry' as const
    })
    if (result === 'placed') stats.placed += 1
    if (result === 'failed') stats.failed += 1
  }
  return stats
}
