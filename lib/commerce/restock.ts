/**
 * «موجود شد خبرم کن» — back-in-stock alerts, pure half (no DB).
 *
 * The offer is made only where the platform can really keep the promise:
 *   • messenger channels (Telegram/Bale/Rubika/Instagram) → the worker
 *     messages the customer directly when the item is available again
 *     ('direct'); an Instagram thread whose 24h window has closed becomes a
 *     follow-up task for the store team instead of a silent failure;
 *   • web widget / chat link → only with a mobile number, and the wording
 *     says the TEAM will let them know ('team');
 *   • API and retired channels → no offer at all.
 */
import type { ChannelType } from '@prisma/client'
import { extractTypedVariations, type VariationRow } from '@/lib/products/description'
import { normalizeOrderText } from '@/lib/commerce/order-capture'

export type RestockMode = 'direct' | 'team' | 'needs_phone' | null
export type RestockLang = 'fa' | 'en'

export interface RestockItem {
  productId: string
  variationId: number | null
  name: string
  variant: string | null
}

const DIRECT_CHANNELS = new Set<ChannelType>(['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'])
const WEB_CHANNELS = new Set<ChannelType>(['WEB_WIDGET', 'CHAT_LINK'])

export function restockMode(channel: ChannelType, hasPhone: boolean): RestockMode {
  if (DIRECT_CHANNELS.has(channel)) return 'direct'
  if (WEB_CHANNELS.has(channel)) return hasPhone ? 'team' : 'needs_phone'
  return null
}

/** One conditional offer line appended to an out-of-stock reply. */
export function restockOfferLine(mode: RestockMode, lang: RestockLang): string | null {
  if (!mode) return null
  if (lang === 'en') {
    return mode === 'direct'
      ? 'If you like, I’ll message you here as soon as it’s back in stock.'
      : 'If you like, we can let you know as soon as it’s back in stock.'
  }
  return mode === 'direct'
    ? 'اگه بخواید، موجود که شد همین‌جا خبرتون می‌کنم'
    : 'اگه بخواید، موجود که شد خبرتون می‌کنیم'
}

const RESTOCK_REQUEST_RES: RegExp[] = [
  /(?:موجود|شارژ|اومد|آمد|رسید|برگشت|تولید)\S*(?:\s(?:شد|بشه|شدن|بشن|شده|کردید|کردین|کنید))?.{0,30}(?:خبر(?:م|مون)?\s?(?:کن|کنید|کنین|بدید|بدین|بده|میدید|می\s?دید|میکنید|می\s?کنید|می\s?کنین)|اطلاع\s?(?:بده|بدید|بدین|میدید|می\s?دید|رسانی)|بهم\s?(?:بگ|پیام|خبر)|پیام\s?(?:بدید|بدین|بده))/u,
  /(?:^|\s)(?:خبرم|خبرمون)\s?(?:کن|کنید|کنین|بدید|بدین)(?:\s|$|[.!،]|لطفا)/u,
  /(?:^|\s)(?:بهم|به\s?من)\s?(?:خبر|اطلاع)\s?(?:بدید|بدین|بده|میدید|می\s?دید)/u,
  /\b(?:notify\s+me|let\s+me\s+know\s+when|tell\s+me\s+when|message\s+me\s+when|alert\s+me)\b/u,
]

const RESTOCK_OFFER_RE =
  /موجود\s?(?:که\s)?شد.{0,40}خبرتون|خبرتون\s?(?:می\s?)?کن(?:م|یم)|notify\s+you|message\s+you\s+here\s+as\s+soon|let\s+you\s+know\s+as\s+soon/u

const ACCEPT_RE =
  /^(?:آره|اره|بله|بلی|حتما|حتماً|لطفا|لطفاً|اوکی|ok|okay|yes|yeah|sure|please|باشه|مرسی\s?آره|چرا\s?که\s?نه|خبرم\s?کن(?:ید|ین)?|اطلاع\s?بدید|👍)(?:\s|$|[.!،,]|ممنون|مرسی|لطفا)/u

/**
 * 'explicit' — the customer asked for an alert in their own words;
 * 'accept'   — a short yes right after the agent's alert offer.
 */
export function detectRestockRequest(message: string, lastAssistantText: string | null | undefined): 'explicit' | 'accept' | null {
  const text = normalizeOrderText(message)
  if (!text) return null
  if (RESTOCK_REQUEST_RES.some((pattern) => pattern.test(text))) return 'explicit'
  const offered = Boolean(lastAssistantText) && RESTOCK_OFFER_RE.test(normalizeOrderText(lastAssistantText ?? ''))
  if (offered && text.split(/\s+/u).length <= 6 && ACCEPT_RE.test(text)) return 'accept'
  return null
}

function variationAvailable(variation: VariationRow): boolean {
  if (variation.manageStock) return (variation.stockQuantity ?? 0) > 0
  return variation.inStock !== false
}

/**
 * Can this product (or one variation of it) be bought right now? A variable
 * product with no variation pinned is available when ANY variation is.
 */
export function isItemAvailable(
  product: { active: boolean; stock: number | null; attributes: unknown },
  variationId: number | null,
): boolean {
  if (!product.active || product.stock === 0) return false
  const variations = extractTypedVariations(product.attributes)
  if (variationId != null) {
    const variation = variations.find((row) => row.id === variationId)
    return variation ? variationAvailable(variation) : true
  }
  return variations.length === 0 || variations.some(variationAvailable)
}

function itemName(item: RestockItem): string {
  return item.variant ? `${item.name} — ${item.variant}` : item.name
}

function listNames(items: RestockItem[], lang: RestockLang): string {
  const names = items.map((item) => (lang === 'en' ? `“${itemName(item)}”` : `«${itemName(item)}»`))
  if (names.length <= 1) return names.join('')
  return lang === 'en'
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : `${names.slice(0, -1).join('، ')} و ${names.at(-1)}`
}

export function composeRestockConfirmed(items: RestockItem[], mode: Exclude<RestockMode, null | 'needs_phone'>, lang: RestockLang): string {
  const names = listNames(items, lang)
  if (lang === 'en') {
    return mode === 'direct'
      ? `Done 🌱 I’ll message you right here as soon as ${names} ${items.length > 1 ? 'are' : 'is'} back in stock.`
      : `Done 🌱 We’ll let you know as soon as ${names} ${items.length > 1 ? 'are' : 'is'} back in stock.`
  }
  return mode === 'direct'
    ? `حتماً 🌱 ${names} که موجود شد، همین‌جا بهتون پیام می‌دم`
    : `حتماً 🌱 ${names} که موجود شد، خبرتون می‌کنیم`
}

export function composeRestockAskPhone(lang: RestockLang): string {
  return lang === 'en'
    ? 'Sure. Please send your mobile number so we can let you know when it’s back in stock.'
    : 'حتماً؛ یه شماره موبایل بفرستید تا موجود شد خبرتون کنیم'
}

export function composeRestockAlreadyAvailable(items: RestockItem[], lang: RestockLang): string {
  const names = listNames(items, lang)
  return lang === 'en'
    ? `Good news: ${names} ${items.length > 1 ? 'are' : 'is'} actually available right now 🙂`
    : `خبر خوب اینکه ${names} همین الان موجوده 🙂`
}

export function composeRestockWhichProduct(lang: RestockLang): string {
  return lang === 'en'
    ? 'Sure. Which product should I watch for you? Send its name or code.'
    : 'حتماً؛ موجود شدن کدوم محصول رو براتون دنبال کنم؟ اسم یا کدش رو بفرستید'
}

/** The proactive message the worker sends when items are available again. */
export function composeRestockNotice(params: {
  items: RestockItem[]
  customerName?: string | null
  orderCapture: boolean
  lang: RestockLang
}): string {
  const names = listNames(params.items, params.lang)
  const firstName = params.customerName?.trim().split(/\s+/u)[0]
  const plural = params.items.length > 1
  if (params.lang === 'en') {
    return [
      `Hi${firstName ? ` ${firstName}` : ''}! Good news 🎉`,
      `${names} that you asked about ${plural ? 'are' : 'is'} back in stock.`,
      params.orderCapture
        ? 'If you still want it, just tell me here and I’ll set up your order.'
        : 'If you still want it, you can order from the product card below.',
    ].join('\n')
  }
  return [
    `سلام${firstName ? ` ${firstName}` : ''}! یه خبر خوب 🎉`,
    `${names} که سراغش رو گرفته بودید دوباره موجود شد.`,
    params.orderCapture
      ? 'اگه هنوز می‌خواید، همین‌جا بگید تا براتون ثبتش کنم'
      : 'اگه هنوز می‌خواید، از دکمهٔ خرید روی کارت محصول می‌تونید سفارش بدید',
  ].join('\n')
}

export function restockDedupeKey(conversationId: string, item: Pick<RestockItem, 'productId' | 'variationId'>): string {
  return `${conversationId}:${item.productId}:${item.variationId ?? ''}`
}
