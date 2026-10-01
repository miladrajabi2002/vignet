/**
 * Order status updates in chat — the pure half (no DB).
 *
 * Decides whether a store change is worth a message and writes it. The
 * message states only what the store reported: «تکمیل‌شده» is never turned
 * into «تحویل داده شد», and a tracking code is repeated exactly.
 */

export type UpdateLang = 'fa' | 'en'

export interface WatchedState {
  notifiedStatus: string | null
  notifiedTracking: string | null
}

export interface OrderSnapshot {
  externalOrderId: string
  status: string
  trackingCode: string | null
  courierName: string | null
  trackingLink: string | null
}

export type OrderChange = { status: boolean; tracking: boolean }

/** Statuses after which nothing more will happen to the order. */
export const TERMINAL_STATUSES = new Set(['cancelled', 'refunded', 'failed'])

/** What changed since the customer was last told; null = nothing to say. */
export function orderChange(watch: WatchedState, order: OrderSnapshot): OrderChange | null {
  const status = normalizeStatus(order.status)
  const statusChanged = Boolean(status) && status !== normalizeStatus(watch.notifiedStatus ?? '')
  const tracking = order.trackingCode?.trim() || null
  const trackingChanged = Boolean(tracking) && tracking !== (watch.notifiedTracking?.trim() || null)
  // A move back to «در انتظار پرداخت» is store bookkeeping, not news.
  const quietStatus = status === 'pending' || status === 'checkout-draft'
  if (!trackingChanged && (!statusChanged || quietStatus)) return null
  return { status: statusChanged && !quietStatus, tracking: trackingChanged }
}

export function normalizeStatus(value: string): string {
  return value.trim().toLowerCase().replace(/^wc-/, '')
}

type StatusCopy = { fa: string; en: string }

const STATUS_COPY: Record<string, StatusCopy> = {
  processing: { fa: 'تأیید شد و در حال آماده‌سازیه 📦', en: 'is confirmed and being prepared 📦' },
  'on-hold': { fa: 'در انتظار بررسی فروشگاهه؛ تأیید که شد خبرتون می‌کنم.', en: 'is waiting for the store’s review; I’ll tell you once it’s confirmed.' },
  completed: { fa: 'از طرف فروشگاه تکمیل شد ✅', en: 'was marked complete by the store ✅' },
  cancelled: { fa: 'لغو شد. اگه سؤالی دارید همین‌جا بپرسید.', en: 'was cancelled. Ask me here if you have any questions.' },
  refunded: { fa: 'بازپرداخت شد.', en: 'was refunded.' },
  failed: { fa: 'ناموفق ثبت شد. اگه کمک لازم دارید همین‌جا بگید.', en: 'failed. Tell me here if you need help.' },
}

/* Common custom statuses from Iranian shipping plugins, by keyword. */
const CUSTOM_STATUS: Array<{ pattern: RegExp; copy: StatusCopy }> = [
  { pattern: /deliver|تحویل/, copy: { fa: 'از طرف فروشگاه «تحویل‌شده» ثبت شد ✅', en: 'was marked delivered by the store ✅' } },
  { pattern: /ship|sent|send|post|dispatch|ارسال/, copy: { fa: 'ارسال شد 🚚', en: 'has been shipped 🚚' } },
  { pattern: /pack|prepar|ready|بسته/, copy: { fa: 'در حال بسته‌بندیه 📦', en: 'is being packed 📦' } },
]

function statusSentence(status: string, lang: UpdateLang): string {
  const key = normalizeStatus(status)
  const known = STATUS_COPY[key] ?? CUSTOM_STATUS.find((entry) => entry.pattern.test(key))?.copy
  if (known) return known[lang]
  const label = key.replace(/[-_]+/g, ' ').trim()
  return lang === 'en' ? `is now “${label}”.` : `وضعیتش به «${label}» تغییر کرد.`
}

/** The chat message for one change. */
export function composeOrderUpdate(order: OrderSnapshot, change: OrderChange, lang: UpdateLang, trackingLink: string): string {
  const number = `#${order.externalOrderId}`
  const lines: string[] = []
  if (change.status) {
    lines.push(lang === 'en'
      ? `Update on your order ${number}: it ${statusSentence(order.status, lang)}`
      : `خبر سفارش ${number}: ${statusSentence(order.status, lang)}`)
  }
  if (change.tracking && order.trackingCode) {
    const courier = order.courierName?.trim()
    if (!change.status) {
      lines.push(lang === 'en'
        ? `Your order ${number} has shipped 🚚`
        : `بستهٔ سفارش ${number} ارسال شد 🚚`)
    }
    lines.push(lang === 'en'
      ? `Tracking code${courier ? ` (${courier})` : ''}: \`${order.trackingCode.trim()}\``
      : `کد رهگیری${courier ? ` (${courier})` : ''}: \`${order.trackingCode.trim()}\``)
    if (trackingLink) lines.push(lang === 'en' ? `Track it here: ${trackingLink}` : `پیگیری مرسوله: ${trackingLink}`)
  }
  return lines.join('\n')
}

/**
 * One line for the reply that shows the order, so the customer knows updates
 * will follow. Channels without push (web widget, chat link) keep them in
 * the chat for the next visit.
 */
export function followLine(channel: string, lang: UpdateLang): string {
  const push = ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM', 'WHATSAPP'].includes(channel)
  if (lang === 'en') {
    return push
      ? 'I’ll message you here whenever the status changes or a tracking code is added.'
      : 'Any status change or tracking code will show up in this chat.'
  }
  return push
    ? 'هر تغییری در وضعیت سفارش یا ثبت کد رهگیری، همین‌جا خبرتون می‌کنم.'
    : 'هر تغییر وضعیت یا کد رهگیری، در همین گفتگو ثبت می‌شه.'
}
