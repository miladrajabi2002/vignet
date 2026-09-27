/**
 * In-chat pre-order capture — the DB-backed turn resolver.
 *
 * Runs once per customer turn (after catalog retrieval) when the agent has
 * `orderCaptureEnabled`. It owns ONE active OrderDraft per conversation and
 * returns what the engine should do with this turn:
 *   • 'reply'    — a deterministic, data-built message (ask / summary / cancel);
 *   • 'submit'   — the customer confirmed the summary: file the draft and
 *                  hand the conversation to an operator with the order card;
 *   • 'instruct' — the customer asked a question mid-order: the reply model
 *                  answers it and reminds the next step (instruction below);
 *   • 'none'     — not an order turn.
 */
import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractTypedVariations, type VariationRow } from '@/lib/products/description'
import { matchVariationRow, variationLabel } from '@/lib/products/presentation'
import type { CatalogProduct } from '@/lib/ai/rag'
import {
  applyOrderSlots,
  assistantOfferedOrder,
  composeItemUnavailable,
  composeOrderAsk,
  composeOrderCancelled,
  composeOrderDeclined,
  composeOrderSubmitted,
  composeOrderSummary,
  composeProductQuestion,
  composeVariantQuestion,
  detectOrderIntent,
  extractOrderSlots,
  formatOrderForOperator,
  isOrderCancellation,
  isOrderConfirmation,
  isOrderDecline,
  isQuestion,
  missingOrderSlots,
  newDraftCode,
  normalizeOrderText,
  orderInProgressInstruction,
  orderTotal,
  parseOrdinalChoice,
  type OrderDraftItem,
  type OrderDraftState,
  type OrderLang,
  type OrderSlot,
} from '@/lib/commerce/order-capture'
import { isItemAvailable, restockMode, restockOfferLine } from '@/lib/commerce/restock'
import { rememberRestockOffer } from '@/lib/commerce/restock-service'

/** A draft untouched for this long is abandoned, never silently resumed. */
export const ORDER_DRAFT_TTL_MS = 48 * 60 * 60 * 1000
const ACTIVE_STATUSES = ['COLLECTING', 'AWAITING_CONFIRM']

export type OrderCaptureOutcome =
  | { kind: 'none' }
  | { kind: 'reply'; text: string; draftId: string }
  | { kind: 'submit'; text: string; draftId: string; code: string; operatorSummary: string }
  | { kind: 'instruct'; instruction: string; draftId: string }

export interface OrderCaptureTurnParams {
  enabled: boolean
  workspaceId: string
  agentId: string
  conversationId: string
  contactId: string | null
  channel: ChannelType
  message: string
  lang: OrderLang
  /** Rows the catalog search returned for this turn. */
  catalogProducts: CatalogProduct[]
  /** Product card ids of the last assistant replies (may carry «#v<id>»). */
  recentCardIds: string[]
  /** The conversation's current product entity, when grounded. */
  activeEntityId: string | null
  /** Singular variant named in this message («طرح 05»). */
  variantHint: string | null
  lastAssistantText: string | null
  /** Known customer facts, shown in the summary for confirmation. */
  prefill: { name: string | null; phone: string | null; city: string | null; address: string | null }
  restockEnabled: boolean
}

type DraftRow = {
  id: string
  code: string
  status: string
  items: Prisma.JsonValue
  customerName: string | null
  customerPhone: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  note: string | null
  expecting: string | null
  updatedAt: Date
}

type ProductRow = {
  id: string
  name: string
  price: number | null
  stock: number | null
  active: boolean
  attributes: Prisma.JsonValue
  externalUrl: string | null
}

function parseItems(value: Prisma.JsonValue): OrderDraftItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const row = raw as Record<string, unknown>
    if (typeof row.productId !== 'string' || typeof row.name !== 'string') return []
    return [{
      productId: row.productId,
      variationId: typeof row.variationId === 'number' ? row.variationId : null,
      name: row.name,
      variant: typeof row.variant === 'string' ? row.variant : null,
      quantity: typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1,
      unitPrice: typeof row.unitPrice === 'number' ? row.unitPrice : null,
      url: typeof row.url === 'string' ? row.url : null,
      maxQuantity: typeof row.maxQuantity === 'number' ? row.maxQuantity : null,
    }]
  })
}

function toState(row: DraftRow): OrderDraftState {
  return {
    code: row.code,
    status: row.status as OrderDraftState['status'],
    items: parseItems(row.items),
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    city: row.city,
    address: row.address,
    postalCode: row.postalCode,
    note: row.note,
    expecting: (row.expecting as OrderSlot | null) ?? null,
  }
}

/** The conversation's active draft; stale drafts are expired on the way. */
export async function loadActiveOrderDraft(conversationId: string): Promise<DraftRow | null> {
  const rows = await prisma.orderDraft.findMany({
    where: { conversationId, status: { in: ACTIVE_STATUSES } },
    orderBy: { updatedAt: 'desc' },
    take: 3,
  })
  const cutoff = Date.now() - ORDER_DRAFT_TTL_MS
  const stale = rows.filter((row) => row.updatedAt.getTime() < cutoff).map((row) => row.id)
  if (stale.length) {
    await prisma.orderDraft.updateMany({ where: { id: { in: stale } }, data: { status: 'EXPIRED', expecting: null } }).catch(() => {})
  }
  return rows.find((row) => row.updatedAt.getTime() >= cutoff) ?? null
}

/** Cheap pre-check so a closing/short message can be routed to the order flow. */
export async function hasActiveOrderDraft(conversationId: string): Promise<boolean> {
  return Boolean(await loadActiveOrderDraft(conversationId).catch(() => null))
}

function parentId(id: string): string {
  return id.split('#')[0]
}

function variationIdFrom(id: string): number | null {
  const suffix = id.split('#')[1]
  const numeric = suffix ? /^v?(\d+)$/i.exec(suffix) : null
  return numeric ? Number(numeric[1]) : null
}

function availableVariations(product: ProductRow): VariationRow[] {
  return extractTypedVariations(product.attributes).filter((variation) =>
    variation.manageStock ? (variation.stockQuantity ?? 0) > 0 : variation.inStock !== false)
}

/** Match a variation named anywhere in the message («طرح ۵ رو می‌خوام»). */
function variationFromMessage(product: ProductRow, message: string, hint: string | null): VariationRow | null {
  const variations = extractTypedVariations(product.attributes)
  if (!variations.length) return null
  if (hint) {
    const byHint = matchVariationRow(variations, { label: hint })
    if (byHint) return byHint
  }
  const text = ` ${normalizeOrderText(message)} `
  let best: VariationRow | null = null
  let bestLength = 0
  for (const variation of variations) {
    const label = normalizeOrderText(variationLabel(variation))
    if (label.length >= 2 && text.includes(` ${label} `) && label.length > bestLength) {
      best = variation
      bestLength = label.length
    }
  }
  return best
}

function buildItem(product: ProductRow, variation: VariationRow | null, quantity = 1): OrderDraftItem {
  const trackedStock = variation
    ? (variation.manageStock ? variation.stockQuantity ?? null : null)
    : product.stock
  return {
    productId: product.id,
    variationId: variation?.id ?? null,
    name: product.name,
    variant: variation ? variationLabel(variation) : null,
    quantity,
    unitPrice: variation?.price ?? product.price ?? null,
    url: product.externalUrl,
    maxQuantity: trackedStock != null && trackedStock > 0 ? trackedStock : null,
  }
}

async function loadProducts(agentId: string, ids: string[]): Promise<ProductRow[]> {
  const parents = [...new Set(ids.map(parentId).filter(Boolean))].slice(0, 10)
  if (!parents.length) return []
  const rows = await prisma.product.findMany({
    where: { id: { in: parents }, catalogItems: { some: { agentId } } },
    select: { id: true, name: true, price: true, stock: true, active: true, attributes: true, externalUrl: true },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return parents.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
}

/**
 * Which product does the customer want? Order of trust: an ordinal/name pick
 * from the list just offered, the one product this turn's search identified,
 * the one card shown last, the conversation's grounded entity.
 */
async function resolveProductChoice(params: OrderCaptureTurnParams): Promise<
  | { kind: 'picked'; product: ProductRow; variationId: number | null }
  | { kind: 'ambiguous'; candidates: ProductRow[] }
  | { kind: 'unknown' }
> {
  const identified = params.catalogProducts.filter((product) => product.fullTermMatch)
  const offered = [...new Set(params.recentCardIds)]
  const offeredProducts = offered.length ? await loadProducts(params.agentId, offered) : []

  if (offeredProducts.length > 1) {
    const ordinal = parseOrdinalChoice(params.message, offeredProducts.length)
    if (ordinal != null) {
      const product = offeredProducts[ordinal]
      const cardId = offered.find((id) => parentId(id) === product.id) ?? product.id
      return { kind: 'picked', product, variationId: variationIdFrom(cardId) }
    }
    // A distinctive word of exactly one offered name («همون آپادانا»).
    const text = ` ${normalizeOrderText(params.message)} `
    const hits = offeredProducts.filter((product) => normalizeOrderText(product.name)
      .split(/\s+/u)
      .filter((token) => token.length >= 3 && !offeredProducts.every((other) => normalizeOrderText(other.name).includes(token)))
      .some((token) => text.includes(` ${token} `)))
    if (hits.length === 1) {
      const cardId = offered.find((id) => parentId(id) === hits[0].id) ?? hits[0].id
      return { kind: 'picked', product: hits[0], variationId: variationIdFrom(cardId) }
    }
  }
  if (identified.length === 1) {
    const [product] = await loadProducts(params.agentId, [identified[0].id])
    if (product) return { kind: 'picked', product, variationId: variationIdFrom(identified[0].id) }
  }
  if (offeredProducts.length === 1) {
    return { kind: 'picked', product: offeredProducts[0], variationId: variationIdFrom(offered[0]) }
  }
  if (params.activeEntityId) {
    const [product] = await loadProducts(params.agentId, [params.activeEntityId])
    if (product) return { kind: 'picked', product, variationId: variationIdFrom(params.activeEntityId) }
  }
  if (offeredProducts.length > 1) return { kind: 'ambiguous', candidates: offeredProducts }
  if (identified.length > 1) return { kind: 'ambiguous', candidates: await loadProducts(params.agentId, identified.map((product) => product.id)) }
  return { kind: 'unknown' }
}

async function saveDraft(params: OrderCaptureTurnParams, id: string | null, state: OrderDraftState): Promise<string> {
  const data = {
    status: state.status,
    items: state.items as unknown as Prisma.InputJsonValue,
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    city: state.city,
    address: state.address,
    postalCode: state.postalCode,
    note: state.note,
    expecting: state.expecting,
    total: orderTotal(state),
  }
  if (id) {
    await prisma.orderDraft.update({ where: { id }, data })
    return id
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await prisma.orderDraft.create({
        data: {
          ...data,
          code: attempt === 0 ? state.code : newDraftCode(),
          workspaceId: params.workspaceId,
          agentId: params.agentId,
          conversationId: params.conversationId,
          contactId: params.contactId,
          channel: params.channel,
        },
        select: { id: true, code: true },
      })
      state.code = created.code
      return created.id
    } catch (error) {
      // Unique code collision (1 in ~10⁹): retry with a fresh code.
      if (attempt === 2) throw error
    }
  }
  throw new Error('ORDER_DRAFT_CREATE_FAILED')
}

/** Mark a filed draft with the handoff alert that carries it. */
export async function markOrderDraftSubmitted(draftId: string, handoffAlertId: string | null): Promise<void> {
  await prisma.orderDraft.update({
    where: { id: draftId },
    data: { status: 'SUBMITTED', expecting: null, submittedAt: new Date(), ...(handoffAlertId ? { handoffAlertId } : {}) },
  })
}

export async function resolveOrderCaptureTurn(params: OrderCaptureTurnParams): Promise<OrderCaptureOutcome> {
  if (!params.enabled) return { kind: 'none' }
  const row = await loadActiveOrderDraft(params.conversationId)
  const lang = params.lang

  let state: OrderDraftState
  let draftId: string | null = row?.id ?? null
  let opening = false

  if (!row) {
    const intent = detectOrderIntent(params.message)
      || (assistantOfferedOrder(params.lastAssistantText) && isOrderConfirmation(params.message))
    if (!intent) return { kind: 'none' }
    opening = true
    state = {
      code: newDraftCode(),
      status: 'COLLECTING',
      items: [],
      customerName: params.prefill.name,
      customerPhone: params.prefill.phone,
      city: params.prefill.city,
      address: params.prefill.address,
      postalCode: null,
      note: null,
      expecting: null,
    }
  } else {
    state = toState(row)
    if (isOrderCancellation(params.message)) {
      state.status = 'CANCELLED'
      state.expecting = null
      await prisma.orderDraft.update({ where: { id: row.id }, data: { status: 'CANCELLED', expecting: null, resolvedAt: new Date() } })
      return { kind: 'reply', text: composeOrderCancelled(lang), draftId: row.id }
    }
  }

  // ── Product (and variant) ────────────────────────────────────────────
  let needsVariant = false
  let variantOptions: string[] = []
  let changed = false
  if (!state.items.length) {
    const choice = await resolveProductChoice(params)
    if (choice.kind === 'picked') {
      const { product } = choice
      const pinned = choice.variationId != null
        ? extractTypedVariations(product.attributes).find((variation) => variation.id === choice.variationId) ?? null
        : variationFromMessage(product, params.message, params.variantHint)
      if (!isItemAvailable(product, pinned?.id ?? null)) {
        const item = buildItem(product, pinned)
        const mode = params.restockEnabled ? restockMode(params.channel, Boolean(state.customerPhone)) : null
        const offer = mode ? restockOfferLine(mode, lang) : null
        if (offer) {
          await rememberRestockOffer(params.conversationId, [{
            productId: product.id, variationId: pinned?.id ?? null, name: product.name, variant: item.variant,
          }]).catch(() => {})
        }
        if (draftId) {
          await prisma.orderDraft.update({ where: { id: draftId }, data: { status: 'CANCELLED', expecting: null, resolvedAt: new Date() } })
        }
        return { kind: 'reply', text: composeItemUnavailable(item, lang, offer), draftId: draftId ?? '' }
      }
      state.items = [buildItem(product, pinned)]
      changed = true
    } else if (choice.kind === 'ambiguous') {
      state.expecting = 'product'
      draftId = await saveDraft(params, draftId, state)
      return { kind: 'reply', text: composeProductQuestion(choice.candidates, lang), draftId }
    }
  }

  const item = state.items[0]
  if (item && item.variationId == null) {
    const [product] = await loadProducts(params.agentId, [item.productId])
    if (product) {
      const available = availableVariations(product)
      const all = extractTypedVariations(product.attributes)
      if (all.length > 0) {
        const picked = variationFromMessage(product, params.message, params.variantHint)
        if (picked && available.some((variation) => variation.id === picked.id)) {
          state.items[0] = { ...buildItem(product, picked, item.quantity) }
          changed = true
        } else if (picked) {
          // The named variant exists but is sold out: say so, keep the draft.
          const unavailableItem = buildItem(product, picked)
          const mode = params.restockEnabled ? restockMode(params.channel, Boolean(state.customerPhone)) : null
          const offer = mode ? restockOfferLine(mode, lang) : null
          if (offer) {
            await rememberRestockOffer(params.conversationId, [{
              productId: product.id, variationId: picked.id, name: product.name, variant: unavailableItem.variant,
            }]).catch(() => {})
          }
          state.expecting = 'variant'
          draftId = await saveDraft(params, draftId, state)
          const alternatives = available.map(variationLabel).filter(Boolean)
          const tail = alternatives.length
            ? (lang === 'en' ? `\nAvailable: ${alternatives.slice(0, 8).join(', ')}` : `\nمدل‌های موجود: ${alternatives.slice(0, 8).join('، ')}`)
            : ''
          return { kind: 'reply', text: `${composeItemUnavailable(unavailableItem, lang, offer)}${tail}`, draftId }
        } else if (available.length === 1) {
          state.items[0] = { ...buildItem(product, available[0], item.quantity) }
          changed = true
        } else if (available.length > 1) {
          needsVariant = true
          variantOptions = available.map(variationLabel).filter(Boolean)
        }
      }
    }
  }

  // ── Customer fields ──────────────────────────────────────────────────
  const missingBefore = missingOrderSlots(state, needsVariant)
  const slots = extractOrderSlots(params.message, state.expecting, missingBefore)
  // The purchase-intent message itself («میخوام بخرمش») and a product /
  // variant pick («آبی»، «دومی») are never the customer's name.
  if ((opening || changed) && slots.name && !slots.phone && !slots.address) delete slots.name
  const slotChanged = applyOrderSlots(state, slots)
  changed ||= slotChanged

  // ── Confirmation step ────────────────────────────────────────────────
  if (row && state.status === 'AWAITING_CONFIRM' && !slotChanged) {
    if (isOrderConfirmation(params.message) && missingOrderSlots(state, needsVariant).length === 0) {
      state.status = 'SUBMITTED'
      state.expecting = null
      await saveDraft(params, row.id, state)
      return {
        kind: 'submit',
        text: composeOrderSubmitted(state, lang),
        draftId: row.id,
        code: state.code,
        operatorSummary: formatOrderForOperator(state),
      }
    }
    if (isOrderDecline(params.message)) {
      return { kind: 'reply', text: composeOrderDeclined(lang), draftId: row.id }
    }
  }

  const missing = missingOrderSlots(state, needsVariant)

  // A mid-order question («ارسالش چند روزه؟») is answered by the model,
  // which then reminds the one next step.
  if (!opening && !changed && isQuestion(params.message)) {
    draftId = await saveDraft(params, draftId, state)
    return { kind: 'instruct', instruction: orderInProgressInstruction(state, missing, lang), draftId }
  }

  if (missing.includes('product')) {
    state.expecting = 'product'
    draftId = await saveDraft(params, draftId, state)
    return { kind: 'reply', text: composeProductQuestion([], lang), draftId }
  }
  if (missing.includes('variant') && state.items[0]) {
    state.expecting = 'variant'
    draftId = await saveDraft(params, draftId, state)
    return { kind: 'reply', text: composeVariantQuestion(state.items[0], variantOptions, lang), draftId }
  }
  if (missing.length === 0) {
    const corrected = state.status === 'AWAITING_CONFIRM' && slotChanged
    state.status = 'AWAITING_CONFIRM'
    state.expecting = 'confirm'
    draftId = await saveDraft(params, draftId, state)
    return { kind: 'reply', text: composeOrderSummary(state, lang, corrected), draftId }
  }
  const unparsed = !opening && !changed
  state.status = 'COLLECTING'
  state.expecting = missing[0]
  draftId = await saveDraft(params, draftId, state)
  return { kind: 'reply', text: composeOrderAsk({ draft: state, missing, lang, opening: opening || (changed && !slotChanged), unparsed }), draftId }
}
