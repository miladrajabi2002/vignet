/**
 * In-chat checkout — the pure half (no DB, no network).
 *
 * A confirmed chat cart becomes a link to the store itself:
 *   https://store.example/?vigent_checkout=<slug>
 * The WordPress plugin (5.0+) resolves <slug> against Vigent with an
 * HMAC-signed request, creates the order with WooCommerce's own APIs and opens
 * the store's payment page. Customer-facing text here is built only from real
 * cart/quote data, so the agent never claims a price or a payment that did not
 * happen.
 */
import crypto from 'node:crypto'
import { storeHost } from '@/lib/commerce/checkout-card'

export * from '@/lib/commerce/checkout-card'

export const CHECKOUT_QUERY_VAR = 'vigent_checkout'
/** Plugin versions that understand checkout links. */
export const MIN_CHECKOUT_PLUGIN_VERSION = '5.0.0'
/** Store requests are signed; older timestamps are rejected (replay window). */
export const SIGNATURE_SKEW_SECONDS = 300

// ─── Tokens and signatures ──────────────────────────────────────────────────

/** 24-char URL-safe slug (144 bits): the bearer secret inside the store link. */
export function newLinkSlug(): string {
  return crypto.randomBytes(18).toString('base64url')
}

export function isValidLinkSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value)
}

export function storeCheckoutUrl(storeUrl: string, slug: string): string {
  const url = new URL(storeUrl.replace(/\/+$/, '') + '/')
  url.searchParams.set(CHECKOUT_QUERY_VAR, slug)
  return url.toString()
}

/** hex HMAC-SHA256 over «<timestamp>.<body>» — the scheme both sides use. */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex')
}

export function verifyPayloadSignature(params: {
  secret: string
  timestamp: string | null
  signature: string | null
  body: string
  nowSeconds?: number
}): boolean {
  const { secret, timestamp, signature, body } = params
  if (!secret || !timestamp || !signature || !/^\d{9,11}$/.test(timestamp)) return false
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > SIGNATURE_SKEW_SECONDS) return false
  const expected = Buffer.from(signPayload(secret, timestamp, body), 'utf8')
  const actual = Buffer.from(signature.trim(), 'utf8')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

/** «5.0.0» ≥ «5.0.0», «4.3.11» < «5.0.0». Unknown versions are too old. */
export function pluginSupportsCheckout(version: string | null | undefined): boolean {
  if (!version) return false
  const parse = (value: string) => value.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0)
  const have = parse(version)
  const need = parse(MIN_CHECKOUT_PLUGIN_VERSION)
  for (let index = 0; index < 3; index += 1) {
    if (have[index] !== need[index]) return have[index] > need[index]
  }
  return true
}

// ─── Intent helpers for an open payment link ────────────────────────────────

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const PAYMENT_CLAIM_RE =
  /(?:پرداخت|واریز|کارت\s?به\s?کارت)\s?(?:رو\s|را\s)?(?:کردم|کردیم|انجام\s?دادم|شد(?:\s|$|؟|\?)|زدم)|پولشو\s?(?:دادم|زدم)|پرداختش\s?کردم|(?:^|\s)(?:i\s+(?:have\s+)?paid|payment\s+(?:is\s+)?done|paid\s+already)(?:\s|$)/u

/** «پرداخت کردم»، «واریز کردم»، «پرداخت شد؟» */
export function isPaymentClaim(message: string): boolean {
  const text = normalize(message)
  return text.split(' ').length <= 12 && PAYMENT_CLAIM_RE.test(text)
}

const LINK_REQUEST_RE =
  /لینک(?:\s?(?:پرداخت|خرید))?\s?(?:رو\s|را\s)?(?:دوباره|مجدد|باز)?\s?(?:بفرست|بده|کو|کجاست|نیومد|نیامد|کار\s?نمی\s?کنه|کار\s?نمیکنه|باز\s?نمی\s?شه|بازنمیشه|خرابه)|(?:send|resend)\s+(?:me\s+)?(?:the\s+)?(?:payment\s+)?link|link\s+(?:doesn'?t|does\s+not)\s+work/u

/** «لینک پرداخت رو دوباره بفرست»، «لینک کار نمی‌کنه» */
export function isLinkRequest(message: string): boolean {
  return LINK_REQUEST_RE.test(normalize(message))
}

const COUPON_RE = /(?:کد\s?تخفیف|کوپن|کد\s?کوپن|coupon(?:\s?code)?|discount\s?code|promo\s?code)\s*(?:م|من|ام)?\s*[:：\-]?\s*(?:هم\s)?(?:دارم\s)?[:：]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,29})/iu

/** «کد تخفیف VIGENT10» → VIGENT10 */
export function extractCouponCode(message: string): string | null {
  const match = COUPON_RE.exec(message.normalize('NFKC').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
  return match ? match[1].toUpperCase() : null
}
