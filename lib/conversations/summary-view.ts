/**
 * Reading a stored conversation summary for display.
 *
 * Summaries are written as `label: value | label: value` (see summary.ts and
 * live-summary.ts) so they stay one compact string in the database and in the
 * operator bot. Screens show them as fields, and the inbox shows one line.
 */

export interface SummaryField {
  label: string
  value: string
}

// The stock line older summaries end with when nothing is pending.
const NO_NEXT_STEP = ['قدم بعدی حل‌نشده‌ای به‌صورت صریح ثبت نشده است', 'no explicit unresolved next step was recorded']

// Labels are written by summary.ts / live-summary.ts, so exact text is enough.
const isGoal = (label: string) => label === 'هدف' || label.toLowerCase() === 'goal'
const isRequest = (label: string) => label.startsWith('درخواست مشتری') || label.toLowerCase().startsWith('customer request')
const isOrder = (label: string) => label.startsWith('سفارش') || label.toLowerCase().startsWith('order')
const isContact = (label: string) => label === 'تماس' || label.toLowerCase() === 'contact'

/** Split a summary into its labelled parts; a part without a label keeps an empty one. */
export function summaryFields(summary: string | null | undefined): SummaryField[] {
  if (!summary) return []
  return summary
    .split(' | ')
    .map((part) => part.trim())
    .filter((part) => part && !NO_NEXT_STEP.some((stock) => part.includes(stock)))
    .map((part) => {
      const at = part.indexOf(': ')
      // A colon far into the text is part of the sentence, not a label.
      if (at <= 0 || at > 40) return { label: '', value: part }
      return { label: part.slice(0, at).trim(), value: part.slice(at + 2).trim() }
    })
}

/**
 * How a field reads on screen. The request label drops its «از طریق …» tail
 * (the header already names the app), and a request joined from several
 * customer messages («… ← … ← …») comes back as those messages, one each.
 */
export function summaryFieldView(field: SummaryField): { label: string; items: string[] } {
  const request = isRequest(field.label) || field.label.startsWith('سایر پیام‌های مشتری') || field.label.toLowerCase().startsWith('other customer messages')
  const label = request ? field.label.replace(/\s+(?:از طریق|via)\s.+$/i, '').trim() : field.label
  const items = request ? field.value.split(/\s+[←→]\s+/).map((item) => item.trim()).filter(Boolean) : [field.value]
  return { label, items: items.length ? items : [field.value] }
}

/** 09128352271 → 0912•••2271, for places a colleague or a passer-by can read. */
export function maskPhones(text: string): string {
  return text.replace(/(\+?98|0)?(9\d{2})(\d{3})(\d{4})/g, (_m, prefix: string | undefined, a: string, _b: string, d: string) => `${prefix ?? ''}${a}•••${d}`)
}

/**
 * One line for a list: what the customer wants, plus the order's state when
 * there is one («خرید پلن حرفه‌ای · منقضی‌شده»). Never includes contact details.
 */
export function summaryHeadline(summary: string | null | undefined, max = 120): string | null {
  const fields = summaryFields(summary)
  if (!fields.length) return null
  const goal = fields.find((field) => isGoal(field.label))
    ?? fields.find((field) => isRequest(field.label))
    ?? fields.find((field) => field.label && !isContact(field.label))
    ?? fields[0]
  const order = fields.find((field) => isOrder(field.label))
  const orderState = order?.value.split(' — ').slice(1).join(' — ').split('؛')[0].split(';')[0]?.trim()
  const line = orderState && goal !== order ? `${goal.value} · ${orderState}` : goal.value
  const masked = maskPhones(line)
  return masked.length > max ? `${masked.slice(0, max - 1).trimEnd()}…` : masked
}
