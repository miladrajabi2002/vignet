/**
 * In-chat checkout card — types, the [[checkout:{…}]] marker and its
 * customer-facing text. Pure and dependency-free so both the server and the
 * chat-link client component can use it.
 */
import type { OrderDraftItem, OrderLang } from '@/lib/commerce/order-capture'

export const CHECKOUT_MARKER_PREFIX = '[[checkout:'

export interface CheckoutCardLine {
  name: string
  variant: string | null
  quantity: number
  lineTotal: number | null
}

/** Everything a channel needs to render the cart card + pay button. */
export interface CheckoutCard {
  code: string
  url: string
  storeHost: string
  items: CheckoutCardLine[]
  shipping: { label: string; cost: number } | null
  discount: number | null
  total: number | null
  expiresAt: string
  lang: OrderLang
}

export interface StoreQuoteRate {
  id: string
  label: string
  method_id?: string
  instance_id?: number
  cost: number
}

/** Answer of the plugin's POST /checkout/quote. */
export interface StoreQuote {
  ok: boolean
  currency?: string
  items?: Array<{ product_id: number; variation_id: number; quantity: number; name: string; unit_price: number | null; available: boolean; stock: number | null }>
  unavailable?: string[]
  state?: string
  subtotal?: number
  discount_total?: number
  rates?: StoreQuoteRate[]
  chosen_rate?: StoreQuoteRate | null
  total?: number
  applied_coupons?: string[]
  coupon_errors?: string[]
  gateways?: Array<{ id: string; title: string }>
}

export function storeHost(storeUrl: string): string {
  try {
    return new URL(storeUrl).host.replace(/^www\./, '')
  } catch {
    return storeUrl
  }
}

// ─── Markers ────────────────────────────────────────────────────────────────

export function checkoutMarker(card: CheckoutCard): string {
  return `${CHECKOUT_MARKER_PREFIX}${JSON.stringify(card)}]]`
}

const CHECKOUT_TOKEN_RE = /\[\[checkout:(\{[\s\S]*?\})\]\](?!\])/g

function asCard(value: unknown): CheckoutCard | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.url !== 'string' || !/^https?:\/\//.test(row.url) || typeof row.code !== 'string') return null
  const items = Array.isArray(row.items) ? row.items : []
  return {
    code: row.code.slice(0, 16),
    url: row.url,
    storeHost: typeof row.storeHost === 'string' ? row.storeHost.slice(0, 120) : storeHost(row.url),
    items: items.slice(0, 20).flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return []
      const line = raw as Record<string, unknown>
      if (typeof line.name !== 'string') return []
      return [{
        name: line.name.slice(0, 120),
        variant: typeof line.variant === 'string' ? line.variant.slice(0, 80) : null,
        quantity: typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 1,
        lineTotal: typeof line.lineTotal === 'number' ? line.lineTotal : null,
      }]
    }),
    shipping: row.shipping && typeof row.shipping === 'object' && typeof (row.shipping as Record<string, unknown>).label === 'string'
      ? { label: String((row.shipping as Record<string, unknown>).label).slice(0, 80), cost: Number((row.shipping as Record<string, unknown>).cost) || 0 }
      : null,
    discount: typeof row.discount === 'number' ? row.discount : null,
    total: typeof row.total === 'number' ? row.total : null,
    expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : '',
    lang: row.lang === 'en' ? 'en' : 'fa',
  }
}

/**
 * Split a reply into visible text + the (single) checkout card it carries.
 * A malformed or truncated marker is removed, never shown as raw JSON.
 */
export function parseCheckoutDirective(raw: string): { text: string; checkout: CheckoutCard | null } {
  let checkout: CheckoutCard | null = null
  const text = raw
    .replace(CHECKOUT_TOKEN_RE, (_token, json: string) => {
      if (!checkout) {
        try { checkout = asCard(JSON.parse(json)) } catch { /* dropped */ }
      }
      return ''
    })
    .replace(/\[\[checkout:(?![^\n]*?\}\]\])[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, checkout }
}

// ─── Customer-facing text ───────────────────────────────────────────────────

export function formatToman(value: number, lang: OrderLang): string {
  return lang === 'en' ? `${Math.round(value).toLocaleString('en-US')} Toman` : `${Math.round(value).toLocaleString('fa-IR')} تومان`
}

export function itemLine(item: Pick<OrderDraftItem, 'name' | 'variant' | 'quantity'>, lang: OrderLang): string {
  const label = item.variant ? `${item.name} — ${item.variant}` : item.name
  return `${label} × ${lang === 'en' ? item.quantity : item.quantity.toLocaleString('fa-IR')}`
}

/** Text shown where a channel cannot render the card (and in the widget above it). */
export function composeCheckoutFallback(card: CheckoutCard): string {
  const lang = card.lang
  const lines: string[] = []
  for (const item of card.items) lines.push(`• ${itemLine(item, lang)}`)
  if (card.shipping) {
    lines.push(lang === 'en'
      ? `Shipping (${card.shipping.label}): ${card.shipping.cost > 0 ? formatToman(card.shipping.cost, lang) : 'free'}`
      : `ارسال (${card.shipping.label}): ${card.shipping.cost > 0 ? formatToman(card.shipping.cost, lang) : 'رایگان'}`)
  }
  if (card.total != null) lines.push(lang === 'en' ? `Total: ${formatToman(card.total, lang)}` : `مبلغ قابل پرداخت: ${formatToman(card.total, lang)}`)
  lines.push(lang === 'en' ? `Pay here: ${card.url}` : `👈 پرداخت: ${card.url}`)
  return lines.join('\n')
}

/** Card body for messenger channels (the pay button carries the URL). */
export function checkoutCardText(card: CheckoutCard): string {
  const lang = card.lang
  const lines: string[] = [lang === 'en' ? `🛒 Order ${card.code}` : `🛒 سفارش ${card.code}`]
  for (const item of card.items) {
    lines.push(`• ${itemLine(item, lang)}${item.lineTotal != null ? ` — ${formatToman(item.lineTotal, lang)}` : ''}`)
  }
  if (card.shipping) {
    lines.push(lang === 'en'
      ? `🚚 ${card.shipping.label}: ${card.shipping.cost > 0 ? formatToman(card.shipping.cost, lang) : 'free'}`
      : `🚚 ${card.shipping.label}: ${card.shipping.cost > 0 ? formatToman(card.shipping.cost, lang) : 'رایگان'}`)
  }
  if (card.discount) lines.push(lang === 'en' ? `🏷 Discount: −${formatToman(card.discount, lang)}` : `🏷 تخفیف: −${formatToman(card.discount, lang)}`)
  if (card.total != null) lines.push(lang === 'en' ? `💰 Total: ${formatToman(card.total, lang)}` : `💰 قابل پرداخت: ${formatToman(card.total, lang)}`)
  lines.push(lang === 'en' ? `Paid securely on ${card.storeHost}` : `پرداخت امن روی ${card.storeHost}`)
  return lines.join('\n')
}

export function checkoutButtonLabel(card: Pick<CheckoutCard, 'total' | 'lang'>): string {
  if (card.lang === 'en') return card.total != null ? `Pay ${formatToman(card.total, 'en')}` : 'Pay now'
  return card.total != null ? `💳 پرداخت ${formatToman(card.total, 'fa')}` : '💳 پرداخت'
}

/** Expiry in the customer's words («تا ۲۴ ساعت»). */
export function expiryPhrase(expiresAt: Date, now: Date, lang: OrderLang): string {
  const hours = Math.max(1, Math.round((expiresAt.getTime() - now.getTime()) / 3_600_000))
  return lang === 'en' ? `valid for ${hours} hour${hours === 1 ? '' : 's'}` : `تا ${hours.toLocaleString('fa-IR')} ساعت معتبره`
}

export function composeLinkMessage(card: CheckoutCard, now = new Date()): string {
  const expires = card.expiresAt ? expiryPhrase(new Date(card.expiresAt), now, card.lang) : null
  if (card.lang === 'en') {
    return [
      `Your payment link is ready ✅ Order ${card.code}${card.total != null ? ` · ${formatToman(card.total, 'en')}` : ''}.`,
      `You pay on the store's own website (${card.storeHost}) and the order is registered right there${expires ? `; the link is ${expires}` : ''}.`,
      checkoutMarker(card),
    ].join('\n')
  }
  return [
    `لینک پرداخت آماده‌ست ✅ سفارش ${card.code}${card.total != null ? ` · ${formatToman(card.total, 'fa')}` : ''}`,
    `پرداخت روی سایت خود فروشگاه (${card.storeHost}) انجام می‌شه و سفارش همون‌جا ثبت می‌شه${expires ? `؛ لینک ${expires}` : ''}.`,
    checkoutMarker(card),
  ].join('\n')
}
