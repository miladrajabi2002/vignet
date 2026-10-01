/**
 * In-chat checkout — the DB/network half.
 *
 *   quote   → live prices, shipping and coupons from the store (optional)
 *   link    → OrderDraft becomes LINK_SENT with an unguessable slug
 *   resolve → the store plugin redeems the slug (HMAC-signed) on click
 *   events  → the plugin pushes order status; the customer is told in the
 *             same conversation («پرداخت شد ✅») and the team is alerted.
 *
 * Nothing here trusts the customer's words about payment: PAID comes only
 * from the store's signed event or its signed status answer.
 */
import { Prisma, type ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { readBotToken } from '@/lib/channels/config'
import { readPageToken } from '@/lib/instagram/config'
import { getAdapter, isMessengerType } from '@/lib/channels/registry'
import { notifyWorkspace } from '@/lib/notifications/create'
import {
  checkoutMarker,
  composeCheckoutFallback,
  composeLinkMessage,
  formatToman,
  isValidLinkSlug,
  itemLine,
  newLinkSlug,
  parseCheckoutDirective,
  pluginSupportsCheckout,
  storeCheckoutUrl,
  storeHost,
  verifyPayloadSignature,
  type CheckoutCard,
  type StoreQuote,
} from '@/lib/commerce/checkout-link'
import { cancelStoreCheckout, quoteStore, STORE_CHECKOUT_DISABLED, StoreApiError, storeCheckoutStatus, type StoreEndpoint } from '@/lib/commerce/store-api'
import type { OrderDraftItem, OrderDraftState, OrderLang, ShippingOption } from '@/lib/commerce/order-capture'

export const OPEN_CHECKOUT_STATUSES = ['LINK_SENT', 'PAYMENT_PENDING', 'PAYMENT_FAILED']
const QUOTE_FRESH_MS = 15 * 60 * 1000

export interface CheckoutContext {
  integrationId: string
  storeUrl: string
  webhookSecret: string
  flow: string
  ttlHours: number
  /** Set when the store answered that in-chat checkout is switched off (or its
   *  WooCommerce is too old): the conversation falls back to a pre-order. */
  storeDisabled?: boolean
}

// ─── Context ────────────────────────────────────────────────────────────────

/**
 * The WooCommerce connection payment links go through: the most recently
 * active one whose plugin supports checkout. Falls back to the most recent
 * connection (not ready) so the settings page can say what is missing.
 * The settings page and the runtime share this so they never disagree.
 */
export async function findCheckoutIntegration(workspaceId: string) {
  const integrations = await prisma.storeIntegration.findMany({
    where: { workspaceId, type: 'WOOCOMMERCE', active: true, webhookSecret: { not: null } },
    // Postgres sorts NULLs first on DESC; a store that never sent a webhook must not win.
    orderBy: [{ lastWebhookAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: { id: true, storeUrl: true, webhookSecret: true, pluginVersion: true, checkoutFlow: true },
    take: 5,
  })
  const integration = integrations.find((row) => pluginSupportsCheckout(row.pluginVersion)) ?? null
  return { integration, fallback: integration ?? integrations[0] ?? null }
}

/**
 * A WooCommerce plugin that can take payments (5.0+) switches in-chat selling
 * on for every agent whose owner has not chosen yet: taking the order in chat
 * and sending the store's payment link. An owner's own choice is never undone.
 */
export async function enableInChatSellingByDefault(workspaceId: string): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.agent.updateMany({
        where: { workspaceId, orderCaptureConfigured: false, orderCaptureEnabled: false },
        data: { orderCaptureEnabled: true },
      }),
      prisma.agent.updateMany({
        where: { workspaceId, payLinkConfigured: false, payLinkEnabled: false },
        data: { payLinkEnabled: true },
      }),
    ])
  } catch (error) {
    // A database before the migration must not fail the webhook.
    captureError('checkout:selling-defaults', error, { workspaceId })
  }
}

/**
 * The agent sells with payment links only when it is switched on AND the
 * workspace has an active WooCommerce connection running plugin 5.0+.
 * Tolerates a database without the new columns (worker restarts before a
 * migration must degrade to the pre-order flow, never fail the turn).
 */
export async function loadCheckoutContext(workspaceId: string, agentId: string): Promise<CheckoutContext | null> {
  let enabled = false
  let ttlHours = 24
  try {
    const rows = await prisma.$queryRaw<Array<{ payLinkEnabled: boolean; payLinkTtlHours: number }>>`
      SELECT "payLinkEnabled", "payLinkTtlHours" FROM "Agent" WHERE id = ${agentId}`
    enabled = rows[0]?.payLinkEnabled === true
    ttlHours = Math.min(168, Math.max(1, Number(rows[0]?.payLinkTtlHours) || 24))
  } catch {
    return null
  }
  if (!enabled) return null
  const { integration } = await findCheckoutIntegration(workspaceId)
  if (!integration?.webhookSecret) return null
  return {
    integrationId: integration.id,
    storeUrl: integration.storeUrl,
    webhookSecret: integration.webhookSecret,
    flow: integration.checkoutFlow || 'AUTO',
    ttlHours,
  }
}

function endpoint(ctx: Pick<CheckoutContext, 'storeUrl' | 'webhookSecret'>): StoreEndpoint {
  return { storeUrl: ctx.storeUrl, webhookSecret: ctx.webhookSecret }
}

// ─── Cart → store lines ─────────────────────────────────────────────────────

export interface StoreLine {
  product_id: number
  variation_id: number
  quantity: number
  name: string
}

/**
 * Map chat cart items to the store's own product ids. Every item must come
 * from this integration's synced catalog; otherwise the cart cannot be paid
 * on the site and the caller falls back to the operator pre-order.
 */
export async function storeLinesForItems(integrationId: string, items: OrderDraftItem[]): Promise<StoreLine[] | null> {
  if (!items.length) return null
  const rows = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
    select: { id: true, externalId: true, sourceIntegrationId: true },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const lines: StoreLine[] = []
  for (const item of items) {
    const row = byId.get(item.productId)
    const productId = row?.externalId && /^\d+$/.test(row.externalId) ? Number(row.externalId) : 0
    if (!row || row.sourceIntegrationId !== integrationId || !productId) return null
    lines.push({ product_id: productId, variation_id: item.variationId ?? 0, quantity: item.quantity, name: storeLineName(item) })
  }
  return lines
}

/** The label the store echoes back for an unavailable line («پاف مخمل — سرمه‌ای»). */
export function storeLineName(item: Pick<OrderDraftItem, 'name' | 'variant'>): string {
  return item.variant ? `${item.name} — ${item.variant}` : item.name
}

function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? '').trim().split(/\s+/u).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function customerBlock(state: Pick<OrderDraftState, 'customerName' | 'customerPhone' | 'city' | 'address' | 'postalCode'>, province: string | null = null): Record<string, string> {
  const name = splitName(state.customerName)
  return {
    first_name: name.first,
    last_name: name.last,
    phone: state.customerPhone ?? '',
    email: '',
    province: province ?? '',
    city: state.city ?? '',
    address: state.address ?? '',
    postcode: state.postalCode ?? '',
  }
}

// ─── Quote ──────────────────────────────────────────────────────────────────

export interface DraftQuoteView {
  quote: StoreQuote
  shipping: { label: string; cost: number } | null
  discount: number
  total: number | null
  unavailable: string[]
  gateways: string[]
  couponErrors: string[]
  /** The store rate the order uses (see chooseShipping). */
  shippingRateId?: string | null
  /** Every shipping method the store offers for this cart and address. */
  rates?: ShippingOption[]
  /** Several methods and none picked yet: the customer must choose. */
  needsShipping?: boolean
}

function shippingOptions(quote: StoreQuote): ShippingOption[] {
  return (Array.isArray(quote.rates) ? quote.rates : [])
    .filter((rate) => rate && typeof rate.id === 'string' && rate.id)
    .slice(0, 8)
    .map((rate) => ({ id: rate.id, label: String(rate.label || rate.id).slice(0, 80), cost: Number(rate.cost) || 0 }))
}

/**
 * The shipping method the order uses: the customer's pick while the store
 * still offers it, or the store's only method. With several methods and no
 * pick, none is chosen and the customer is asked (the store would otherwise
 * silently take the cheapest).
 */
export function chooseShipping(quote: StoreQuote, pickedId: string | null | undefined): { rates: ShippingOption[]; chosen: ShippingOption | null } {
  const rates = shippingOptions(quote)
  const picked = pickedId ? rates.find((rate) => rate.id === pickedId) ?? null : null
  return { rates, chosen: picked ?? (rates.length === 1 ? rates[0] : null) }
}

export function quoteView(quote: StoreQuote, pickedId?: string | null): DraftQuoteView {
  const { rates, chosen } = chooseShipping(quote, pickedId)
  const needsShipping = rates.length > 1 && !chosen
  const subtotal = Number(quote.subtotal)
  const discount = Number(quote.discount_total) || 0
  // The store's total includes the rate it picked by itself; with a pick
  // pending there is no payable total yet.
  const total = needsShipping
    ? null
    : chosen && Number.isFinite(subtotal)
      ? Math.max(0, subtotal - discount + chosen.cost)
      : typeof quote.total === 'number' ? quote.total : null
  return {
    quote,
    shipping: chosen ? { label: chosen.label, cost: chosen.cost } : null,
    discount,
    total,
    unavailable: Array.isArray(quote.unavailable) ? quote.unavailable : [],
    gateways: Array.isArray(quote.gateways) ? quote.gateways.map((gateway) => gateway.title).filter(Boolean).slice(0, 6) : [],
    couponErrors: Array.isArray(quote.coupon_errors) ? quote.coupon_errors.slice(0, 3) : [],
    shippingRateId: chosen?.id ?? null,
    rates,
    needsShipping,
  }
}

/**
 * Ask the store for a live quote and remember it on the draft. Returns null
 * when the store's REST API is unreachable (WAF, host firewall, old plugin);
 * the summary then says shipping is calculated on the payment page.
 * `state.shippingRateId` is updated to the method the order will use (null
 * while the customer still has to choose one).
 */
export async function quoteDraft(ctx: CheckoutContext, draftId: string, state: OrderDraftState, coupons: string[], province: string | null = null): Promise<DraftQuoteView | null> {
  const items = await storeLinesForItems(ctx.integrationId, state.items)
  if (!items) return null
  let quote: StoreQuote
  try {
    quote = await quoteStore(endpoint(ctx), { items, customer: customerBlock(state, province), coupons, shipping_rate_id: state.shippingRateId ?? null })
  } catch (error) {
    if (error instanceof StoreApiError && error.message === STORE_CHECKOUT_DISABLED) {
      ctx.storeDisabled = true
      return null
    }
    captureError('checkout:quote', error, { metadata: { draftId, integrationId: ctx.integrationId } })
    return null
  }
  if (!quote?.ok) return null
  const view = quoteView(quote, state.shippingRateId)
  const chosenId = view.shippingRateId ?? null
  state.shippingRateId = chosenId
  await prisma.orderDraft.update({
    where: { id: draftId },
    data: {
      integrationId: ctx.integrationId,
      quote: quote as unknown as Prisma.InputJsonValue,
      quotedAt: new Date(),
      shippingRateId: chosenId,
      shippingLabel: view.shipping?.label ?? null,
      shippingTotal: view.shipping?.cost ?? null,
      discountTotal: view.discount || null,
      grandTotal: view.total,
      coupons: Array.isArray(quote.applied_coupons) ? quote.applied_coupons : coupons,
    },
  }).catch((error) => captureError('checkout:quote-save', error, { metadata: { draftId } }))
  return view
}

export function quoteIsFresh(quotedAt: Date | null | undefined, now = Date.now()): boolean {
  return Boolean(quotedAt && now - quotedAt.getTime() < QUOTE_FRESH_MS)
}

// ─── Link ───────────────────────────────────────────────────────────────────

type DraftForCard = {
  code: string
  items: Prisma.JsonValue
  quote: Prisma.JsonValue | null
  shippingLabel: string | null
  shippingTotal: number | null
  discountTotal: number | null
  grandTotal: number | null
  linkSlug: string | null
  linkExpiresAt: Date | null
}

export function parseDraftItems(value: Prisma.JsonValue): OrderDraftItem[] {
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

/** The card a channel renders, built from the draft and its last quote. */
export function buildCheckoutCard(draft: DraftForCard, storeUrl: string, lang: OrderLang): CheckoutCard | null {
  if (!draft.linkSlug) return null
  const items = parseDraftItems(draft.items)
  const quote = draft.quote && typeof draft.quote === 'object' && !Array.isArray(draft.quote) ? draft.quote as unknown as StoreQuote : null
  const priced = new Map<string, number>()
  for (const line of quote?.items ?? []) {
    if (typeof line.unit_price === 'number') priced.set(`${line.product_id}:${line.variation_id}`, line.unit_price)
  }
  const itemsTotal = items.every((item) => item.unitPrice != null)
    ? items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)
    : null
  const total = draft.grandTotal ?? itemsTotal
  return {
    code: draft.code,
    url: storeCheckoutUrl(storeUrl, draft.linkSlug),
    storeHost: storeHost(storeUrl),
    items: items.map((item) => ({
      name: item.name,
      variant: item.variant,
      quantity: item.quantity,
      lineTotal: item.unitPrice != null ? item.unitPrice * item.quantity : null,
    })),
    shipping: draft.shippingLabel ? { label: draft.shippingLabel, cost: draft.shippingTotal ?? 0 } : null,
    discount: draft.discountTotal ?? null,
    total,
    expiresAt: draft.linkExpiresAt?.toISOString() ?? '',
    lang,
  }
}

/**
 * Turn a confirmed draft into a payment link. Returns null when the cart
 * cannot be paid on the store (an item from another source, no mapping),
 * in which case the caller files the classic operator pre-order.
 */
export async function issueCheckoutLink(ctx: CheckoutContext, draftId: string, state: OrderDraftState, lang: OrderLang): Promise<{ text: string; card: CheckoutCard } | null> {
  const lines = await storeLinesForItems(ctx.integrationId, state.items)
  if (!lines) return null
  const now = new Date()
  const draft = await prisma.orderDraft.update({
    where: { id: draftId },
    data: {
      status: 'LINK_SENT',
      checkoutMode: 'PAY_LINK',
      integrationId: ctx.integrationId,
      expecting: null,
      linkSlug: newLinkSlug(),
      linkSentAt: now,
      linkExpiresAt: new Date(now.getTime() + ctx.ttlHours * 3_600_000),
      submittedAt: now,
    },
    select: {
      code: true, items: true, quote: true, shippingLabel: true, shippingTotal: true,
      discountTotal: true, grandTotal: true, linkSlug: true, linkExpiresAt: true,
    },
  })
  const card = buildCheckoutCard(draft, ctx.storeUrl, lang)
  if (!card) return null
  return { text: composeLinkMessage(card, now), card }
}

// ─── Store redeems the link ─────────────────────────────────────────────────

function normalizeSite(raw: string): string {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return ''
  }
}

async function conversationReturnUrl(agentId: string, channel: ChannelType): Promise<string | null> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  if (channel === 'CHAT_LINK') {
    const link = await prisma.chatLink.findUnique({ where: { agentId }, select: { slug: true, enabled: true } })
    return link?.enabled ? `${appUrl}/c/${link.slug}` : null
  }
  if (!['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'].includes(channel)) return null
  const row = await prisma.agentChannel.findFirst({ where: { agentId, type: channel, active: true }, select: { config: true } })
  const config = row?.config && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config as Record<string, unknown> : {}
  const username = typeof config.botUsername === 'string' ? config.botUsername.replace(/^@/, '').trim() : ''
  if (!/^[A-Za-z0-9_.]{3,64}$/.test(username)) return null
  if (channel === 'TELEGRAM') return `https://t.me/${username}`
  if (channel === 'BALE') return `https://ble.ir/${username}`
  if (channel === 'RUBIKA') return `https://rubika.ir/${username}`
  return `https://ig.me/m/${username}`
}

export type ResolveResult = { status: number; body: Record<string, unknown> }

/**
 * POST /api/commerce/checkout/resolve — the store plugin asks for the cart
 * behind a slug. Authenticated by the store's own webhook secret; a store can
 * only ever redeem links issued for itself.
 */
export async function resolveCheckoutSlug(params: {
  rawBody: string
  timestamp: string | null
  signature: string | null
}): Promise<ResolveResult> {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(params.rawBody) as Record<string, unknown>
  } catch {
    return { status: 400, body: { ok: false, error: 'BAD_JSON' } }
  }
  if (!isValidLinkSlug(body.slug)) return { status: 400, body: { ok: false, error: 'BAD_SLUG' } }
  const draft = await prisma.orderDraft.findUnique({
    where: { linkSlug: body.slug },
    select: {
      id: true, code: true, status: true, items: true, customerName: true, customerPhone: true,
      city: true, address: true, postalCode: true, note: true, province: true, coupons: true,
      shippingRateId: true, linkExpiresAt: true, integrationId: true, agentId: true, channel: true,
    },
  })
  if (!draft?.integrationId) return { status: 404, body: { ok: false, error: 'NOT_FOUND' } }
  const integration = await prisma.storeIntegration.findUnique({
    where: { id: draft.integrationId },
    select: { storeUrl: true, webhookSecret: true, checkoutFlow: true, active: true },
  })
  if (!integration?.webhookSecret || !integration.active) return { status: 404, body: { ok: false, error: 'NOT_FOUND' } }
  if (!verifyPayloadSignature({ secret: integration.webhookSecret, timestamp: params.timestamp, signature: params.signature, body: params.rawBody })) {
    return { status: 401, body: { ok: false, error: 'BAD_SIGNATURE' } }
  }
  if (typeof body.site_url === 'string' && normalizeSite(body.site_url) !== normalizeSite(integration.storeUrl)) {
    return { status: 403, body: { ok: false, error: 'SITE_MISMATCH' } }
  }
  const returnUrl = await conversationReturnUrl(draft.agentId, draft.channel).catch(() => null)
  const now = new Date()
  if (['PAID', 'ON_HOLD'].includes(draft.status)) return { status: 200, body: { ok: false, error: 'PAID', return_url: returnUrl } }
  if (['CANCELLED', 'SUPERSEDED', 'REFUNDED'].includes(draft.status)) return { status: 200, body: { ok: false, error: 'CANCELLED', return_url: returnUrl } }
  if (draft.status === 'EXPIRED' || (draft.linkExpiresAt && draft.linkExpiresAt < now)) {
    if (draft.status !== 'EXPIRED') {
      await prisma.orderDraft.update({ where: { id: draft.id }, data: { status: 'EXPIRED', resolvedAt: now } }).catch(() => {})
    }
    return { status: 200, body: { ok: false, error: 'EXPIRED', return_url: returnUrl } }
  }
  if (!OPEN_CHECKOUT_STATUSES.includes(draft.status)) return { status: 200, body: { ok: false, error: 'NOT_FOUND' } }

  const items = parseDraftItems(draft.items)
  const lines = await storeLinesForItems(draft.integrationId, items)
  if (!lines) return { status: 200, body: { ok: false, error: 'NOT_FOUND' } }
  await prisma.orderDraft.update({
    where: { id: draft.id },
    data: { clickCount: { increment: 1 }, linkClickedAt: now },
  }).catch(() => {})
  const flow = integration.checkoutFlow === 'CART' ? 'cart' : integration.checkoutFlow === 'ORDER_PAY' ? 'order_pay' : ''
  return {
    status: 200,
    body: {
      ok: true,
      code: draft.code,
      flow,
      channel: draft.channel,
      return_url: returnUrl,
      expires_at: draft.linkExpiresAt ? Math.floor(draft.linkExpiresAt.getTime() / 1000) : 0,
      items: lines,
      customer: customerBlock(draft, draft.province),
      shipping_rate_id: draft.shippingRateId ?? '',
      coupons: draft.coupons,
      note: draft.note ?? '',
    },
  }
}

// ─── Store → Vigent status events ───────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  LINK_SENT: 1, PAYMENT_PENDING: 2, PAYMENT_FAILED: 3, EXPIRED: 4, CANCELLED: 4,
  ON_HOLD: 5, PAID: 6, REFUNDED: 7,
}

/** Gateways that register an order without taking the money online. */
const OFFLINE_METHODS = new Set(['cod', 'bacs', 'cheque'])

/**
 * WooCommerce order status → draft status. Cash-on-delivery orders go to
 * «processing» without any payment, so they are ON_HOLD (placed, unpaid),
 * never PAID.
 */
export function draftStatusForOrder(wcStatus: string, paid: boolean, expired: boolean, paymentMethod = ''): string | null {
  if (wcStatus === 'refunded') return 'REFUNDED'
  if (OFFLINE_METHODS.has(paymentMethod) && ['processing', 'on-hold'].includes(wcStatus)) return 'ON_HOLD'
  if (wcStatus === 'completed' && OFFLINE_METHODS.has(paymentMethod)) return 'PAID'
  if (paid || wcStatus === 'processing' || wcStatus === 'completed') return 'PAID'
  if (wcStatus === 'on-hold') return 'ON_HOLD'
  if (wcStatus === 'failed') return 'PAYMENT_FAILED'
  if (wcStatus === 'cancelled') return expired ? 'EXPIRED' : 'CANCELLED'
  if (wcStatus === 'pending' || wcStatus === 'checkout-draft') return 'PAYMENT_PENDING'
  return null
}

/** Whether moving from `from` to `to` is progress (events may arrive out of order). */
export function acceptsTransition(from: string, to: string): boolean {
  if (from === to) return false
  if (to === 'REFUNDED') return from === 'PAID' || from === 'ON_HOLD'
  if (from === 'PAID') return false
  if (to === 'PAYMENT_PENDING' && ['PAYMENT_FAILED', 'ON_HOLD'].includes(from)) return false
  if (from === 'PAYMENT_FAILED' && ['PAID', 'ON_HOLD', 'CANCELLED', 'EXPIRED'].includes(to)) return true
  return (STATUS_RANK[to] ?? 0) >= (STATUS_RANK[from] ?? 0)
}

export function composeStatusNotice(params: {
  status: string
  code: string
  orderNumber: string | null
  total: number | null
  paymentTitle: string | null
  lang: OrderLang
}): string | null {
  const { status, lang } = params
  const number = params.orderNumber ? (lang === 'en' ? `#${params.orderNumber}` : `#${params.orderNumber}`) : params.code
  const amount = params.total != null ? formatToman(params.total, lang) : null
  if (lang === 'en') {
    if (status === 'PAID') return `Payment received ✅\nOrder ${number} is registered on the store${amount ? ` (${amount}${params.paymentTitle ? `, ${params.paymentTitle}` : ''})` : ''}.\nI'll let you know here as soon as it ships.`
    if (status === 'ON_HOLD') return `Your order ${number} is registered ✅${params.paymentTitle ? `\nPayment method: ${params.paymentTitle}` : ''}\nThe store will get it ready and I'll keep you posted here.`
    if (status === 'PAYMENT_FAILED') return `The payment didn't go through 😕 If money left your account, the bank returns it within 72 hours.\nYou can try again with the same link:`
    if (status === 'EXPIRED') return `The payment link for order ${params.code} has expired. If you still want it, just tell me and I'll set it up again.`
    if (status === 'CANCELLED') return `Order ${number} was cancelled. If you'd like to order again, just tell me.`
    if (status === 'REFUNDED') return `Order ${number} has been refunded.`
    return null
  }
  if (status === 'PAID') return `پرداخت با موفقیت انجام شد ✅\nسفارش ${number} روی سایت ثبت شد${amount ? ` (${amount}${params.paymentTitle ? ` — ${params.paymentTitle}` : ''})` : ''}.\nهر خبری از ارسالش شد همین‌جا بهتون می‌گم 🙏`
  if (status === 'ON_HOLD') return `سفارش ${number} ثبت شد ✅${params.paymentTitle ? `\nروش پرداخت: ${params.paymentTitle}` : ''}\nفروشگاه سفارش رو آماده می‌کنه و هر خبری شد همین‌جا بهتون می‌گم.`
  if (status === 'PAYMENT_FAILED') return `پرداخت انجام نشد 😕 اگه مبلغی از حسابتون کم شده، بانک طی ۷۲ ساعت برمی‌گردونه.\nمی‌تونید با همین لینک دوباره پرداخت کنید:`
  if (status === 'EXPIRED') return `مهلت لینک پرداخت سفارش ${params.code} تموم شد. اگه هنوز می‌خواید بگید تا دوباره آماده‌ش کنم 🙂`
  if (status === 'CANCELLED') return `سفارش ${number} لغو شد. هر وقت خواستید دوباره سفارش بدید بگید 🙂`
  if (status === 'REFUNDED') return `مبلغ سفارش ${number} بازگردانده شد.`
  return null
}

type CheckoutEventData = {
  cart_code?: unknown
  payment_method?: unknown
  order_id?: unknown
  order_number?: unknown
  status?: unknown
  paid?: unknown
  total?: unknown
  shipping_total?: unknown
  discount_total?: unknown
  payment_method_title?: unknown
  reason?: unknown
  items?: unknown
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null
}

function num(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

/** Customer-facing notices follow the customer's own script. */
export async function lastCustomerLang(conversationId: string): Promise<OrderLang> {
  const row = await prisma.message.findFirst({ where: { conversationId, role: 'USER' }, orderBy: { createdAt: 'desc' }, select: { content: true } })
  const text = row?.content ?? ''
  return !text || /[؀-ۿ]/.test(text) ? 'fa' : 'en'
}

/**
 * Deliver an assistant message outside a turn: always persisted in the
 * conversation (web widget / chat link read it from history), and pushed to
 * messenger channels. A checkout marker is rendered as the channel's card.
 */
export async function deliverAssistantNotice(conversation: {
  id: string
  agentId: string
  channel: ChannelType
  externalId: string | null
}, content: string, metadata: Record<string, unknown>): Promise<'sent' | 'stored' | 'failed'> {
  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: conversation.id, role: 'ASSISTANT', content, metadata: metadata as Prisma.InputJsonValue },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
    }),
  ])
  if (!isMessengerType(conversation.channel) || !conversation.externalId) return 'stored'
  const channel = await prisma.agentChannel.findFirst({
    where: { agentId: conversation.agentId, type: conversation.channel, active: true },
    select: { config: true },
  })
  if (!channel) return 'failed'
  const token = conversation.channel === 'INSTAGRAM' ? readPageToken(channel.config) : readBotToken(channel.config)
  if (!token) return 'failed'
  const { text, checkout } = parseCheckoutDirective(content)
  try {
    const adapter = getAdapter(conversation.channel, token)
    if (checkout && adapter.sendCheckoutCard) {
      if (text) await adapter.sendText(conversation.externalId, text)
      try {
        await adapter.sendCheckoutCard(conversation.externalId, checkout)
      } catch (error) {
        captureError('checkout:card', error, { metadata: { conversationId: conversation.id } })
        await adapter.sendText(conversation.externalId, composeCheckoutFallback(checkout))
      }
    } else {
      await adapter.sendText(conversation.externalId, [text, checkout ? composeCheckoutFallback(checkout) : ''].filter(Boolean).join('\n\n'))
    }
    return 'sent'
  } catch (error) {
    captureError('checkout:notice', error, { metadata: { conversationId: conversation.id, channel: conversation.channel } })
    return 'failed'
  }
}

/**
 * Apply a plugin event (checkout.order_created / checkout.updated /
 * checkout.failed, or an order.* payload carrying vigent_cart_code).
 * Idempotent: repeated or out-of-order events never message twice.
 */
export async function applyCheckoutEvent(
  integrationId: string,
  topic: string,
  data: CheckoutEventData,
  opts: { notifyCustomer?: boolean } = {},
): Promise<boolean> {
  const code = str(data?.cart_code)
  if (!code) return false
  const draft = await prisma.orderDraft.findUnique({
    where: { code },
    include: {
      conversation: { select: { id: true, agentId: true, channel: true, externalId: true } },
      agent: { select: { name: true } },
    },
  })
  if (!draft || draft.integrationId !== integrationId) return false
  const lang = await lastCustomerLang(draft.conversationId).catch((): OrderLang => 'fa')
  const integration = await prisma.storeIntegration.findUnique({ where: { id: integrationId }, select: { storeUrl: true } })

  if (topic === 'checkout.failed') {
    return reopenAfterStoreRejection(draft, data, lang)
  }

  const wcStatus = str(data.status) ?? ''
  const expired = Boolean(draft.linkExpiresAt && draft.linkExpiresAt.getTime() <= Date.now())
  const next = draftStatusForOrder(wcStatus, data.paid === true && !OFFLINE_METHODS.has(str(data.payment_method) ?? ''), expired, str(data.payment_method) ?? '')
  if (!next) return false
  const orderNumber = str(data.order_number)
  const total = num(data.total)
  const paymentTitle = str(data.payment_method_title)
  const commonData = {
    externalOrderId: str(data.order_id) ?? draft.externalOrderId,
    externalOrderNumber: orderNumber ?? draft.externalOrderNumber,
    paymentMethodTitle: paymentTitle ?? draft.paymentMethodTitle,
    ...(total != null ? { grandTotal: total } : {}),
    ...(num(data.shipping_total) != null ? { shippingTotal: num(data.shipping_total) } : {}),
    ...(num(data.discount_total) != null ? { discountTotal: num(data.discount_total) } : {}),
  }
  if (!acceptsTransition(draft.status, next)) {
    await prisma.orderDraft.update({ where: { id: draft.id }, data: commonData }).catch(() => {})
    return false
  }
  const now = new Date()
  const claimed = await prisma.orderDraft.updateMany({
    where: { id: draft.id, status: draft.status },
    data: {
      ...commonData,
      status: next,
      ...(next === 'PAID' ? { paidAt: now } : {}),
      ...(['PAID', 'ON_HOLD', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(next) ? { resolvedAt: now } : {}),
    },
  })
  if (claimed.count === 0) return false // A concurrent event already moved it.

  if (next === 'PAYMENT_PENDING' || draft.notifiedStatus === next) return true
  let text = composeStatusNotice({ status: next, code: draft.code, orderNumber, total: total ?? draft.grandTotal, paymentTitle, lang })
  if (!text) return true
  if (next === 'PAYMENT_FAILED' && integration) {
    const card = buildCheckoutCard({ ...draft, grandTotal: total ?? draft.grandTotal }, integration.storeUrl, lang)
    if (card) text = `${text}\n${checkoutMarker(card)}`
  }
  // A live status check inside the customer's own turn answers in that turn.
  if (opts.notifyCustomer !== false) {
    await deliverAssistantNotice(draft.conversation, text, { checkoutNotice: true, draftId: draft.id, status: next })
      .catch((error) => captureError('checkout:notify-customer', error, { workspaceId: draft.workspaceId }))
  }
  await prisma.orderDraft.update({ where: { id: draft.id }, data: { notifiedStatus: next } }).catch(() => {})

  if ((next === 'PAID' || next === 'ON_HOLD') && commonData.externalOrderId) {
    // Shipping news for a cart bought in chat (agent.orderUpdatesEnabled).
    await import('@/lib/commerce/order-updates')
      .then((updates) => updates.followPaidCheckout({
        workspaceId: draft.workspaceId,
        agentId: draft.agentId,
        conversationId: draft.conversationId,
        integrationId,
        externalOrderId: commonData.externalOrderId!,
        status: wcStatus || 'processing',
      }))
      .catch((error) => captureError('checkout:follow-order', error, { workspaceId: draft.workspaceId }))
  }
  if (next === 'PAID' || next === 'ON_HOLD') {
    const items = parseDraftItems(draft.items)
    await notifyWorkspace({
      workspaceId: draft.workspaceId,
      type: 'SYSTEM',
      title: next === 'PAID'
        ? `💰 سفارش پرداخت‌شده از گفتگو${orderNumber ? ` #${orderNumber}` : ''}`
        : `🛒 سفارش جدید از گفتگو${orderNumber ? ` #${orderNumber}` : ''} (پرداخت آنلاین نشده${paymentTitle ? ` — ${paymentTitle}` : ''})`,
      body: [
        ...items.map((item) => `• ${itemLine(item, 'fa')}`),
        total != null ? `مبلغ: ${formatToman(total, 'fa')}${paymentTitle ? ` — ${paymentTitle}` : ''}` : '',
        `مشتری: ${draft.customerName ?? '—'} · ${draft.customerPhone ?? '—'}`,
        `ایجنت: ${draft.agent.name} · کد ${draft.code}`,
      ].filter(Boolean).join('\n'),
      link: `/conversations/${draft.conversationId}`,
      operatorTelegram: 'orders',
    })
  }
  return true
}

/**
 * The store refused to build the order (an item sold out between the quote
 * and the click). Drop the missing lines and ask the customer to re-confirm,
 * instead of silently failing on the payment page.
 */
async function reopenAfterStoreRejection(
  draft: { id: string; code: string; status: string; items: Prisma.JsonValue; conversation: { id: string; agentId: string; channel: ChannelType; externalId: string | null }; workspaceId: string },
  data: CheckoutEventData,
  lang: OrderLang,
): Promise<boolean> {
  if (!OPEN_CHECKOUT_STATUSES.includes(draft.status)) return false
  const missing = Array.isArray(data.items) ? data.items.filter((value): value is string => typeof value === 'string') : []
  const items = parseDraftItems(draft.items)
  const remaining = items.filter((item) => !missing.includes(storeLineName(item)) && !missing.includes(item.name))
  const names = missing.length ? missing.join('، ') : ''
  if (!remaining.length || remaining.length === items.length) {
    await prisma.orderDraft.update({ where: { id: draft.id }, data: { status: 'CANCELLED', resolvedAt: new Date(), linkSlug: null } })
    const text = lang === 'en'
      ? `Sorry, ${names ? `“${names}” is` : 'the items are'} no longer available, so the order couldn't be placed. I can suggest an alternative if you like.`
      : `متأسفانه ${names ? `«${names}»` : 'کالاهای سبد'} همین حالا ناموجود شد و سفارش ثبت نشد 😕 اگه بخواید یه مدل موجودِ مشابه پیشنهاد می‌دم.`
    await deliverAssistantNotice(draft.conversation, text, { checkoutNotice: true, draftId: draft.id, status: 'CANCELLED' })
    return true
  }
  await prisma.orderDraft.update({
    where: { id: draft.id },
    data: {
      status: 'AWAITING_CONFIRM',
      expecting: 'confirm',
      items: remaining as unknown as Prisma.InputJsonValue,
      linkSlug: null,
      quote: Prisma.JsonNull,
      quotedAt: null,
      grandTotal: null,
    },
  })
  const list = remaining.map((item) => `• ${itemLine(item, lang)}`).join('\n')
  const text = lang === 'en'
    ? `While placing the order, “${names}” sold out, so I removed it. Your cart now:\n${list}\nReply “confirm” and I'll send a fresh payment link.`
    : `موقع ثبت سفارش، «${names}» ناموجود شد و از سبد برداشتمش. سبد الان:\n${list}\nاگه موافقید «تأیید» رو بفرستید تا لینک پرداخت تازه بفرستم.`
  await deliverAssistantNotice(draft.conversation, text, { checkoutNotice: true, draftId: draft.id, status: 'AWAITING_CONFIRM' })
  return true
}

// ─── Live status (customer says «پرداخت کردم») ─────────────────────────────

/**
 * Ask the store for the order behind an open checkout and apply what it
 * says. Returns the fresh draft facts, or null when the store is
 * unreachable (the caller then relies on the last pushed event).
 */
export async function refreshCheckoutStatus(draftId: string, opts: { notify?: boolean } = {}): Promise<{
  status: string
  orderNumber: string | null
  total: number | null
  paymentTitle: string | null
} | null> {
  const draft = await prisma.orderDraft.findUnique({ where: { id: draftId }, select: { code: true, integrationId: true } })
  if (!draft?.integrationId) return null
  const integration = await prisma.storeIntegration.findUnique({ where: { id: draft.integrationId }, select: { storeUrl: true, webhookSecret: true } })
  if (!integration?.webhookSecret) return null
  try {
    const status = await storeCheckoutStatus({ storeUrl: integration.storeUrl, webhookSecret: integration.webhookSecret }, draft.code)
    if (status.ok && status.found) {
      await applyCheckoutEvent(draft.integrationId, 'checkout.updated', { ...status, cart_code: draft.code }, { notifyCustomer: opts.notify !== false })
    }
  } catch (error) {
    captureError('checkout:status', error, { metadata: { draftId } })
    return null
  }
  const fresh = await prisma.orderDraft.findUnique({
    where: { id: draftId },
    select: { status: true, externalOrderNumber: true, grandTotal: true, paymentMethodTitle: true },
  })
  return fresh
    ? { status: fresh.status, orderNumber: fresh.externalOrderNumber, total: fresh.grandTotal, paymentTitle: fresh.paymentMethodTitle }
    : null
}

/** Best effort: cancel the unpaid store order when the customer cancels in chat. */
export async function cancelCheckoutOnStore(draftId: string): Promise<void> {
  const draft = await prisma.orderDraft.findUnique({ where: { id: draftId }, select: { code: true, integrationId: true } })
  if (!draft?.integrationId) return
  const integration = await prisma.storeIntegration.findUnique({ where: { id: draft.integrationId }, select: { storeUrl: true, webhookSecret: true } })
  if (!integration?.webhookSecret) return
  await cancelStoreCheckout({ storeUrl: integration.storeUrl, webhookSecret: integration.webhookSecret }, draft.code)
    .catch((error) => captureError('checkout:cancel', error, { metadata: { draftId } }))
}

// ─── Worker sweep: reminders + expiry ───────────────────────────────────────

export interface CheckoutSweepStats {
  reminded: number
  expired: number
}

/** One reminder, 1h after an unclicked/unpaid link, only on push channels. */
export const REMINDER_AFTER_MS = 60 * 60 * 1000

export async function sweepCheckoutLinks(now = new Date()): Promise<CheckoutSweepStats> {
  const stats: CheckoutSweepStats = { reminded: 0, expired: 0 }
  const expired = await prisma.orderDraft.updateMany({
    where: { status: { in: ['LINK_SENT', 'PAYMENT_FAILED'] }, linkExpiresAt: { lt: now } },
    data: { status: 'EXPIRED', resolvedAt: now },
  })
  stats.expired = expired.count

  const due = await prisma.orderDraft.findMany({
    where: {
      status: { in: ['LINK_SENT', 'PAYMENT_PENDING'] },
      reminderCount: 0,
      linkSentAt: { lt: new Date(now.getTime() - REMINDER_AFTER_MS) },
      linkExpiresAt: { gt: new Date(now.getTime() + 30 * 60 * 1000) },
      channel: { in: ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'] },
    },
    include: { conversation: { select: { id: true, agentId: true, channel: true, externalId: true, lastMessageAt: true } } },
    take: 50,
  })
  for (const draft of due) {
    // Claim first so two workers never remind twice.
    const claimed = await prisma.orderDraft.updateMany({ where: { id: draft.id, reminderCount: 0 }, data: { reminderCount: 1, remindedAt: now } })
    if (!claimed.count) continue
    // Instagram only allows business messages within 24h of the customer's last one.
    if (draft.channel === 'INSTAGRAM' && draft.conversation.lastMessageAt && now.getTime() - draft.conversation.lastMessageAt.getTime() > 23 * 3_600_000) continue
    const integration = draft.integrationId
      ? await prisma.storeIntegration.findUnique({ where: { id: draft.integrationId }, select: { storeUrl: true } })
      : null
    if (!integration) continue
    const lang = await lastCustomerLang(draft.conversationId).catch((): OrderLang => 'fa')
    const card = buildCheckoutCard(draft, integration.storeUrl, lang)
    if (!card) continue
    const text = lang === 'en'
      ? `Your cart is still waiting 🛒 The payment link for order ${draft.code} is still valid.\n${checkoutMarker(card)}`
      : `سبد خریدتون هنوز منتظره 🛒 لینک پرداخت سفارش ${draft.code} هنوز معتبره.\n${checkoutMarker(card)}`
    const result = await deliverAssistantNotice(draft.conversation, text, { checkoutNotice: true, draftId: draft.id, status: 'REMINDER' }).catch(() => 'failed')
    if (result === 'sent') stats.reminded += 1
  }
  return stats
}
