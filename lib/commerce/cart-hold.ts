/**
 * Cart hold (agent.cartHoldEnabled).
 *
 * The first time a chat cart gets an item, it is held for one hour and the
 * customer is told until when. While a hold runs, the held units count as
 * taken for every OTHER chat customer of the workspace (catalog answers,
 * cart edits and back-in-stock alerts all see the reduced stock), so two
 * chats are never promised the last unit. Thirty minutes before the end the
 * customer gets one reminder; when the hour is over the hold is released and
 * any line that sold out in the meantime leaves the cart, with a message.
 *
 * The hold lives inside Vigent: a purchase on the store's own website is not
 * blocked by it. That case is still safe, because the store re-checks stock
 * when the payment link is opened and a sold-out line is dropped with a
 * message (checkout-service → reopenAfterStoreRejection).
 *
 * One hold per cart; a payment link, a filed pre-order or a cancellation ends
 * the hold's job (the link has its own reminder and expiry).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { isItemAvailable } from '@/lib/commerce/restock'
import { orderTotal, type OrderDraftItem, type OrderLang } from '@/lib/commerce/order-capture'
import { deliverAssistantNotice, lastCustomerLang, parseDraftItems } from '@/lib/commerce/checkout-service'
import { itemLine } from '@/lib/commerce/checkout-link'

export const HOLD_MS = 60 * 60 * 1000
export const REMIND_BEFORE_MS = 30 * 60 * 1000
/** Drafts a hold applies to: a cart still being built or confirmed. */
export const HOLD_STATUSES = ['COLLECTING', 'AWAITING_CONFIRM']
const LIVE_HOLDS = ['HELD', 'REMINDED']
const WINDOWED = new Set(['INSTAGRAM', 'WHATSAPP'])
const WINDOW_MS = 23 * 3_600_000

// ─── Pure helpers ───────────────────────────────────────────────────────────

export function holdKey(productId: string, variationId: number | null | undefined): string {
  return `${productId}:${variationId ?? ''}`
}

/** Units held per product/variation across the given carts' items. */
export function sumHeld(carts: unknown[]): Map<string, number> {
  const held = new Map<string, number>()
  for (const items of carts) {
    if (!Array.isArray(items)) continue
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as Record<string, unknown>
      if (typeof row.productId !== 'string') continue
      const variationId = typeof row.variationId === 'number' ? row.variationId : null
      const quantity = typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1
      const key = holdKey(row.productId, variationId)
      held.set(key, (held.get(key) ?? 0) + quantity)
    }
  }
  return held
}

/**
 * The product as another customer sees it while units are held: tracked
 * stock (product-level and per variation) reduced by the held units. Stock
 * that is not tracked (null / unmanaged variations) is left as is.
 */
export function withHeldStock<T extends { id: string; stock: number | null; attributes: unknown }>(product: T, held: Map<string, number>): T {
  if (!held.size) return product
  let next: T = product
  const parentHeld = held.get(holdKey(product.id, null)) ?? 0
  if (product.stock != null && parentHeld > 0) next = { ...next, stock: Math.max(0, product.stock - parentHeld) }
  const attrs = product.attributes
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs) && Array.isArray((attrs as Record<string, unknown>)._variations)) {
    const record = attrs as Record<string, unknown>
    let touched = false
    const variations = (record._variations as unknown[]).map((raw) => {
      if (!raw || typeof raw !== 'object') return raw
      const variation = raw as Record<string, unknown>
      const units = typeof variation.id === 'number' ? held.get(holdKey(product.id, variation.id)) ?? 0 : 0
      if (!units || variation.manageStock !== true || typeof variation.stockQuantity !== 'number') return raw
      touched = true
      const stockQuantity = Math.max(0, variation.stockQuantity - units)
      return { ...variation, stockQuantity, inStock: stockQuantity > 0 }
    })
    if (touched) next = { ...next, attributes: { ...record, _variations: variations } }
  }
  return next
}

/** «۱۸:۴۰» in Tehran time. */
export function holdClock(date: Date, lang: OrderLang): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tehran',
  }).format(date)
}

export function holdStartedLine(until: Date, lang: OrderLang): string {
  const clock = holdClock(until, lang)
  return lang === 'en'
    ? `⏳ I’m holding this cart for you until ${clock} (one hour).`
    : `⏳ این سبد تا ساعت ${clock} (یک ساعت) براتون رزرو شد.`
}

export function holdReminderText(items: OrderDraftItem[], until: Date, lang: OrderLang): string {
  const clock = holdClock(until, lang)
  const list = items.map((item) => `• ${itemLine(item, lang)}`).join('\n')
  return lang === 'en'
    ? `⏳ 30 minutes left on your cart hold (until ${clock}):\n${list}\nIf you still want it, just continue here and I’ll finish the order.`
    : `⏳ فقط ۳۰ دقیقه تا پایان رزرو سبدتون مونده (تا ساعت ${clock}):\n${list}\nاگه هنوز می‌خواید، همین‌جا ادامه بدیم تا نهایی‌اش کنم.`
}

/** Null when nothing sold out: an ended hold needs no message on its own. */
export function holdEndedText(removed: OrderDraftItem[], kept: OrderDraftItem[], lang: OrderLang): string | null {
  if (!removed.length) return null
  const names = removed.map((item) => (lang === 'en' ? `“${itemLine(item, 'en')}”` : `«${itemLine(item, 'fa')}»`)).join(lang === 'en' ? ', ' : '، ')
  if (lang === 'en') {
    return kept.length
      ? `⌛ Your cart hold has ended, and ${names} sold out in the meantime, so I removed it.\nYour cart now:\n${kept.map((item) => `• ${itemLine(item, 'en')}`).join('\n')}\nTell me here if you’d like to continue.`
      : `⌛ Your cart hold has ended, and ${names} sold out in the meantime, so the cart is empty now. I can suggest a similar item if you like.`
  }
  return kept.length
    ? `⌛ زمان رزرو سبدتون تموم شد و ${names} در این فاصله ناموجود شد، برای همین از سبد برداشتمش.\nسبد الان:\n${kept.map((item) => `• ${itemLine(item, 'fa')}`).join('\n')}\nاگه بخواید ادامه بدیم، همین‌جا بگید.`
    : `⌛ زمان رزرو سبدتون تموم شد و ${names} در این فاصله ناموجود شد؛ سبد الان خالیه. اگه بخواید مدل مشابه پیشنهاد می‌دم.`
}

// ─── DB ─────────────────────────────────────────────────────────────────────

/**
 * Start the hold on a cart that has items and never had one. Returns the
 * line to append to this turn's reply, or null.
 */
export async function startCartHold(draftId: string, lang: OrderLang, now = new Date()): Promise<string | null> {
  try {
    const draft = await prisma.orderDraft.findUnique({ where: { id: draftId }, select: { items: true, status: true, holdState: true } })
    if (!draft || draft.holdState || !HOLD_STATUSES.includes(draft.status) || !parseDraftItems(draft.items).length) return null
    const heldUntil = new Date(now.getTime() + HOLD_MS)
    const claimed = await prisma.orderDraft.updateMany({
      where: { id: draftId, holdState: null, status: { in: HOLD_STATUSES } },
      data: { heldUntil, holdState: 'HELD' },
    })
    return claimed.count ? holdStartedLine(heldUntil, lang) : null
  } catch (error) {
    captureError('cart-hold:start', error, { metadata: { draftId } })
    return null
  }
}

type HoldRow = { conversationId: string; workspaceId: string; items: Prisma.JsonValue }

async function liveHolds(where: Prisma.OrderDraftWhereInput, now: Date): Promise<HoldRow[]> {
  return prisma.orderDraft.findMany({
    where: { ...where, status: { in: HOLD_STATUSES }, holdState: { in: LIVE_HOLDS }, heldUntil: { gt: now } },
    select: { conversationId: true, workspaceId: true, items: true },
    take: 300,
  })
}

/** Units other conversations of the workspace hold right now. */
export async function heldByOthers(workspaceId: string, conversationId: string, now = new Date()): Promise<Map<string, number>> {
  try {
    const rows = await liveHolds({ workspaceId, conversationId: { not: conversationId } }, now)
    return sumHeld(rows.map((row) => row.items))
  } catch {
    return new Map()
  }
}

/** Every live hold of the given workspaces (for sweeps that serve many chats). */
export async function liveHoldsFor(workspaceIds: string[], now = new Date()): Promise<HoldRow[]> {
  if (!workspaceIds.length) return []
  try {
    return await liveHolds({ workspaceId: { in: [...new Set(workspaceIds)] } }, now)
  } catch {
    return []
  }
}

/** Held units for one conversation's view, from a preloaded hold list. */
export function heldExcept(holds: HoldRow[], workspaceId: string, conversationId: string): Map<string, number> {
  return sumHeld(holds.filter((row) => row.workspaceId === workspaceId && row.conversationId !== conversationId).map((row) => row.items))
}

async function customerReachable(conversation: { id: string; channel: string }, now: Date): Promise<boolean> {
  if (!WINDOWED.has(conversation.channel)) return true
  const last = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: 'USER' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return Boolean(last && now.getTime() - last.createdAt.getTime() <= WINDOW_MS)
}

export interface CartHoldSweepStats {
  reminded: number
  released: number
  trimmed: number
}

/** Worker sweep (every few minutes): reminders, then expiries. */
export async function sweepCartHolds(now = new Date()): Promise<CartHoldSweepStats> {
  const stats: CartHoldSweepStats = { reminded: 0, released: 0, trimmed: 0 }
  const conversationSelect = { id: true, agentId: true, channel: true, externalId: true } as const

  const due = await prisma.orderDraft.findMany({
    where: {
      holdState: 'HELD',
      status: { in: HOLD_STATUSES },
      heldUntil: { gt: now, lte: new Date(now.getTime() + REMIND_BEFORE_MS) },
    },
    select: { id: true, items: true, heldUntil: true, conversation: { select: conversationSelect } },
    take: 100,
  })
  for (const draft of due) {
    try {
      const claimed = await prisma.orderDraft.updateMany({ where: { id: draft.id, holdState: 'HELD' }, data: { holdState: 'REMINDED' } })
      if (!claimed.count || !draft.heldUntil) continue
      if (!(await customerReachable(draft.conversation, now))) continue
      const items = parseDraftItems(draft.items)
      if (!items.length) continue
      const lang = await lastCustomerLang(draft.conversation.id).catch((): OrderLang => 'fa')
      const result = await deliverAssistantNotice(draft.conversation, holdReminderText(items, draft.heldUntil, lang), { cartHold: 'REMINDER', draftId: draft.id })
      if (result !== 'failed') stats.reminded += 1
    } catch (error) {
      captureError('cart-hold:remind', error, { metadata: { draftId: draft.id } })
    }
  }

  const ended = await prisma.orderDraft.findMany({
    where: { holdState: { in: LIVE_HOLDS }, heldUntil: { lte: now } },
    select: {
      id: true,
      workspaceId: true,
      conversationId: true,
      status: true,
      items: true,
      conversation: { select: conversationSelect },
    },
    take: 100,
  })
  const holds = await liveHoldsFor(ended.map((draft) => draft.workspaceId), now)
  for (const draft of ended) {
    try {
      const claimed = await prisma.orderDraft.updateMany({ where: { id: draft.id, holdState: { in: LIVE_HOLDS } }, data: { holdState: 'RELEASED' } })
      if (!claimed.count) continue
      stats.released += 1
      // A link, a filed pre-order or a cancellation already moved the cart on.
      if (!HOLD_STATUSES.includes(draft.status)) continue
      const items = parseDraftItems(draft.items)
      if (!items.length) continue
      const products = await prisma.product.findMany({
        where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
        select: { id: true, active: true, stock: true, attributes: true },
      })
      const held = heldExcept(holds, draft.workspaceId, draft.conversationId)
      const byId = new Map(products.map((product) => [product.id, withHeldStock(product, held)]))
      const kept: OrderDraftItem[] = []
      const removed: OrderDraftItem[] = []
      for (const item of items) {
        const product = byId.get(item.productId)
        if (product && isItemAvailable(product, item.variationId)) kept.push(item)
        else removed.push(item)
      }
      const text = holdEndedText(removed, kept, 'fa')
      if (!text) continue
      await prisma.orderDraft.update({
        where: { id: draft.id },
        data: kept.length
          ? { items: kept as unknown as Prisma.InputJsonValue, total: orderTotal({ items: kept }) }
          : { items: [] as unknown as Prisma.InputJsonValue, status: 'CANCELLED', expecting: null, resolvedAt: now },
      })
      stats.trimmed += 1
      if (!(await customerReachable(draft.conversation, now))) continue
      const lang = await lastCustomerLang(draft.conversation.id).catch((): OrderLang => 'fa')
      await deliverAssistantNotice(draft.conversation, holdEndedText(removed, kept, lang) ?? text, { cartHold: 'RELEASED', draftId: draft.id })
    } catch (error) {
      captureError('cart-hold:release', error, { metadata: { draftId: draft.id } })
    }
  }
  return stats
}
