/**
 * Advance payment («پیش‌پرداخت / بیعانه») for a booking or a course seat,
 * collected through the payment gateway. Pure: shared by the editors, the
 * agent tools and the server.
 *
 *   NONE    — no payment, the old flow
 *   FIXED   — a fixed amount in tomans
 *   PERCENT — a share of the price (1…100)
 *   FULL    — the whole price
 */

export const PREPAY_MODES = ['NONE', 'FIXED', 'PERCENT', 'FULL'] as const
export type PrepayMode = (typeof PREPAY_MODES)[number]

/** Smallest card-to-card transfer the gateway issues (tomans). */
export const MIN_PREPAY_AMOUNT = 1_000

export function readPrepayMode(value: unknown): PrepayMode {
  return typeof value === 'string' && (PREPAY_MODES as readonly string[]).includes(value) ? (value as PrepayMode) : 'NONE'
}

/**
 * What the customer pays now, whole tomans; null when nothing is due or the
 * setting cannot be applied (a percentage of a price that is not set).
 */
export function prepayAmount(mode: PrepayMode | string, value: number | null | undefined, price: number | null | undefined, quantity = 1): number | null {
  const kind = readPrepayMode(mode)
  const units = Math.max(1, Math.round(quantity))
  let amount: number | null = null
  if (kind === 'FIXED' && value != null && value > 0) amount = value * units
  else if (kind === 'FULL' && price != null && price > 0) amount = price * units
  else if (kind === 'PERCENT' && price != null && price > 0 && value != null && value > 0) {
    amount = (price * units * Math.min(100, value)) / 100
  }
  if (amount == null) return null
  const whole = Math.round(amount)
  return whole >= MIN_PREPAY_AMOUNT ? whole : null
}

/** The editor's one-line explanation of a setting. */
export function describePrepay(mode: PrepayMode | string, value: number | null | undefined, price: number | null | undefined, lang: 'fa' | 'en'): string {
  const kind = readPrepayMode(mode)
  const fa = lang !== 'en'
  const money = (n: number) => (fa ? `${Math.round(n).toLocaleString('fa-IR')} تومان` : `${Math.round(n).toLocaleString('en-US')} Toman`)
  if (kind === 'NONE') return fa ? 'بدون پیش‌پرداخت؛ مثل قبل ثبت می‌شود.' : 'No advance payment; booked as before.'
  const amount = prepayAmount(kind, value, price)
  if (amount == null) {
    return kind === 'FIXED'
      ? (fa ? `مبلغ را وارد کنید (حداقل ${money(MIN_PREPAY_AMOUNT)}).` : `Enter an amount (at least ${money(MIN_PREPAY_AMOUNT)}).`)
      : (fa ? 'برای این حالت اول قیمت را وارد کنید.' : 'Set a price first for this option.')
  }
  return fa
    ? `مشتری ${money(amount)} را کارت‌به‌کارت می‌پردازد؛ با رسیدن پیامک واریز، خودکار قطعی می‌شود. اگر در مهلت پرداخت نشود، جا آزاد می‌شود.`
    : `The customer transfers ${money(amount)}; it is confirmed automatically by the deposit SMS. Unpaid within the window, the place is released.`
}
