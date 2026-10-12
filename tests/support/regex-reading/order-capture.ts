/**
 * Test support: the regex detectors that used to stand in for a reading.
 * Production code takes these signals only from the verified reading of the
 * turn; flow tests use this to turn a Persian test message into the same
 * signals without calling a model.
 */
import { toEnglishDigits } from '@/lib/phone'

// ─── Normalization ──────────────────────────────────────────────────────────

export function normalizeOrderText(value: string): string {
  return toEnglishDigits(value)
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function wordCount(value: string): number {
  return value.split(/\s+/u).filter(Boolean).length
}

// ─── Intent / control detection ─────────────────────────────────────────────

/** Tracking an EXISTING order is a different intent (read-only order lookup). */
export const ORDER_STATUS_RE =
  /(?:ثبت\s?(?:شده|شد)(?:\s|$|؟|\?)|کجاست|پیگیری|رهگیری|وضعیت|ارسال\s?(?:شده|شد|کردید|کردین)|نرسیده|کد\s?رهگیری|تحویل\s?(?:نشده|ندادن))/u

export const ORDER_INTENT_RES: RegExp[] = [
  // «می‌خوام سفارش بدم»، «میخوام همینو بخرم»، «قصد دارم خرید کنم»
  /(?:می\s?خوا(?:م|یم|ستم)|میخا(?:م|یم)|قصد\s?دار(?:م|یم)|تصمیم\s?گرفتم)\s(?:(?:اینو|این\s?رو|همینو|همین\s?رو|اینارو|اونو|اون\s?رو|یکی|یه\s?دونه|ازش)\s)?(?:سفارش\s?(?:بدم|بدیم|بزنم|ثبت\s?کنم)|بخر(?:م|یم)(?:ش|شون)?|خرید\s?کنم|ثبت\s?(?:سفارش\s?)?کنم|ثبتش\s?کنم)/u,
  // «چطوری سفارش بدم؟»، «از کجا بخرم؟»
  /(?:چطور|چطوری|چجوری|چه\s?جوری|چگونه|از\s?کجا|کجا)\s(?:(?:می\s?تونم|میتونم|باید|میشه|می\s?شه)\s)?(?:سفارش\s?(?:بدم|بدیم|ثبت\s?کنم|بدیم)|بخر(?:م|یم)(?:ش)?|خرید\s?کنم|ثبت\s?سفارش\s?کنم)/u,
  /(?:روش|نحوه|مراحل)\s(?:ثبت\s)?(?:سفارش|خرید)/u,
  // «ثبت سفارش»، «سفارشمو ثبت کنید»
  /(?:^|\s)ثبت\s?(?:کردن\s)?(?:سفارش|خرید)(?:\s|$)/u,
  /(?:سفارش|خرید)(?:م|مو|مون|ش)?\s?(?:رو|را)?\s?(?:ثبت|نهایی|تکمیل)\s?(?:کن|کنید|کنین|میکنید|می\s?کنید|بشه|میشه|می\s?شه)/u,
  // «همینو برام بفرستید»، «یکی ازش برام بفرستید»
  /(?:اینو|همینو|همین\s?رو|این\s?رو|یه\s?دونه|یکی|دوتا|دو\s?تا)\s(?:ازش\s)?(?:برام|واسم|برای\s?من)\s(?:بفرست|ارسال\s?کن)/u,
  // «همینو می‌خوام» (not «اینو می‌خوام ببینم»)
  /(?:^|\s)(?:همینو|همین\s?رو|اینو|این\s?رو|همین\s?مدل\s?رو|همین\s?مدلو)\s(?:می\s?خوام|میخوام|میخام|برمی\s?دارم|برمیدارم)(?!\s?(?:ببینم|بدونم|بپرسم|عکس))/u,
  /(?:^|\s)(?:می\s?خرم(?:ش)?|میخرم(?:ش)?|بخرمش|خریدارم)(?:\s|$)/u,
  /سفارش\s?(?:می\s?دم|میدم|می\s?دهم|میدیم|می\s?دیم)/u,
  /(?:^|\s)پیش\s?سفارش\s?(?:بدم|می\s?خوام|میخوام|ثبت)/u,
  /\b(?:i(?:'d| would)?\s+(?:like|want)\s+to\s+(?:buy|order|purchase)|how\s+(?:can|do)\s+i\s+(?:buy|order|purchase)|i(?:'ll| will)\s+take\s+(?:it|this|one)|place\s+an?\s+order|(?:can|could)\s+i\s+(?:buy|order)\b)/u,
]

export function detectOrderIntent(message: string): boolean {
  const text = normalizeOrderText(message)
  if (!text || ORDER_STATUS_RE.test(text)) return false
  return ORDER_INTENT_RES.some((pattern) => pattern.test(text))
}

/** The agent's previous reply offered to take the order («می‌خواید براتون ثبتش کنم؟»). */
export const ORDER_OFFER_RE =
  /(?:براتون|برایتان|واستون)\s?(?:ثبت(?:ش)?\s?کنم|سفارش(?:ش)?\s?(?:رو\s)?ثبت\s?کنم)|همین\s?جا\s?(?:براتون\s)?(?:ثبت(?:ش)?\s?(?:می\s?)?کنم|پیش\s?سفارش)|want\s+me\s+to\s+(?:place|register)\s+(?:the|an|your)?\s*order/u

export function assistantOfferedOrder(lastAssistantText: string | null | undefined): boolean {
  return Boolean(lastAssistantText) && ORDER_OFFER_RE.test(normalizeOrderText(lastAssistantText ?? ''))
}

export const CONFIRM_RE =
  /^(?:بله|بلی|آره|اره|آری|اوکی|اوکیه|ok|okay|yes|yep|yeah|sure|confirm(?:ed)?|تایید|تأیید|تاییده|تأییده|تایید\s?(?:می\s?)?کنم|تأیید\s?(?:می\s?)?کنم|درسته|درست\s?است|درسته\s?همه\s?چی|صحیحه|همینه|همه\s?چی\s?درسته|همه\s?(?:چیز\s)?درسته|ثبت\s?کن(?:ید|ین)?|ثبتش\s?کن(?:ید|ین)?|حله|باشه|موافقم|چشم|بفرست(?:ید|ین)?|👍|✅)(?:\s|$|[.!،,]|ممنون|مرسی|لطفا)/u

export function isOrderConfirmation(message: string): boolean {
  const text = normalizeOrderText(message)
  return wordCount(text) <= 6 && CONFIRM_RE.test(text) && !/(?:^|\s)(?:نه|ولی|اما|فقط)(?:\s|$)/u.test(text)
}

export const DECLINE_RE = /^(?:نه|نخیر|خیر|no|nope|اشتباه(?:ه)?|درست\s?نیست|غلطه|یه\s?چیزی\s?اشتباهه)(?:\s|$|[.!،,])/u

export function isOrderDecline(message: string): boolean {
  const text = normalizeOrderText(message)
  return wordCount(text) <= 6 && DECLINE_RE.test(text)
}

export const CANCEL_RE =
  /(?:^|\s)(?:لغو(?:ش)?|کنسل(?:ش)?|بی\s?خیال(?:ش)?|منصرف|پشیمون|نمی\s?خوام(?:ش)?(?:\s|$)|نمیخوام(?:ش)?(?:\s|$)|نمیخام(?:ش)?(?:\s|$)|فعلا\s?نه|cancel|never\s?mind|forget\s+it)/u

export function isOrderCancellation(message: string): boolean {
  const text = normalizeOrderText(message)
  if (wordCount(text) > 8) return false
  if (/\d{5,}/.test(text)) return false
  return CANCEL_RE.test(text)
}

export const QUESTION_RE =
  /[؟?]|(?:^|\s)(?:چند|چقدر|چقد|کی|چطور|چطوری|چجوری|آیا|میشه|می\s?شه|چیه|کجا|کدوم|هزینه|how|when|what|can|does|is\s+there)(?:\s|$)/u

export function isQuestion(message: string): boolean {
  return QUESTION_RE.test(normalizeOrderText(message))
}
