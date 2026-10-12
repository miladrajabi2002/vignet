/**
 * Test support: the regex detectors that used to stand in for a reading.
 * Production code takes these signals only from the verified reading of the
 * turn; flow tests use this to turn a Persian test message into the same
 * signals without calling a model.
 */
// ─── Intent helpers for an open payment link ────────────────────────────────

export function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export const PAYMENT_CLAIM_RE =
  /(?:پرداخت|واریز|کارت\s?به\s?کارت)\s?(?:رو\s|را\s)?(?:کردم|کردیم|انجام\s?دادم|شد(?:\s|$|؟|\?)|زدم)|پولشو\s?(?:دادم|زدم)|پرداختش\s?کردم|(?:^|\s)(?:i\s+(?:have\s+)?paid|payment\s+(?:is\s+)?done|paid\s+already)(?:\s|$)/u

/** «پرداخت کردم»، «واریز کردم»، «پرداخت شد؟» */
export function isPaymentClaim(message: string): boolean {
  const text = normalize(message)
  return text.split(' ').length <= 12 && PAYMENT_CLAIM_RE.test(text)
}

export const LINK_REQUEST_RE =
  /لینک(?:\s?(?:پرداخت|خرید))?\s?(?:رو\s|را\s)?(?:دوباره|مجدد|باز)?\s?(?:بفرست|بده|کو|کجاست|نیومد|نیامد|کار\s?نمی\s?کنه|کار\s?نمیکنه|باز\s?نمی\s?شه|بازنمیشه|خرابه)|(?:send|resend)\s+(?:me\s+)?(?:the\s+)?(?:payment\s+)?link|link\s+(?:doesn'?t|does\s+not)\s+work/u

/** «لینک پرداخت رو دوباره بفرست»، «لینک کار نمی‌کنه» */
export function isLinkRequest(message: string): boolean {
  return LINK_REQUEST_RE.test(normalize(message))
}
