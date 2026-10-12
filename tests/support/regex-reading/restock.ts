/**
 * Test support: the regex detectors that used to stand in for a reading.
 * Production code takes these signals only from the verified reading of the
 * turn; flow tests use this to turn a Persian test message into the same
 * signals without calling a model.
 */
import { normalizeOrderText } from "./order-capture"

export const RESTOCK_REQUEST_RES: RegExp[] = [
  /(?:موجود|شارژ|اومد|آمد|رسید|برگشت|تولید)\S*(?:\s(?:شد|بشه|شدن|بشن|شده|کردید|کردین|کنید))?.{0,30}(?:خبر(?:م|مون)?\s?(?:کن|کنید|کنین|بدید|بدین|بده|میدید|می\s?دید|میکنید|می\s?کنید|می\s?کنین)|اطلاع\s?(?:بده|بدید|بدین|میدید|می\s?دید|رسانی)|بهم\s?(?:بگ|پیام|خبر)|پیام\s?(?:بدید|بدین|بده))/u,
  /(?:^|\s)(?:خبرم|خبرمون)\s?(?:کن|کنید|کنین|بدید|بدین)(?:\s|$|[.!،]|لطفا)/u,
  /(?:^|\s)(?:بهم|به\s?من)\s?(?:خبر|اطلاع)\s?(?:بدید|بدین|بده|میدید|می\s?دید)/u,
  /\b(?:notify\s+me|let\s+me\s+know\s+when|tell\s+me\s+when|message\s+me\s+when|alert\s+me)\b/u,
]

export const RESTOCK_OFFER_RE =
  /موجود\s?(?:که\s)?شد.{0,40}خبرتون|خبرتون\s?(?:می\s?)?کن(?:م|یم)|notify\s+you|message\s+you\s+here\s+as\s+soon|let\s+you\s+know\s+as\s+soon/u

export const ACCEPT_RE =
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
