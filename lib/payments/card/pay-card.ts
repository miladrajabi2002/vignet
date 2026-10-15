/**
 * The payment card a customer sees — types, the [[cardpay:{…}]] marker and
 * its text. Pure and dependency-free (the twin of lib/commerce/checkout-card.ts)
 * so the server, the chat link and the dashboard thread share one shape.
 */
import { bankByKey, formatPan } from '@/lib/payments/card/bins'
import { groupDigits } from '@/lib/payments/card/amount'

export const CARDPAY_MARKER_PREFIX = '[[cardpay:'

export type CardPayStatus = 'PENDING' | 'CLAIMED' | 'PAID' | 'EXPIRED' | 'FAILED' | 'CANCELLED'

/** Everything a channel needs to show the card, the exact amount and the state. */
export interface CardPayView {
  /** The order's reference («A7K2Q9»). */
  code: string
  authority: string
  /** Hosted payment page (live status, copy buttons). */
  url: string
  bankKey: string
  /** 16 digits. */
  pan: string
  /** Null when the business hides it. */
  holder: string | null
  /** What the customer transfers, whole tomans. */
  amount: number
  expiresAt: string
  /** Whether «پرداخت کردم» is offered. */
  claim: boolean
  status: CardPayStatus
  lang: 'fa' | 'en'
  /** For the embeddable widget, which has no bank table: name, face colours, whether a logo exists. */
  bank?: { name: string; deep: string; light: string; logo: boolean }
}

export function cardPayMarker(card: CardPayView): string {
  return `${CARDPAY_MARKER_PREFIX}${JSON.stringify(card)}]]`
}

const CARDPAY_TOKEN_RE = /\[\[cardpay:(\{[\s\S]*?\})\]\](?!\])/g
const STATUSES: CardPayStatus[] = ['PENDING', 'CLAIMED', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED']

function asCardPay(value: unknown): CardPayView | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const pan = typeof row.pan === 'string' ? row.pan.replace(/\D/g, '') : ''
  if (pan.length !== 16 || typeof row.code !== 'string' || typeof row.authority !== 'string') return null
  if (typeof row.amount !== 'number' || !(row.amount > 0)) return null
  if (typeof row.url !== 'string' || !/^https?:\/\//.test(row.url)) return null
  return {
    code: row.code.slice(0, 40),
    authority: row.authority.slice(0, 80),
    url: row.url,
    bankKey: typeof row.bankKey === 'string' ? row.bankKey.slice(0, 24) : 'unknown',
    pan,
    holder: typeof row.holder === 'string' && row.holder.trim() ? row.holder.slice(0, 80) : null,
    amount: Math.round(row.amount),
    expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : '',
    claim: row.claim === true,
    status: STATUSES.includes(row.status as CardPayStatus) ? (row.status as CardPayStatus) : 'PENDING',
    lang: row.lang === 'en' ? 'en' : 'fa',
  }
}

/**
 * Split a reply into visible text + the (single) payment card it carries.
 * A malformed or truncated marker is removed, never shown as raw JSON.
 */
export function parseCardPayDirective(raw: string): { text: string; cardPay: CardPayView | null } {
  let cardPay: CardPayView | null = null
  if (!raw.includes(CARDPAY_MARKER_PREFIX)) return { text: raw, cardPay }
  const text = raw
    .replace(CARDPAY_TOKEN_RE, (_token, json: string) => {
      if (!cardPay) {
        try { cardPay = asCardPay(JSON.parse(json)) } catch { /* dropped */ }
      }
      return ''
    })
    .replace(/\[\[cardpay:(?![^\n]*?\}\]\])[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, cardPay }
}

// ─── Customer-facing text ───────────────────────────────────────────────────

export function payToman(value: number, lang: 'fa' | 'en'): string {
  return lang === 'en' ? `${Math.round(value).toLocaleString('en-US')} Toman` : `${Math.round(value).toLocaleString('fa-IR')} تومان`
}

export function minutesLeft(expiresAt: string, now = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime()
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 60_000)) : 0
}

function bankName(card: Pick<CardPayView, 'bankKey' | 'lang'>): string {
  const bank = bankByKey(card.bankKey)
  return card.lang === 'en' ? bank.en : bank.fa
}

/** Lines of the card for channels that only carry text. Numbers stay copyable (no separators). */
export function cardPayText(card: CardPayView, now = new Date()): string {
  const fa = card.lang !== 'en'
  const left = minutesLeft(card.expiresAt, now)
  const lines = fa
    ? [
        `💳 سفارش ${card.code}`,
        `${bankName(card)}${card.holder ? ` — به نام ${card.holder}` : ''}`,
        `شماره کارت: ${formatPan(card.pan)}`,
        `مبلغ دقیق: ${groupDigits(card.amount)} تومان`,
        'لطفاً دقیقاً همین مبلغ را واریز کنید (بدون رُند کردن)؛ پرداخت از روی همین عدد شناخته و خودکار تأیید می‌شود.',
        left ? `مهلت: ${left.toLocaleString('fa-IR')} دقیقه` : '',
      ]
    : [
        `💳 Order ${card.code}`,
        `${bankName(card)}${card.holder ? ` — ${card.holder}` : ''}`,
        `Card number: ${formatPan(card.pan)}`,
        `Exact amount: ${groupDigits(card.amount)} Toman`,
        'Please transfer exactly this amount (do not round it); the payment is recognised by this number and confirmed automatically.',
        left ? `Valid for ${left} minutes` : '',
      ]
  return lines.filter(Boolean).join('\n')
}

/**
 * The card as separate messages for channels with no copy button (Instagram,
 * Rubika): the card number and the amount each travel alone and without
 * separators, so «hold to copy» takes exactly that number.
 */
export function cardPaySplitMessages(card: CardPayView, now = new Date()): string[] {
  const fa = card.lang !== 'en'
  const left = minutesLeft(card.expiresAt, now)
  const head = fa
    ? `💳 سفارش ${card.code}\n${bankName(card)}${card.holder ? ` — به نام ${card.holder}` : ''}\nشماره کارت و مبلغ دقیق رو جدا می‌فرستم که راحت کپی کنید 👇`
    : `💳 Order ${card.code}\n${bankName(card)}${card.holder ? ` — ${card.holder}` : ''}\nThe card number and the exact amount follow as separate messages so they are easy to copy 👇`
  const tail = fa
    ? `مبلغ به تومانه (${groupDigits(card.amount)}) و باید دقیقاً همین باشه؛ بعد از واریز همین‌جا خودکار تأیید می‌شه.${left ? ` مهلت: ${left.toLocaleString('fa-IR')} دقیقه.` : ''}`
    : `The amount is in Toman (${groupDigits(card.amount)}) and must be exact; it is confirmed here automatically after the transfer.${left ? ` Valid for ${left} minutes.` : ''}`
  return [head, card.pan, String(card.amount), tail]
}

/** The message that carries a fresh card. */
export function composeCardPayMessage(card: CardPayView): string {
  const intro = card.lang === 'en'
    ? `Order ${card.code} is registered ✅ Transfer exactly this amount to the card below; it is confirmed here automatically as soon as it arrives.`
    : `سفارش ${card.code} ثبت شد ✅ لطفاً دقیقاً همین مبلغ رو به کارت زیر واریز کنید؛ به محض رسیدن، همین‌جا خودکار تأیید می‌شه.`
  return `${intro}\n${cardPayMarker(card)}`
}

export function cardPayStatusLabel(status: CardPayStatus, lang: 'fa' | 'en'): string {
  const fa: Record<CardPayStatus, string> = {
    PENDING: 'منتظر واریز شما',
    CLAIMED: 'در حال بررسی واریز',
    PAID: 'پرداخت تأیید شد',
    EXPIRED: 'مهلت پرداخت تمام شد',
    FAILED: 'واریزی پیدا نشد',
    CANCELLED: 'لغو شد',
  }
  const en: Record<CardPayStatus, string> = {
    PENDING: 'Waiting for your transfer',
    CLAIMED: 'Checking your transfer',
    PAID: 'Payment confirmed',
    EXPIRED: 'This payment has expired',
    FAILED: 'No transfer was found',
    CANCELLED: 'Cancelled',
  }
  return (lang === 'en' ? en : fa)[status]
}

/** What the customer is told when a payment changes state outside their own turn. */
export function composeCardPayNotice(params: { status: CardPayStatus; code: string; amount: number; lang: 'fa' | 'en' }): string | null {
  const { status, code, lang } = params
  if (status === 'PAID') {
    return lang === 'en'
      ? `Your payment arrived ✅ Order ${code} (${payToman(params.amount, 'en')}) is confirmed and being prepared.`
      : `پرداختتون رسید ✅ سفارش ${code} (${payToman(params.amount, 'fa')}) تأیید شد و در حال آماده‌سازیه.`
  }
  if (status === 'EXPIRED') {
    return lang === 'en'
      ? `The payment window for order ${code} has ended. Tell me whenever you want and I'll send the card again.`
      : `مهلت پرداخت سفارش ${code} تمام شد. هر وقت خواستید بگید تا دوباره کارت رو بفرستم.`
  }
  if (status === 'FAILED') {
    return lang === 'en'
      ? `We could not find a transfer for order ${code}. If you did pay, please send the receipt here so we can check it.`
      : `واریزی برای سفارش ${code} پیدا نکردیم. اگه پرداخت کردید، لطفاً رسیدش رو همین‌جا بفرستید تا بررسی کنیم.`
  }
  if (status === 'CLAIMED') {
    return lang === 'en'
      ? `Thanks. The bank's confirmation for order ${code} has not reached us yet; a colleague is checking it and I'll tell you right here.`
      : `ممنون 🙏 هنوز تأیید بانک برای سفارش ${code} به ما نرسیده؛ همکارم داره بررسی می‌کنه و همین‌جا خبرتون می‌کنم.`
  }
  return null
}
