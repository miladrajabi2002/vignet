/**
 * Reading a bank's deposit SMS — pure, never throws. A shape parser of
 * machine-written text (the bank's own message), not of customer meaning.
 *
 * Banks do not share a layout («واریز303,210,000», «انتقال اينترنت:+10,000,232»,
 * «واریز مبلغ … ریال»), so the reader does not look for one format: it lists
 * every number that can be a transfer amount, best first, and the matcher
 * accepts any of them that equals an open payment. The account balance is
 * removed from the stored text and a message carrying a password is never
 * stored at all.
 */
import { toEnglishDigits } from '@/lib/phone'

export type BankSmsKind = 'deposit' | 'withdraw' | 'secret' | 'other'

export interface ParsedBankSms {
  kind: BankSmsKind
  /** Possible transfer amounts in RIALS, best first. */
  candidates: number[]
  amountRial: number | null
  /** The text to store: no balance. Empty for `secret`. */
  redacted: string
}

const K_BALANCE = ['مانده', 'موجودی', 'balance', 'bal']
const K_ACCOUNT = ['حساب', 'سپرده', 'کارت', 'شماره', 'شعبه', 'پیگیری', 'مرجع', 'ارجاع', 'سند', 'کد', 'account', 'acc', 'card', 'ref']
const K_AMOUNT = ['مبلغ', 'واریز', 'انتقال', 'نشست', 'افزایش', 'برداشت', 'خرید', 'amount', 'deposit', 'credit', 'withdraw']
const RE_SECRET = /رمز|password|otp|کد تایید|کد تأیید|cvv2/i
const RE_DEPOSIT = /واریز|نشست|افزایش|انتقال به|deposit|credited/i
const RE_WITHDRAW = /برداشت|خرید|کسر|انتقال از|withdraw|debit|purchase/i

/** Words that are always present in a deposit SMS; the owner's forwarding rule filters on one of them. */
export const DEPOSIT_KEYWORDS = ['واریز', 'انتقال', 'نشست', 'افزایش'] as const

export function normalizeSms(text: string): string {
  return toEnglishDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‎‏‪-‮⁦-⁩]/g, ' ')
    .replace(/[٬،]/g, ',')
    .replace(/\r/g, '')
}

function lastKeywordClass(label: string): 'balance' | 'account' | 'amount' | null {
  const text = label.toLowerCase()
  let best: { at: number; cls: 'balance' | 'account' | 'amount' | null } = { at: -1, cls: null }
  const scan = (words: string[], cls: 'balance' | 'account' | 'amount') => {
    for (const word of words) {
      const at = text.lastIndexOf(word)
      if (at > best.at) best = { at, cls }
    }
  }
  scan(K_BALANCE, 'balance')
  scan(K_ACCOUNT, 'account')
  scan(K_AMOUNT, 'amount')
  return best.cls
}

export function parseBankSms(raw: string | null | undefined): ParsedBankSms {
  const text = normalizeSms(raw ?? '').trim()
  if (!text) return { kind: 'other', candidates: [], amountRial: null, redacted: '' }
  if (RE_SECRET.test(text)) return { kind: 'secret', candidates: [], amountRial: null, redacted: '' }

  const found: Array<{ rial: number; sign: '+' | '-' | ''; score: number }> = []
  let redacted = text
  const re = /\d[\d,]*/g
  let match: RegExpExecArray | null
  let prevEnd = 0
  while ((match = re.exec(text))) {
    const token = match[0].replace(/,+$/, '')
    const start = match.index
    const end = start + token.length
    const label = text.slice(Math.max(prevEnd, start - 28), start)
    prevEnd = end
    const before = text.slice(0, start).replace(/\s+$/, '').slice(-1)
    const after = text.slice(end).replace(/^\s+/, '')
    const cls = lastKeywordClass(label)
    if (cls === 'balance') {
      redacted = redacted.replace(token, '•••')
      continue
    }
    const value = Number.parseInt(token.replace(/,/g, ''), 10)
    const dateLike = /^[/:\-]\d/.test(text.slice(end)) || /\d[/:\-]$/.test(text.slice(0, start)) || /^0\d/.test(token)
    if (dateLike || cls === 'account' || !(value >= 1000)) continue
    const sign: '+' | '-' | '' = before === '+' || after[0] === '+'
      ? '+'
      : before === '-' || before === '−' || /^[-−](?!\d)/.test(after) ? '-' : ''
    const toman = /^(تومان|تومن|toman)/i.test(after)
    const score = (cls === 'amount' ? 3 : 0)
      + (sign ? 2 : 0)
      + (/^(ریال|rial|irr|تومان|تومن|toman)/i.test(after) ? 2 : 0)
      + (token.includes(',') ? 1 : 0)
    found.push({ rial: toman ? value * 10 : value, sign, score })
  }
  // Stable sort: equal scores keep the order of the message.
  found.sort((a, b) => b.score - a.score)

  const top = found[0]
  let kind: BankSmsKind = 'other'
  if (top) {
    const says = { deposit: RE_DEPOSIT.test(text), withdraw: RE_WITHDRAW.test(text) }
    if (top.sign === '-') kind = 'withdraw'
    else if (top.sign === '+') kind = 'deposit'
    else if (says.deposit) kind = 'deposit'
    else if (says.withdraw) kind = 'withdraw'
    // «انتقال:500,000» with no sign and no other word: Bank Melli's deposit layout.
    else if (/انتقال/.test(text)) kind = 'deposit'
  }
  return { kind, candidates: found.map((c) => c.rial), amountRial: top ? top.rial : null, redacted }
}

/** The fixed word of this SMS the owner can filter on in the forwarder app. */
export function depositKeywordOf(raw: string): string | null {
  const text = normalizeSms(raw)
  return DEPOSIT_KEYWORDS.find((word) => text.includes(word)) ?? null
}

export interface ForwardedSms {
  text: string
  from: string
  to: string
}

/** Forwarder apps and SMS panels disagree on field names and on POST vs GET; accept all of them. */
export function readForwardedSms(input: { body?: unknown; query?: Record<string, string | undefined> }): ForwardedSms {
  const pick = (source: unknown, keys: string[]): string => {
    if (!source || typeof source !== 'object') return ''
    const row = source as Record<string, unknown>
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number') return String(value)
    }
    return ''
  }
  const textKeys = ['text', 'message', 'msg', 'body', 'content', 'sms', 'Body', 'Text', 'Message']
  const fromKeys = ['from', 'sender', 'number', 'address', 'phone', 'From', 'Sender']
  const toKeys = ['to', 'receiver', 'line', 'To']
  let body = input.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = { text: body }
    }
  }
  return {
    text: pick(body, textKeys) || pick(input.query, textKeys),
    from: pick(body, fromKeys) || pick(input.query, fromKeys),
    to: pick(body, toKeys) || pick(input.query, toKeys),
  }
}
