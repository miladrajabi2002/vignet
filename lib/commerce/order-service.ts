/**
 * In-chat order capture — the DB-backed turn resolver.
 *
 * Runs once per customer turn (after catalog retrieval) when the agent has
 * `orderCaptureEnabled`. It owns ONE active OrderDraft (the chat cart) per
 * conversation and returns what the engine should do with this turn:
 *   • 'reply'    — a deterministic, data-built message (ask / summary /
 *                  cart change / payment link / cancel);
 *   • 'submit'   — the customer confirmed the summary of a pre-order: file
 *                  it and hand the conversation to an operator;
 *   • 'instruct' — the customer asked a question mid-order: the reply model
 *                  answers it and reminds the next step (instruction below);
 *   • 'none'     — not an order turn.
 *
 * With a checkout context (agent.payLinkEnabled + WooCommerce plugin 5.0+)
 * the confirmed cart becomes a payment link on the store itself instead of
 * an operator pre-order; see lib/commerce/checkout-service.ts.
 */
import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractTypedVariations, type VariationRow } from '@/lib/products/description'
import { isVariationAvailable, matchVariationRow, variationLabel } from '@/lib/products/presentation'
import { fixedLabel, matchVariantInText, nextVariantQuestion, type VariantMatch } from '@/lib/products/variant-match'
import type { CatalogProduct } from '@/lib/ai/rag'
import {
  applyOrderSlots,
  assistantOfferedOrder,
  composeCartChange,
  composeItemUnavailable,
  composeOrderAsk,
  composeOrderCancelled,
  composeOrderDeclined,
  composeOrderSubmitted,
  composeOrderSummary,
  composeProductQuestion,
  composeShippingQuestion,
  composeVariantQuestion,
  detectOrderIntent,
  extractOrderSlots,
  formatOrderForOperator,
  isOrderCancellation,
  isOrderConfirmation,
  isOrderDecline,
  isQuestion,
  matchShippingChoice,
  mentionsShippingMethod,
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
  type ShippingOption,
  type SummaryQuote,
} from '@/lib/commerce/order-capture'
import { isItemAvailable, restockMode, restockOfferLine } from '@/lib/commerce/restock'
import { rememberRestockOffer } from '@/lib/commerce/restock-service'
import { heldByOthers, startCartHold, withHeldStock } from '@/lib/commerce/cart-hold'
import {
  detectCartEditCue,
  planCartEditDeterministic,
  planCartEditWithModel,
  type CartCandidate,
  type CartEditCue,
  type CartEditOp,
} from '@/lib/commerce/cart-edit'
import {
  checkoutMarker,
  extractCouponCode,
  formatToman,
  isLinkRequest,
  isPaymentClaim,
  itemLine,
} from '@/lib/commerce/checkout-link'
import type { CheckoutContext, DraftQuoteView } from '@/lib/commerce/checkout-service'

/** A draft untouched for this long is abandoned, never silently resumed. */
export const ORDER_DRAFT_TTL_MS = 48 * 60 * 60 * 1000
const ACTIVE_STATUSES = ['COLLECTING', 'AWAITING_CONFIRM']
const OPEN_CHECKOUT_STATUSES = ['LINK_SENT', 'PAYMENT_PENDING', 'PAYMENT_FAILED']
const MAX_CART_LINES = 15

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
  /** In-chat checkout (payment link on the store). Null = operator pre-order. */
  checkout?: CheckoutContext | null
  /** Model for understanding cart edits («یه پاف هم اضافه کن»). Null = deterministic only. */
  cartModel?: string | null
  /** agent.cartHoldEnabled: one-hour hold on this cart; other chats' holds reduce stock. */
  cartHold?: boolean
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
  coupons?: string[] | null
  quotedAt?: Date | null
  quote?: Prisma.JsonValue | null
  shippingRateId?: string | null
}

type OpenCheckoutRow = DraftRow & {
  linkSlug: string | null
  linkExpiresAt: Date | null
  quote: Prisma.JsonValue | null
  shippingLabel: string | null
  shippingTotal: number | null
  discountTotal: number | null
  grandTotal: number | null
  externalOrderNumber: string | null
  paymentMethodTitle: string | null
  integrationId: string | null
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
    coupons: Array.isArray(row.coupons) ? row.coupons : [],
    shippingRateId: row.shippingRateId ?? null,
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

/** The conversation's latest cart with an unpaid payment link, if any. */
async function loadOpenCheckout(conversationId: string): Promise<OpenCheckoutRow | null> {
  // A recently expired link still counts: «لینک رو دوباره بفرست» re-opens it.
  const row = await prisma.orderDraft.findFirst({
    where: {
      conversationId,
      OR: [
        { status: { in: OPEN_CHECKOUT_STATUSES } },
        { status: { in: ['EXPIRED', 'CANCELLED'] }, checkoutMode: 'PAY_LINK', linkSentAt: { not: null }, updatedAt: { gt: new Date(Date.now() - 3 * 24 * 3_600_000) } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  })
  return (row as OpenCheckoutRow | null) ?? null
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
    // «رنگ: سفید» is named as «سفید» in conversation: try the bare values too.
    const values = [label, ...Object.values(variation.attributes).map((value) => normalizeOrderText(value))]
    for (const value of values) {
      if (value.length >= 2 && text.includes(` ${value} `) && value.length > bestLength) {
        best = variation
        bestLength = value.length
      }
    }
  }
  return best
}

/**
 * Which variation the customer named, across multi-option products: the
 * options carried from an earlier turn («مشکی») plus this message («M»).
 * A partial pick never becomes a silent choice; single-option products keep
 * the forgiving label match («طرح ۵» → «طرح 05»).
 */
function variantFromMessage(product: ProductRow, message: string, hint: string | null, carried: string | null = null): VariantMatch {
  const variations = extractTypedVariations(product.attributes)
  if (!variations.length) return { kind: 'none' }
  const match = matchVariantInText(variations, [carried, hint, message].filter(Boolean).join(' '))
  if (match.kind !== 'none') return match
  if (variations.some((variation) => Object.keys(variation.attributes).length > 1)) return match
  const legacy = variationFromMessage(product, message, hint)
  return legacy ? { kind: 'full', variation: legacy } : match
}

/** A cart line for a product whose options are only partly chosen so far. */
function partialItem(product: ProductRow, match: VariantMatch, quantity = 1): OrderDraftItem {
  const item = buildItem(product, null, quantity)
  if (match.kind === 'partial') item.variant = fixedLabel(match.fixed) || null
  return item
}

function buildItem(product: ProductRow, variation: VariationRow | null, quantity = 1): OrderDraftItem {
  const trackedStock = variation
    ? (variation.manageStock ? variation.stockQuantity ?? null : null)
    : product.stock
  const max = trackedStock != null && trackedStock > 0 ? trackedStock : null
  return {
    productId: product.id,
    variationId: variation?.id ?? null,
    name: product.name,
    variant: variation ? variationLabel(variation) : null,
    quantity: max != null ? Math.min(quantity, max) : quantity,
    unitPrice: variation?.price ?? product.price ?? null,
    url: product.externalUrl,
    maxQuantity: max,
  }
}

type LoadScope = Pick<OrderCaptureTurnParams, 'agentId' | 'workspaceId' | 'conversationId' | 'cartHold'>

/** Catalog rows as this customer sees them: units other chats hold are taken. */
async function loadProducts(scope: LoadScope, ids: string[]): Promise<ProductRow[]> {
  const parents = [...new Set(ids.map(parentId).filter(Boolean))].slice(0, 20)
  if (!parents.length) return []
  const [rows, held] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: parents }, catalogItems: { some: { agentId: scope.agentId } } },
      select: { id: true, name: true, price: true, stock: true, active: true, attributes: true, externalUrl: true },
    }),
    scope.cartHold ? heldByOthers(scope.workspaceId, scope.conversationId) : Promise.resolve(null),
  ])
  const byId = new Map(rows.map((row) => [row.id, held ? withHeldStock(row, held) : row]))
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
  const offeredProducts = offered.length ? await loadProducts(params, offered) : []

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
    const [product] = await loadProducts(params, [identified[0].id])
    if (product) return { kind: 'picked', product, variationId: variationIdFrom(identified[0].id) }
  }
  if (offeredProducts.length === 1) {
    return { kind: 'picked', product: offeredProducts[0], variationId: variationIdFrom(offered[0]) }
  }
  if (params.activeEntityId) {
    const [product] = await loadProducts(params, [params.activeEntityId])
    if (product) return { kind: 'picked', product, variationId: variationIdFrom(params.activeEntityId) }
  }
  if (offeredProducts.length > 1) return { kind: 'ambiguous', candidates: offeredProducts }
  if (identified.length > 1) return { kind: 'ambiguous', candidates: await loadProducts(params, identified.map((product) => product.id)) }
  // The customer named a product outright («میز جلو مبلی سنگی میخوام بخرم»):
  // the one catalog name fully contained in the message wins.
  const named = await productNamedInMessage(params)
  if (named) return { kind: 'picked', product: named, variationId: null }
  // «یه پاف کرم میخوام بخرم»: this turn's search found exactly one product.
  const parents = [...new Set(params.catalogProducts.filter((row) => !row.unavailable).map((row) => parentId(row.id)))]
  if (parents.length === 1 && detectOrderIntent(params.message)) {
    const [product] = await loadProducts(params, parents)
    if (product) return { kind: 'picked', product, variationId: null }
  }
  return { kind: 'unknown' }
}

function nameTokens(value: string): string[] {
  return normalizeOrderText(value).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/u).filter((token) => token.length >= 2)
}

/**
 * Every catalog product named in full in the message («میز جلو مبلی سنگی و
 * یه کوسن طرح‌دار میخوام»). A name contained in a longer matched name
 * («میز تلویزیون» inside «میز تلویزیون آرتا») does not count separately.
 */
async function productsNamedInMessage(params: OrderCaptureTurnParams): Promise<ProductRow[]> {
  const words = new Set(nameTokens(params.message))
  const catalog = await prisma.product.findMany({
    where: { active: true, catalogItems: { some: { agentId: params.agentId } } },
    select: { id: true, name: true },
    take: 500,
  }).catch(() => [])
  const hits = catalog.filter((row) => {
    const tokens = nameTokens(row.name)
    return tokens.length >= 2 && tokens.every((token) => words.has(token))
  })
  const kept = hits.filter((row) => !hits.some((other) => other !== row
    && nameTokens(other.name).length > nameTokens(row.name).length
    && nameTokens(row.name).every((token) => nameTokens(other.name).includes(token))))
  if (kept.length < 2) return []
  return loadProducts(params, kept.map((row) => row.id))
}

/**
 * The single product whose every name word (at least two) appears in the
 * message. Searches this turn's rows first, then the agent's catalog names.
 */
async function productNamedInMessage(params: OrderCaptureTurnParams): Promise<ProductRow | null> {
  const words = new Set(nameTokens(params.message))
  const matches = (name: string) => {
    const tokens = nameTokens(name)
    return tokens.length >= 2 && tokens.every((token) => words.has(token))
  }
  const fromTurn = [...new Set(params.catalogProducts.filter((row) => matches(row.name)).map((row) => parentId(row.id)))]
  if (fromTurn.length === 1) return (await loadProducts(params, fromTurn))[0] ?? null
  if (fromTurn.length > 1) return null
  const catalog = await prisma.product.findMany({
    where: { active: true, catalogItems: { some: { agentId: params.agentId } } },
    select: { id: true, name: true },
    take: 500,
  }).catch(() => [])
  const hits = catalog.filter((row) => matches(row.name))
  // «میز تلویزیون آرتا» also contains «میز تلویزیون»: prefer the longest name.
  hits.sort((left, right) => nameTokens(right.name).length - nameTokens(left.name).length)
  if (!hits.length || (hits[1] && nameTokens(hits[1].name).length === nameTokens(hits[0].name).length)) return null
  return (await loadProducts(params, [hits[0].id]))[0] ?? null
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
    // Only payment-link carts carry coupons; the classic flow keeps its shape.
    ...(params.checkout ? { coupons: state.coupons ?? [], shippingRateId: state.shippingRateId ?? null, checkoutMode: 'PAY_LINK', integrationId: params.checkout.integrationId } : {}),
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

// ─── Cart edits ─────────────────────────────────────────────────────────────

type CartChange = { added: OrderDraftItem[]; removed: OrderDraftItem[]; updated: OrderDraftItem[] }

function emptyChange(): CartChange {
  return { added: [], removed: [], updated: [] }
}

function changed(change: CartChange): boolean {
  return change.added.length + change.removed.length + change.updated.length > 0
}

/**
 * Apply the customer's cart edit to `state.items`. Every operation is
 * validated against the agent's catalog and live stock; an item that cannot
 * be added is reported, never silently dropped.
 */
async function applyCartEdits(params: OrderCaptureTurnParams, state: OrderDraftState, cue: CartEditCue): Promise<{ change: CartChange; notes: string[] }> {
  const change = emptyChange()
  const notes: string[] = []
  const candidateRows = params.catalogProducts.slice(0, 8)
  const products = await loadProducts(params, [
    ...candidateRows.map((row) => row.id),
    ...params.recentCardIds.slice(0, 4),
    ...state.items.map((item) => item.productId),
  ])
  const byId = new Map(products.map((product) => [product.id, product]))
  const candidateIds = [...new Set([...candidateRows.map((row) => parentId(row.id)), ...params.recentCardIds.slice(0, 4).map(parentId)])]
  const candidates: CartCandidate[] = candidateIds.flatMap((id) => {
    const product = byId.get(id)
    return product ? [{ id: product.id, name: product.name, price: product.price, variants: availableVariations(product).map(variationLabel).filter(Boolean).slice(0, 12) }] : []
  })
  const cartView = state.items.map((item) => ({
    ...item,
    variants: byId.get(item.productId) ? availableVariations(byId.get(item.productId)!).map(variationLabel).filter(Boolean).slice(0, 12) : [],
  }))

  let ops: CartEditOp[] | null = params.cartModel
    ? await planCartEditWithModel({ model: params.cartModel, message: params.message, cart: cartView, candidates }).catch(() => null)
    : null
  if (!ops) {
    const identifiedIds = new Set(candidateRows.filter((row) => row.fullTermMatch).map((row) => parentId(row.id)))
    const identified = candidates.filter((candidate) => identifiedIds.has(candidate.id))
    ops = planCartEditDeterministic({
      cue,
      message: params.message,
      cart: state.items,
      identified: identified.length ? identified : candidates.length === 1 ? candidates : [],
      quantity: extractOrderSlots(params.message, null, []).quantity,
    })
  }

  const removals = new Set<number>()
  for (const op of ops) {
    if (op.op === 'remove') {
      removals.add(op.line - 1)
      continue
    }
    if (op.op === 'set_quantity') {
      const item = state.items[op.line - 1]
      if (!item) continue
      const quantity = item.maxQuantity != null && item.maxQuantity > 0 ? Math.min(op.quantity, item.maxQuantity) : op.quantity
      if (quantity !== item.quantity) {
        item.quantity = quantity
        change.updated.push(item)
      }
      if (quantity < op.quantity) {
        notes.push(params.lang === 'en'
          ? `Only ${quantity} of “${item.name}” are in stock.`
          : `از «${item.name}» فقط ${quantity.toLocaleString('fa-IR')} عدد موجوده.`)
      }
      continue
    }
    if (op.op === 'set_variant') {
      const item = state.items[op.line - 1]
      const product = item ? byId.get(item.productId) : null
      if (!item || !product) continue
      const match = variantFromMessage(product, op.variant, null)
      if (match.kind === 'partial') {
        // «مشکیش کن» on a colour+size product: keep the colour, ask the size.
        const rebuilt = partialItem(product, match, item.quantity)
        state.items[op.line - 1] = rebuilt
        change.updated.push(rebuilt)
        continue
      }
      const variation = match.kind === 'full' ? match.variation : matchVariationRow(availableVariations(product), { label: op.variant })
      if (!variation || !isItemAvailable(product, variation.id)) {
        notes.push(composeItemUnavailable({ name: product.name, variant: op.variant }, params.lang, null))
        continue
      }
      const rebuilt = buildItem(product, variation, item.quantity)
      state.items[op.line - 1] = rebuilt
      change.updated.push(rebuilt)
      continue
    }
    // add
    const product = byId.get(op.productId)
    if (!product || state.items.length >= MAX_CART_LINES) continue
    const match = op.variant
      ? variantFromMessage(product, op.variant, null)
      : variantFromMessage(product, params.message, params.variantHint)
    const variation = match.kind === 'full' ? match.variation : null
    if (!isItemAvailable(product, variation?.id ?? null)) {
      const unavailable = buildItem(product, variation)
      const mode = params.restockEnabled ? restockMode(params.channel, Boolean(state.customerPhone)) : null
      const offer = mode ? restockOfferLine(mode, params.lang) : null
      if (offer) {
        await rememberRestockOffer(params.conversationId, [{
          productId: product.id, variationId: variation?.id ?? null, name: product.name, variant: unavailable.variant,
        }]).catch(() => {})
      }
      notes.push(composeItemUnavailable(unavailable, params.lang, offer))
      continue
    }
    const existing = state.items.find((item) => item.productId === product.id && item.variationId === (variation?.id ?? null))
    if (existing) {
      const max = existing.maxQuantity
      existing.quantity = max != null && max > 0 ? Math.min(existing.quantity + op.quantity, max) : existing.quantity + op.quantity
      change.updated.push(existing)
    } else {
      const item = variation ? buildItem(product, variation, op.quantity) : partialItem(product, match, op.quantity)
      state.items.push(item)
      change.added.push(item)
    }
  }
  if (removals.size) {
    const kept: OrderDraftItem[] = []
    state.items.forEach((item, index) => {
      if (removals.has(index)) change.removed.push(item)
      else kept.push(item)
    })
    state.items = kept
  }
  return { change, notes }
}

// ─── Variants ───────────────────────────────────────────────────────────────

type VariantStep =
  | { kind: 'ok'; changed: boolean }
  | { kind: 'ask'; line: number; options: string[]; attribute: string | null }
  | { kind: 'reply'; text: string }

/**
 * Resolve the variant of the first line that still needs one. The customer's
 * message may name it (or part of it: «مشکی» on a colour+size product keeps
 * the colour and asks only the size); a single available variant is taken
 * automatically.
 */
async function resolveVariants(params: OrderCaptureTurnParams, state: OrderDraftState, draftId: string | null): Promise<VariantStep> {
  let anyChange = false
  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index]
    if (item.variationId != null) continue
    const [product] = await loadProducts(params, [item.productId])
    if (!product) continue
    const all = extractTypedVariations(product.attributes)
    if (!all.length) continue
    const available = availableVariations(product)
    // A partial choice from an earlier turn rides along as the line's label.
    const match = variantFromMessage(product, params.message, params.variantHint, item.variant)
    if (match.kind === 'full' && available.some((variation) => variation.id === match.variation.id)) {
      state.items[index] = buildItem(product, match.variation, item.quantity)
      anyChange = true
      continue
    }
    const soldOut = match.kind === 'full'
      ? { name: product.name, variant: variationLabel(match.variation), variationId: match.variation.id }
      : match.kind === 'partial' && !match.candidates.some(isVariationAvailable)
        ? { name: product.name, variant: fixedLabel(match.fixed), variationId: null }
        : null
    if (soldOut) {
      // The named variant exists but is sold out: say so, keep the cart.
      const mode = params.restockEnabled ? restockMode(params.channel, Boolean(state.customerPhone)) : null
      const offer = mode ? restockOfferLine(mode, params.lang) : null
      if (offer && soldOut.variationId != null) {
        await rememberRestockOffer(params.conversationId, [{
          productId: product.id, variationId: soldOut.variationId, name: product.name, variant: soldOut.variant,
        }]).catch(() => {})
      }
      state.expecting = 'variant'
      await saveDraft(params, draftId, state)
      const alternatives = available.map(variationLabel).filter(Boolean)
      const tail = alternatives.length
        ? (params.lang === 'en' ? `\nAvailable: ${alternatives.slice(0, 8).join(', ')}` : `\nمدل‌های موجود: ${alternatives.slice(0, 8).join('، ')}`)
        : ''
      return { kind: 'reply', text: `${composeItemUnavailable(soldOut, params.lang, soldOut.variationId != null ? offer : null)}${tail}` }
    }
    const pool = match.kind === 'partial' ? match.candidates.filter(isVariationAvailable) : available
    if (pool.length === 1) {
      state.items[index] = buildItem(product, pool[0], item.quantity)
      anyChange = true
      continue
    }
    if (pool.length > 1) {
      const fixed = match.kind === 'partial' ? match.fixed : {}
      if (match.kind === 'partial') {
        const label = fixedLabel(fixed) || null
        if (label !== item.variant) anyChange = true
        state.items[index] = { ...item, variant: label }
      }
      // Ask one option at a time («کدوم سایز؟»), not every combination.
      const next = nextVariantQuestion(pool, fixed)
      return next
        ? { kind: 'ask', line: index, options: next.values, attribute: next.attribute }
        : { kind: 'ask', line: index, options: pool.map(variationLabel).filter(Boolean), attribute: null }
    }
    // Every variant is sold out.
    state.items.splice(index, 1)
    return { kind: 'reply', text: composeItemUnavailable({ name: product.name, variant: null }, params.lang, null) }
  }
  return { kind: 'ok', changed: anyChange }
}

// ─── Payment link helpers ───────────────────────────────────────────────────

function summaryQuote(view: DraftQuoteView | null): SummaryQuote | null {
  return view
    ? { shipping: view.shipping, discount: view.discount, total: view.total, gateways: view.gateways, couponErrors: view.couponErrors, shippingChangeable: (view.rates?.length ?? 0) > 1 }
    : null
}

/** Shipping methods of the draft's last store quote. */
function quotedShippingOptions(quote: Prisma.JsonValue | null | undefined): ShippingOption[] {
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) return []
  const rates = (quote as Record<string, unknown>).rates
  if (!Array.isArray(rates)) return []
  return rates.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const rate = raw as Record<string, unknown>
    if (typeof rate.id !== 'string' || !rate.id) return []
    return [{ id: rate.id, label: String(rate.label || rate.id).slice(0, 80), cost: Number(rate.cost) || 0 }]
  }).slice(0, 8)
}

/** Drop lines the store reported as unavailable; returns their labels. */
function dropUnavailable(state: OrderDraftState, view: DraftQuoteView | null): string[] {
  const lines = view?.quote.items ?? []
  if (!lines.length || lines.length !== state.items.length) return []
  const dropped: string[] = []
  state.items = state.items.filter((item, index) => {
    if (lines[index]?.available !== false) return true
    dropped.push(item.variant ? `${item.name} — ${item.variant}` : item.name)
    return false
  })
  return dropped
}

function soldOutNote(labels: string[], lang: OrderLang): string {
  return lang === 'en'
    ? `“${labels.join('”, “')}” just sold out on the store, so I removed it from the cart.`
    : `«${labels.join('»، «')}» همین الان روی سایت ناموجود شد و از سبد برداشتمش.`
}

async function checkoutService() {
  return import('@/lib/commerce/checkout-service')
}

type OpenCheckoutOutcome = OrderCaptureOutcome | { kind: 'reopen'; row: DraftRow }

/**
 * A payment link is out and unpaid. The customer may say they paid, ask for
 * the link again, cancel, or change the cart (which re-opens it as a fresh
 * draft with a new code; the old unpaid store order is cancelled).
 */
async function openCheckoutTurn(params: OrderCaptureTurnParams, open: OpenCheckoutRow, ctx: CheckoutContext): Promise<OpenCheckoutOutcome | null> {
  const lang = params.lang
  const svc = await checkoutService()
  const closed = open.status === 'EXPIRED' || open.status === 'CANCELLED'
  // A closed (expired / cancelled) link only answers «send the link again»
  // and new order intents by re-opening the cart; everything else is a
  // normal turn.
  if (closed && !isLinkRequest(params.message) && !detectOrderIntent(params.message) && !detectCartEditCue(params.message)) return null
  const expired = closed || Boolean(open.linkExpiresAt && open.linkExpiresAt.getTime() <= Date.now())
  const card = () => svc.buildCheckoutCard(open, ctx.storeUrl, lang)

  if (isPaymentClaim(params.message)) {
    const fresh = await svc.refreshCheckoutStatus(open.id, { notify: false })
    const status = fresh?.status ?? open.status
    if (status === 'PAID' || status === 'ON_HOLD') {
      const text = svc.composeStatusNotice({
        status,
        code: open.code,
        orderNumber: fresh?.orderNumber ?? open.externalOrderNumber,
        total: fresh?.total ?? open.grandTotal,
        paymentTitle: fresh?.paymentTitle ?? open.paymentMethodTitle,
        lang,
      })
      if (text) return { kind: 'reply', text, draftId: open.id }
    }
    const current = card()
    const text = lang === 'en'
      ? `I don't see the store's payment confirmation for order ${open.code} yet. If you completed the payment, confirmation usually arrives within a few minutes and I'll tell you right here. If you left the payment page midway, you can pay with the same link:`
      : `هنوز تأیید پرداخت سفارش ${open.code} از سایت فروشگاه نرسیده. اگه پرداخت رو کامل کردید، معمولاً تا چند دقیقه تأییدش می‌رسه و همین‌جا خبرتون می‌کنم. اگه وسط کار از صفحهٔ پرداخت خارج شدید، با همین لینک دوباره پرداخت کنید:`
    return { kind: 'reply', text: current && !expired ? `${text}\n${checkoutMarker(current)}` : text, draftId: open.id }
  }

  const cue = detectCartEditCue(params.message)
  const cancel = isOrderCancellation(params.message) && cue !== 'remove' && cue !== 'add'
  if (cancel) {
    await prisma.orderDraft.update({ where: { id: open.id }, data: { status: 'CANCELLED', expecting: null, resolvedAt: new Date() } })
    await svc.cancelCheckoutOnStore(open.id)
    return { kind: 'reply', text: composeOrderCancelled(lang), draftId: open.id }
  }

  if (isLinkRequest(params.message) && !expired) {
    const current = card()
    if (current) {
      const text = lang === 'en' ? `Here is the payment link for order ${open.code} again:` : `اینم دوباره لینک پرداخت سفارش ${open.code}:`
      return { kind: 'reply', text: `${text}\n${checkoutMarker(current)}`, draftId: open.id }
    }
  }

  if (cue || detectOrderIntent(params.message) || (isLinkRequest(params.message) && expired)) {
    // Re-open the cart as a new draft: the old link must never pay for a
    // cart the customer has since changed.
    const created = await prisma.orderDraft.create({
      data: {
        code: newDraftCode(),
        workspaceId: params.workspaceId,
        agentId: params.agentId,
        conversationId: params.conversationId,
        contactId: params.contactId,
        channel: params.channel,
        status: 'AWAITING_CONFIRM',
        items: open.items as Prisma.InputJsonValue,
        customerName: open.customerName,
        customerPhone: open.customerPhone,
        city: open.city,
        address: open.address,
        postalCode: open.postalCode,
        note: open.note,
        expecting: 'confirm',
        coupons: open.coupons ?? [],
        shippingRateId: open.shippingRateId ?? null,
        checkoutMode: 'PAY_LINK',
        integrationId: ctx.integrationId,
      },
    })
    await prisma.orderDraft.update({ where: { id: open.id }, data: { status: 'SUPERSEDED', expecting: null, resolvedAt: new Date() } })
    await svc.cancelCheckoutOnStore(open.id)
    return { kind: 'reopen', row: created as unknown as DraftRow }
  }

  // Anything else: the reply model answers, grounded in the link's real state.
  const items = parseItems(open.items)
  const statusLabel = open.status === 'PAYMENT_FAILED'
    ? (lang === 'en' ? 'the last payment attempt failed' : 'تلاش قبلی پرداخت ناموفق بود')
    : (lang === 'en' ? 'waiting for payment' : 'در انتظار پرداخت')
  const total = open.grandTotal != null ? formatToman(open.grandTotal, lang) : null
  const instruction = lang === 'en'
    ? `=== Payment link pending ===\nThe customer has a payment link for order ${open.code} (${items.map((item) => itemLine(item, 'en')).join(', ')}${total ? `, ${total}` : ''}); status: ${statusLabel}${expired ? ' (the link has expired)' : ''}. If they ask about paying, tell them payment happens through that link on the store's own website and the confirmation arrives here right after. Never say the order is paid. If they want to change the cart, tell them to just say what to add or remove.`
    : `=== لینک پرداخت در جریان است ===\nبرای مشتری لینک پرداخت سفارش ${open.code} (${items.map((item) => itemLine(item, 'fa')).join('، ')}${total ? `، ${total}` : ''}) فرستاده شده؛ وضعیت: ${statusLabel}${expired ? ' (مهلت لینک تمام شده)' : ''}. اگر درباره پرداخت پرسید، بگو پرداخت از همان لینک روی سایت خود فروشگاه انجام می‌شود و تأییدش همین‌جا می‌رسد. هرگز نگو سفارش پرداخت شده. اگر خواست سبد را تغییر دهد، بگو کافی است بگوید چه چیزی اضافه یا کم شود.`
  if (isQuestion(params.message)) return { kind: 'instruct', instruction, draftId: open.id }
  return null
}

// ─── Turn resolver ──────────────────────────────────────────────────────────

export async function resolveOrderCaptureTurn(params: OrderCaptureTurnParams): Promise<OrderCaptureOutcome> {
  const outcome = await resolveCartTurn(params)
  // The first reply that shows a cart with items also says until when it is held.
  if (!params.cartHold || outcome.kind !== 'reply' || !outcome.draftId) return outcome
  const holdLine = await startCartHold(outcome.draftId, params.lang)
  return holdLine ? { ...outcome, text: `${outcome.text}\n${holdLine}` } : outcome
}

async function resolveCartTurn(params: OrderCaptureTurnParams): Promise<OrderCaptureOutcome> {
  if (!params.enabled) return { kind: 'none' }
  const checkout = params.checkout ?? null
  const payLink = Boolean(checkout)
  let row = await loadActiveOrderDraft(params.conversationId)
  const lang = params.lang

  if (!row && checkout) {
    const open = await loadOpenCheckout(params.conversationId)
    if (open) {
      const outcome = await openCheckoutTurn(params, open, checkout)
      if (outcome?.kind === 'reopen') row = outcome.row
      else if (outcome) return outcome
    }
  }

  let state: OrderDraftState
  let draftId: string | null = row?.id ?? null
  let opening = false
  const cue = row ? detectCartEditCue(params.message) : null

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
      coupons: [],
    }
  } else {
    state = toState(row)
    // «پاف رو نمی‌خوام» in a multi-line cart removes that line; the same words
    // in a one-line cart (or a bare «نمی‌خوام») cancel the whole order.
    const removesOneLine = cue === 'remove' && state.items.length > 1
    if (!removesOneLine && cue !== 'add' && isOrderCancellation(params.message)) {
      state.status = 'CANCELLED'
      state.expecting = null
      await prisma.orderDraft.update({ where: { id: row.id }, data: { status: 'CANCELLED', expecting: null, resolvedAt: new Date() } })
      return { kind: 'reply', text: composeOrderCancelled(lang), draftId: row.id }
    }
  }

  // ── Cart edits («یه پاف هم اضافه کن»، «میز رو حذف کن»، «دوتا کن») ──────
  let change = emptyChange()
  const notes: string[] = []
  if (row && state.items.length && cue) {
    const edit = await applyCartEdits(params, state, cue)
    change = edit.change
    notes.push(...edit.notes)
    if (!state.items.length && changed(change)) {
      state.status = 'COLLECTING'
      state.expecting = 'product'
      draftId = await saveDraft(params, draftId, state)
      const prefix = composeCartChange(change, lang)
      return { kind: 'reply', text: `${prefix}\n${lang === 'en' ? 'Your cart is empty now. What would you like instead?' : 'سبدتون الان خالیه؛ چه محصولی رو جاش بذارم؟'}`, draftId }
    }
  }
  const edited = changed(change)

  // ── First product (and its variant) ────────────────────────────────────
  let productChanged = false
  if (!state.items.length) {
    const choice = await resolveProductChoice(params)
    if (choice.kind === 'picked') {
      const { product } = choice
      const match: VariantMatch = choice.variationId != null
        ? (() => {
            const byId = extractTypedVariations(product.attributes).find((variation) => variation.id === choice.variationId)
            return byId ? { kind: 'full', variation: byId } as const : { kind: 'none' } as const
          })()
        : variantFromMessage(product, params.message, params.variantHint)
      const pinned = match.kind === 'full' ? match.variation : null
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
      state.items = [pinned ? buildItem(product, pinned) : partialItem(product, match)]
      productChanged = true
      // Several products named at once: every available one joins the cart.
      if (opening) {
        for (const extra of await productsNamedInMessage(params)) {
          if (extra.id === product.id || state.items.length >= MAX_CART_LINES) continue
          const extraMatch = variantFromMessage(extra, params.message, null)
          const variation = extraMatch.kind === 'full' ? extraMatch.variation : null
          if (!isItemAvailable(extra, variation?.id ?? null)) {
            notes.push(composeItemUnavailable(buildItem(extra, variation), lang, null))
            continue
          }
          state.items.push(variation ? buildItem(extra, variation) : partialItem(extra, extraMatch))
        }
      }
    } else if (choice.kind === 'ambiguous') {
      state.expecting = 'product'
      draftId = await saveDraft(params, draftId, state)
      return { kind: 'reply', text: composeProductQuestion(choice.candidates, lang), draftId }
    }
  }

  // ── Variants (first line that still needs one) ─────────────────────────
  let needsVariant = false
  let variantLine = 0
  let variantOptions: string[] = []
  let variantAttribute: string | null = null
  if (state.items.length) {
    const step = await resolveVariants(params, state, draftId)
    if (step.kind === 'reply') {
      if (!state.items.length && draftId) {
        await prisma.orderDraft.update({ where: { id: draftId }, data: { status: 'CANCELLED', expecting: null, resolvedAt: new Date() } })
      } else if (state.items.length && (draftId || opening)) {
        draftId = await saveDraft(params, draftId, state)
      }
      return { kind: 'reply', text: step.text, draftId: draftId ?? '' }
    }
    if (step.kind === 'ask') {
      needsVariant = true
      variantLine = step.line
      variantOptions = step.options
      variantAttribute = step.attribute
    } else if (step.changed) {
      productChanged = true
    }
  }

  // ── Customer fields (+ coupon) ─────────────────────────────────────────
  const missingBefore = missingOrderSlots(state, needsVariant)
  const slots = extractOrderSlots(params.message, state.expecting, missingBefore)
  // The purchase-intent message itself («میخوام بخرمش») and a product /
  // variant pick («آبی»، «دومی») are never the customer's name.
  if ((opening || productChanged || edited) && slots.name && !slots.phone && !slots.address) delete slots.name
  // The purchase-intent message itself («یه پاف کرم میخوام بخرم») is not a
  // street-less address answer; addresses on the opening turn need a phone
  // or street cue alongside (a real details message).
  if (opening && !slots.phone && slots.address && !/(?:خیابان|خیابون|کوچه|پلاک|بلوار|میدان|میدون|محله|شهرک|street|avenue|alley)/u.test(slots.address)) {
    delete slots.address
    delete slots.city
  }
  // A cart-edit message («یه آباژور هم بذار») is never a name/address/city
  // answer, and its quantity is already applied; only shape-certain values
  // (mobile, postal code) may ride along.
  if (edited || (cue && notes.length)) {
    delete slots.quantity
    delete slots.name
    delete slots.address
    delete slots.city
  }
  let slotChanged = applyOrderSlots(state, slots)
  if (payLink) {
    const coupon = extractCouponCode(params.message)
    if (coupon && !(state.coupons ?? []).includes(coupon)) {
      state.coupons = [...(state.coupons ?? []), coupon].slice(-3)
      slotChanged = true
    }
  }

  // ── Shipping method (the store's own methods for this address) ────────
  // Right after the list: a number or a name picks one. At the summary: a
  // method's name switches to it; «روش ارسال رو عوض کنم» shows the list again.
  const listedShipping = payLink && state.expecting === 'shipping'
  if (payLink && row && (listedShipping || (state.status === 'AWAITING_CONFIRM' && !slotChanged && !edited))) {
    const options = quotedShippingOptions(row.quote)
    const shortMessage = normalizeOrderText(params.message).split(/\s+/u).length <= 4
    const pick = options.length > 1 && (listedShipping || shortMessage || mentionsShippingMethod(params.message))
      ? matchShippingChoice(params.message, options, listedShipping)
      : null
    if (pick && pick.id !== state.shippingRateId) {
      state.shippingRateId = pick.id
      slotChanged = true
    } else if (!pick && !listedShipping && options.length > 1 && mentionsShippingMethod(params.message)) {
      state.shippingRateId = null
      slotChanged = true
    }
  }
  const anyChange = productChanged || slotChanged || edited

  // ── Confirmation step ──────────────────────────────────────────────────
  if (row && state.status === 'AWAITING_CONFIRM' && !slotChanged && !edited) {
    if (isOrderConfirmation(params.message) && missingOrderSlots(state, needsVariant).length === 0) {
      if (checkout) {
        const svc = await checkoutService()
        let view: DraftQuoteView | null = null
        if (!svc.quoteIsFresh(row.quotedAt ?? null)) view = await svc.quoteDraft(checkout, row.id, state, state.coupons ?? [])
        const soldOut = dropUnavailable(state, view)
        if (soldOut.length) {
          state.expecting = 'confirm'
          await saveDraft(params, row.id, state)
          if (!state.items.length) {
            await prisma.orderDraft.update({ where: { id: row.id }, data: { status: 'CANCELLED', expecting: null, resolvedAt: new Date() } })
            return { kind: 'reply', text: soldOutNote(soldOut, lang), draftId: row.id }
          }
          const requote = await svc.quoteDraft(checkout, row.id, state, state.coupons ?? [])
          if (requote?.needsShipping && requote.rates) {
            state.status = 'COLLECTING'
            state.expecting = 'shipping'
            await saveDraft(params, row.id, state)
            return { kind: 'reply', text: `${soldOutNote(soldOut, lang)}\n${composeShippingQuestion(requote.rates, lang)}`, draftId: row.id }
          }
          return { kind: 'reply', text: `${soldOutNote(soldOut, lang)}\n${composeOrderSummary(state, lang, true, summaryQuote(requote), true)}`, draftId: row.id }
        }
        // The chosen method is gone (zone rules changed): pick again.
        if (view?.needsShipping && view.rates) {
          state.status = 'COLLECTING'
          state.expecting = 'shipping'
          await saveDraft(params, row.id, state)
          return { kind: 'reply', text: composeShippingQuestion(view.rates, lang), draftId: row.id }
        }
        const link = checkout.storeDisabled ? null : await svc.issueCheckoutLink(checkout, row.id, state, lang)
        if (link) return { kind: 'reply', text: link.text, draftId: row.id }
        // The cart cannot be paid on the store (unsynced item): file it for people.
      }
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
  const prefix = [edited ? composeCartChange(change, lang) : '', ...notes].filter(Boolean).join('\n')
  const withPrefix = (text: string) => (prefix ? `${prefix}\n${text}` : text)

  // A mid-order question («ارسالش چند روزه؟») is answered by the model,
  // which then reminds the one next step.
  if (!opening && !anyChange && !notes.length && isQuestion(params.message)) {
    draftId = await saveDraft(params, draftId, state)
    const pending: OrderSlot[] = listedShipping && !state.shippingRateId ? [...missing, 'shipping'] : missing
    return { kind: 'instruct', instruction: orderInProgressInstruction(state, pending, lang), draftId }
  }

  if (missing.includes('product')) {
    state.expecting = 'product'
    draftId = await saveDraft(params, draftId, state)
    const noted = slotChanged
      ? (lang === 'en' ? 'Got your details ✅ ' : 'اطلاعاتتون ثبت شد ✅ ')
      : ''
    return { kind: 'reply', text: withPrefix(`${noted}${composeProductQuestion([], lang)}`), draftId }
  }
  if (missing.includes('variant') && state.items[variantLine]) {
    state.expecting = 'variant'
    draftId = await saveDraft(params, draftId, state)
    return { kind: 'reply', text: withPrefix(composeVariantQuestion(state.items[variantLine], variantOptions, lang, variantAttribute)), draftId }
  }
  if (missing.length === 0) {
    const corrected = state.status === 'AWAITING_CONFIRM' && (slotChanged || edited)
    state.status = 'AWAITING_CONFIRM'
    state.expecting = 'confirm'
    draftId = await saveDraft(params, draftId, state)
    let quote: SummaryQuote | null = null
    let soldOut: string[] = []
    let view: DraftQuoteView | null = null
    if (checkout) {
      const svc = await checkoutService()
      view = await svc.quoteDraft(checkout, draftId, state, state.coupons ?? [])
      soldOut = dropUnavailable(state, view)
      if (soldOut.length) {
        await saveDraft(params, draftId, state)
        view = state.items.length ? await svc.quoteDraft(checkout, draftId, state, state.coupons ?? []) : null
      }
      quote = summaryQuote(view)
    }
    if (checkout && !state.items.length) {
      state.status = 'COLLECTING'
      state.expecting = 'product'
      await saveDraft(params, draftId, state)
      return { kind: 'reply', text: withPrefix(`${soldOutNote(soldOut, lang)}\n${composeProductQuestion([], lang)}`), draftId }
    }
    // Several shipping methods for this address: the customer picks one
    // before the summary (its price is part of the total they confirm).
    if (view?.needsShipping && view.rates) {
      state.status = 'COLLECTING'
      state.expecting = 'shipping'
      await saveDraft(params, draftId, state)
      const ask = composeShippingQuestion(view.rates, lang, listedShipping && !anyChange)
      return { kind: 'reply', text: withPrefix(soldOut.length ? `${soldOutNote(soldOut, lang)}\n${ask}` : ask), draftId }
    }
    const summary = composeOrderSummary(state, lang, corrected, quote, payLink && !checkout?.storeDisabled)
    return { kind: 'reply', text: withPrefix(soldOut.length ? `${soldOutNote(soldOut, lang)}\n${summary}` : summary), draftId }
  }
  const unparsed = !opening && !anyChange
  state.status = 'COLLECTING'
  state.expecting = missing[0]
  draftId = await saveDraft(params, draftId, state)
  return {
    kind: 'reply',
    // After a cart edit the next ask is neutral («فقط … لازمه»), not a thank-you.
    text: withPrefix(composeOrderAsk({ draft: state, missing, lang, opening: opening || (productChanged && !slotChanged && !edited), unparsed: (unparsed && !notes.length) || (edited && !slotChanged) })),
    draftId,
  }
}
