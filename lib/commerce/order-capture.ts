/**
 * In-chat pre-order capture — the pure, deterministic half (no DB, no LLM).
 *
 * The agent never takes payment and never "confirms" an order by itself. It
 * collects a structured pre-order (product/variant/quantity + name, mobile,
 * city/address), shows the customer a summary, and only on an explicit
 * confirmation files it for an operator who coordinates payment and shipping.
 * Every customer-facing sentence here is built from real draft data, so the
 * flow can never claim something that did not happen.
 *
 * Parsing is conservative: a value is taken only when its shape is certain
 * (a valid Iranian mobile, a 10-digit postal code, a line with street cues,
 * a known city) or when the agent has just asked for exactly that field.
 */
import { displayPhone, normalizeIranianMobile, toEnglishDigits } from '@/lib/phone'
import { findIranianCity } from '@/lib/ai/fact-capture'
import { looksLikePersonName } from '@/lib/ai/customer-identification'

export type OrderSlot = 'product' | 'variant' | 'name' | 'phone' | 'address' | 'confirm'
export type OrderDraftStatus = 'COLLECTING' | 'AWAITING_CONFIRM' | 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'
export type OrderLang = 'fa' | 'en'

export interface OrderDraftItem {
  productId: string
  variationId: number | null
  name: string
  variant: string | null
  quantity: number
  unitPrice: number | null
  url: string | null
  /** Stock ceiling when the catalog tracks an exact quantity. */
  maxQuantity: number | null
}

export interface OrderDraftState {
  code: string
  status: OrderDraftStatus
  items: OrderDraftItem[]
  customerName: string | null
  customerPhone: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  note: string | null
  expecting: OrderSlot | null
}

export interface OrderSlotValues {
  name?: string
  phone?: string
  city?: string
  address?: string
  postalCode?: string
  quantity?: number
}

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

function wordCount(value: string): number {
  return value.split(/\s+/u).filter(Boolean).length
}

// ─── Intent / control detection ─────────────────────────────────────────────

/** Tracking an EXISTING order is a different intent (read-only order lookup). */
const ORDER_STATUS_RE =
  /(?:ثبت\s?(?:شده|شد)(?:\s|$|؟|\?)|کجاست|پیگیری|رهگیری|وضعیت|ارسال\s?(?:شده|شد|کردید|کردین)|نرسیده|کد\s?رهگیری|تحویل\s?(?:نشده|ندادن))/u

const ORDER_INTENT_RES: RegExp[] = [
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
const ORDER_OFFER_RE =
  /(?:براتون|برایتان|واستون)\s?(?:ثبت(?:ش)?\s?کنم|سفارش(?:ش)?\s?(?:رو\s)?ثبت\s?کنم)|همین\s?جا\s?(?:براتون\s)?(?:ثبت(?:ش)?\s?(?:می\s?)?کنم|پیش\s?سفارش)|want\s+me\s+to\s+(?:place|register)\s+(?:the|an|your)?\s*order/u

export function assistantOfferedOrder(lastAssistantText: string | null | undefined): boolean {
  return Boolean(lastAssistantText) && ORDER_OFFER_RE.test(normalizeOrderText(lastAssistantText ?? ''))
}

const CONFIRM_RE =
  /^(?:بله|بلی|آره|اره|آری|اوکی|اوکیه|ok|okay|yes|yep|yeah|sure|confirm(?:ed)?|تایید|تأیید|تاییده|تأییده|تایید\s?(?:می\s?)?کنم|تأیید\s?(?:می\s?)?کنم|درسته|درست\s?است|درسته\s?همه\s?چی|صحیحه|همینه|همه\s?چی\s?درسته|همه\s?(?:چیز\s)?درسته|ثبت\s?کن(?:ید|ین)?|ثبتش\s?کن(?:ید|ین)?|حله|باشه|موافقم|چشم|بفرست(?:ید|ین)?|👍|✅)(?:\s|$|[.!،,]|ممنون|مرسی|لطفا)/u

export function isOrderConfirmation(message: string): boolean {
  const text = normalizeOrderText(message)
  return wordCount(text) <= 6 && CONFIRM_RE.test(text) && !/(?:^|\s)(?:نه|ولی|اما|فقط)(?:\s|$)/u.test(text)
}

const DECLINE_RE = /^(?:نه|نخیر|خیر|no|nope|اشتباه(?:ه)?|درست\s?نیست|غلطه|یه\s?چیزی\s?اشتباهه)(?:\s|$|[.!،,])/u

export function isOrderDecline(message: string): boolean {
  const text = normalizeOrderText(message)
  return wordCount(text) <= 6 && DECLINE_RE.test(text)
}

const CANCEL_RE =
  /(?:^|\s)(?:لغو(?:ش)?|کنسل(?:ش)?|بی\s?خیال(?:ش)?|منصرف|پشیمون|نمی\s?خوام(?:ش)?(?:\s|$)|نمیخوام(?:ش)?(?:\s|$)|نمیخام(?:ش)?(?:\s|$)|فعلا\s?نه|cancel|never\s?mind|forget\s+it)/u

export function isOrderCancellation(message: string): boolean {
  const text = normalizeOrderText(message)
  if (wordCount(text) > 8) return false
  if (/\d{5,}/.test(text)) return false
  return CANCEL_RE.test(text)
}

const QUESTION_RE =
  /[؟?]|(?:^|\s)(?:چند|چقدر|چقد|کی|چطور|چطوری|چجوری|آیا|میشه|می\s?شه|چیه|کجا|کدوم|هزینه|how|when|what|can|does|is\s+there)(?:\s|$)/u

export function isQuestion(message: string): boolean {
  return QUESTION_RE.test(normalizeOrderText(message))
}

// ─── Slot extraction ────────────────────────────────────────────────────────

const ADDRESS_CUE_RE =
  /(?:^|\s|،|,)(?:خیابان|خیابون|خ\s?\.|کوچه|ک\s?\.|بلوار|بلوار|پلاک|میدان|میدون|بزرگراه|محله|شهرک|فاز|واحد|طبقه|جاده|روستا|بن\s?بست|نبش|جنب|روبروی|روبه\s?روی|انتهای|ابتدای|کوی|مجتمع|برج|ساختمان|بلوک|street|st\.|avenue|ave\.?|alley|apt|unit|floor|no\.)/u

const LABEL_RE =
  /^(?:اسم(?:م)?|نام(?:م)?|نام\s?و\s?نام\s?خانوادگی|نام\s?خانوادگی|شماره(?:\s?(?:تماس|موبایل|همراه|تلفن))?|موبایل|تلفن|تماس|آدرس(?:م)?|نشانی|شهر(?:م)?|کد\s?پستی|name|phone|mobile|address|city|postal\s?code|zip)\s*[:：\-]?\s*/u

const NUMBER_WORDS: Record<string, number> = {
  'یه': 1, 'یک': 1, 'یدونه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
}

function extractQuantity(text: string): number | undefined {
  const digit = text.match(/(?:^|\s|تعداد\s?:?\s?)(\d{1,2})\s?(?:تا|تایی|عدد|دونه|دانه|ست|pcs|pieces|x)(?:\s|$|[.،,])/u)
    ?? text.match(/(?:^|\s)تعداد\s?:?\s?(\d{1,2})(?:\s|$)/u)
  if (digit) {
    const value = Number(digit[1])
    return value >= 1 && value <= 50 ? value : undefined
  }
  const word = text.match(/(?:^|\s)(یه|یک|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|ده)\s?(?:تا|تایی|عدد|دونه|دانه|ست)(?:\s|$|[.،,])/u)
  if (word) return NUMBER_WORDS[word[1]]
  if (/(?:^|\s)یدونه(?:\s|$)/u.test(text)) return 1
  return undefined
}

function extractPhone(text: string): { phone: string; raw: string } | null {
  // «0912 345 6789» / «0912-345-6789»: join digit groups before matching.
  const joined = text.replace(/(\d)[\s\-.](?=\d)/g, '$1')
  const match = joined.match(/(?:\+98|0098|98|0)?9\d{9}(?!\d)/)
  if (!match) return null
  const phone = normalizeIranianMobile(match[0])
  return phone ? { phone, raw: match[0] } : null
}

function extractPostalCode(text: string, phoneRaw: string | null): string | undefined {
  const joined = text.replace(/(\d)[\s\-](?=\d)/g, '$1')
  for (const match of joined.matchAll(/(?<!\d)(\d{10})(?!\d)/g)) {
    const value = match[1]
    if (phoneRaw && phoneRaw.endsWith(value)) continue
    if (/^09/.test(value)) continue
    return value
  }
  return undefined
}

function stripDigitsNoise(line: string, remove: string[]): string {
  let output = line
  for (const token of remove) {
    if (!token) continue
    output = output.replace(token, ' ')
  }
  return output.replace(/\s+/g, ' ').trim()
}

function cleanChunk(value: string): string {
  return value.replace(/^[\s:：\-–—•*،,.]+|[\s:：\-–—•*،,.]+$/gu, '').trim()
}

const CONTROL_WORDS_RE =
  /^(?:بله|آره|اره|نه|باشه|اوکی|ok|سلام|ممنون|مرسی|ممنونم|لطفا|حتما|چشم|تایید|تأیید|درسته|همینه|thanks|thank you|hi|hello)$/u

function asPersonName(chunk: string): string | null {
  const value = cleanChunk(chunk.replace(/^(?:من|اسمم|نامم|به\s?نام|به\s?اسم)\s+/u, '').replace(/\s+(?:هستم|هستش|ام|ه)$/u, ''))
  if (!value || /\d/.test(value) || !/^\p{L}/u.test(value)) return null
  if (wordCount(value) > 4 || value.length > 40) return null
  if (CONTROL_WORDS_RE.test(value) || QUESTION_RE.test(value) || ADDRESS_CUE_RE.test(` ${value}`)) return null
  if (findIranianCity(value) === value) return null
  if (!looksLikePersonName(value.split(/\s+/u).slice(0, 3).join(' '))) return null
  return value
}

/**
 * Pull order fields out of one customer message. `expecting` (the field the
 * agent asked for last) unlocks shape-less values: a bare «علی رضایی» is a
 * name only when a name was asked for, a street-less line is an address only
 * when an address was asked for.
 */
export function extractOrderSlots(message: string, expecting: OrderSlot | null, missing: OrderSlot[] = []): OrderSlotValues {
  const original = toEnglishDigits(message.normalize('NFKC')).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ')
  const lowered = normalizeOrderText(message)
  const out: OrderSlotValues = {}

  const phone = extractPhone(original)
  if (phone) out.phone = phone.phone
  const postal = extractPostalCode(original, phone?.raw ?? null)
  if (postal) out.postalCode = postal
  const quantity = extractQuantity(lowered)
  if (quantity) out.quantity = quantity

  const wantsName = expecting === 'name' || missing.includes('name')
  const wantsAddress = expecting === 'address' || missing.includes('address')

  const lines = original
    .split(/\n+/u)
    .map((line) => stripDigitsNoise(line, [phone?.raw ?? '', postal ?? '']))
    .map((line) => line.replace(/(?:شماره(?:\s?(?:تماس|موبایل|همراه))?|موبایل|تلفن|کد\s?پستی)\s*[:：]?\s*$/u, '').trim())
    .filter(Boolean)

  for (const rawLine of lines) {
    const labelMatch = rawLine.match(LABEL_RE)
    const label = labelMatch?.[0]?.replace(/[\s:：\-]+$/u, '').trim() ?? ''
    const line = cleanChunk(labelMatch ? rawLine.slice(labelMatch[0].length) : rawLine)
    if (!line) continue

    if (/^(?:اسم|نام|name)/u.test(label)) {
      const name = asPersonName(line) ?? (wordCount(line) <= 4 && !/\d/.test(line) ? line : null)
      if (name) out.name = name
      continue
    }
    if (/^(?:شهر|city)/u.test(label)) {
      out.city = findIranianCity(line) ?? line.slice(0, 40)
      continue
    }
    if (/^(?:آدرس|نشانی|address)/u.test(label)) {
      out.address = line.slice(0, 300)
      out.city ??= findIranianCity(line) ?? undefined
      continue
    }

    if (ADDRESS_CUE_RE.test(` ${line}`)) {
      // «علی رضایی تهران خیابان آزادی پلاک ۱۲»: name, then city, then street.
      const city = findIranianCity(line)
      let address = line
      if (city) {
        const cityIndex = normalizeOrderText(line).indexOf(normalizeOrderText(city))
        const cueIndex = normalizeOrderText(` ${line}`).search(ADDRESS_CUE_RE)
        if (cityIndex >= 0 && (cueIndex < 0 || cityIndex <= cueIndex)) {
          const before = cleanChunk(line.slice(0, cityIndex))
          if (before) {
            const name = asPersonName(before)
            if (name && !out.name) out.name = name
          }
          address = cleanChunk(line.slice(cityIndex))
        }
        out.city ??= city
      }
      out.address = address.slice(0, 300)
      continue
    }

    const city = findIranianCity(line)
    if (city && wordCount(line.replace(/^(?:شهر|استان)\s+/u, '')) <= 2) {
      out.city = city
      continue
    }

    // A bare one-line name counts only when the name was the question just
    // asked, or when it arrives alongside other order data («علی ۰۹۱۲…»).
    const name = asPersonName(line)
    if (name && !out.name && (expecting === 'name' || lines.length > 1 || Boolean(out.phone))) {
      out.name = name
      continue
    }

    // A street-less line is an address only when one was just asked for.
    if (wantsAddress && wordCount(line) >= 2 && !QUESTION_RE.test(line) && !out.address && /\p{L}/u.test(line)) {
      out.address = line.slice(0, 300)
      out.city ??= findIranianCity(line) ?? undefined
    }
  }
  return out
}

// ─── Draft state helpers ────────────────────────────────────────────────────

export function newDraftCode(random: () => number = Math.random): string {
  // No 0/O/1/I: codes are read aloud over the phone by operators.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) code += alphabet[Math.floor(random() * alphabet.length)]
  return code
}

export function hasFullAddress(draft: Pick<OrderDraftState, 'city' | 'address'>): boolean {
  return Boolean(draft.address && (draft.city || findIranianCity(draft.address)))
}

/** Remaining fields in the order they are asked for. */
export function missingOrderSlots(draft: OrderDraftState, needsVariant: boolean): OrderSlot[] {
  const missing: OrderSlot[] = []
  if (!draft.items.length) missing.push('product')
  else if (needsVariant) missing.push('variant')
  if (!draft.customerName) missing.push('name')
  if (!draft.customerPhone) missing.push('phone')
  if (!hasFullAddress(draft)) missing.push('address')
  return missing
}

/** Merge parsed values into the draft. Returns true when anything changed. */
export function applyOrderSlots(draft: OrderDraftState, slots: OrderSlotValues): boolean {
  let changed = false
  const set = <K extends 'customerName' | 'customerPhone' | 'city' | 'address' | 'postalCode'>(key: K, value: string | undefined) => {
    if (!value || draft[key] === value) return
    draft[key] = value
    changed = true
  }
  set('customerName', slots.name)
  set('customerPhone', slots.phone)
  set('city', slots.city)
  set('address', slots.address)
  set('postalCode', slots.postalCode)
  if (slots.quantity && draft.items[0] && draft.items[0].quantity !== slots.quantity) {
    const max = draft.items[0].maxQuantity
    draft.items[0].quantity = max != null && max > 0 ? Math.min(slots.quantity, max) : slots.quantity
    changed = true
  }
  return changed
}

export function orderTotal(draft: Pick<OrderDraftState, 'items'>): number | null {
  if (!draft.items.length || draft.items.some((item) => item.unitPrice == null)) return null
  return draft.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)
}

// ─── Customer-facing text ───────────────────────────────────────────────────

function faNumber(value: number): string {
  return value.toLocaleString('fa-IR')
}

function itemLabel(item: OrderDraftItem): string {
  return item.variant ? `${item.name} — ${item.variant}` : item.name
}

function slotLabels(missing: OrderSlot[], draft: OrderDraftState, lang: OrderLang): string[] {
  return missing.flatMap((slot) => {
    if (slot === 'name') return [lang === 'en' ? 'your full name' : 'نام و نام خانوادگی']
    if (slot === 'phone') return [lang === 'en' ? 'your mobile number' : 'شماره موبایل']
    if (slot === 'address') {
      if (draft.city && !draft.address) return [lang === 'en' ? `your full address in ${draft.city} (postal code too, if you have it)` : `آدرس کامل در ${draft.city} (کد پستی هم اگه دارید)`]
      return [lang === 'en' ? 'city and full address (postal code too, if you have it)' : 'شهر و آدرس کامل (کد پستی هم اگه دارید)']
    }
    return []
  })
}

function joinFa(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join('، ')} و ${parts.at(-1)}`
}

function joinEn(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

export function composeProductQuestion(candidates: Array<{ name: string }>, lang: OrderLang): string {
  if (candidates.length > 1) {
    const list = candidates.slice(0, 6).map((item, index) => `${lang === 'en' ? index + 1 : faNumber(index + 1)}. ${item.name}`).join('\n')
    return lang === 'en'
      ? `Sure, which one would you like?\n${list}`
      : `حتماً؛ کدوم رو می‌خواید؟\n${list}`
  }
  return lang === 'en'
    ? 'Sure, which product would you like? Send its name or code and I’ll set it up.'
    : 'حتماً 🙂 کدوم محصول رو می‌خواید؟ اسم یا کدش رو بفرستید تا ثبتش کنم'
}

export function composeVariantQuestion(item: OrderDraftItem, options: string[], lang: OrderLang): string {
  const list = options.slice(0, 8)
  return lang === 'en'
    ? `“${item.name}” is available in: ${list.join(', ')}. Which one would you like?`
    : `«${item.name}» الان در این مدل‌ها موجوده: ${list.join('، ')}\nکدوم رو می‌خواید؟`
}

/**
 * Ask for what is still missing. `opening` = the first message of a fresh
 * draft (names the product); otherwise a short thank-you + remaining fields.
 */
export function composeOrderAsk(params: {
  draft: OrderDraftState
  missing: OrderSlot[]
  lang: OrderLang
  opening: boolean
  /** Nothing usable was parsed from the last message (re-ask gently). */
  unparsed?: boolean
}): string {
  const { draft, lang } = params
  const labels = slotLabels(params.missing, draft, lang)
  const item = draft.items[0]
  if (params.opening && item) {
    const qty = item.quantity > 1 ? (lang === 'en' ? ` × ${item.quantity}` : ` (${faNumber(item.quantity)} عدد)`) : ''
    if (lang === 'en') {
      return `Great, I’ll set up “${itemLabel(item)}”${qty} for you right here.\nPlease send:\n${labels.map((label) => `• ${label}`).join('\n')}`
    }
    return `عالیه 🌿 «${itemLabel(item)}»${qty} رو همین‌جا براتون ثبت می‌کنم.\nبرای ارسال این‌ها رو بفرستید:\n${labels.map((label) => `• ${label}`).join('\n')}`
  }
  if (params.unparsed) {
    return lang === 'en'
      ? `To complete the order I just need ${joinEn(labels)}; you can send them all in one message.`
      : `برای تکمیل سفارش فقط ${joinFa(labels)} لازمه؛ می‌تونید همه رو توی یه پیام بفرستید`
  }
  const firstName = draft.customerName?.split(/\s+/u)[0]
  if (lang === 'en') return `Thanks${firstName ? ` ${firstName}` : ''}! Just ${joinEn(labels)} left.`
  return `ممنون${firstName ? ` ${firstName}` : ''} 🙏 فقط ${joinFa(labels)} رو هم بفرستید`
}

export function composeOrderSummary(draft: OrderDraftState, lang: OrderLang, corrected = false): string {
  const total = orderTotal(draft)
  const lines: string[] = []
  if (lang === 'en') {
    lines.push(corrected ? 'Updated 👌 Here is your order:' : 'Here is your order:')
    for (const item of draft.items) lines.push(`🛍 ${itemLabel(item)} × ${item.quantity}`)
    if (total != null) lines.push(`💰 Items total: ${total.toLocaleString('en-US')} Toman`)
    lines.push(`👤 ${draft.customerName} · ${displayPhone(draft.customerPhone) ?? draft.customerPhone}`)
    lines.push(`📍 ${[draft.city, draft.address].filter(Boolean).join(', ')}${draft.postalCode ? ` · postal code ${draft.postalCode}` : ''}`)
    lines.push('If everything is correct, reply “confirm” and I’ll file it; if something needs changing, just send the correct value.')
    return lines.join('\n')
  }
  lines.push(corrected ? 'اصلاح شد 👌 خلاصهٔ سفارشتون:' : 'خلاصهٔ سفارشتون:')
  for (const item of draft.items) lines.push(`🛍 ${itemLabel(item)} × ${faNumber(item.quantity)}`)
  if (total != null) lines.push(`💰 مبلغ کالا: ${faNumber(total)} تومان`)
  lines.push(`👤 ${draft.customerName} · ${displayPhone(draft.customerPhone) ?? draft.customerPhone}`)
  const address = draft.address && draft.city && normalizeOrderText(draft.address).includes(normalizeOrderText(draft.city))
    ? draft.address
    : [draft.city, draft.address].filter(Boolean).join('، ')
  lines.push(`📍 ${address}${draft.postalCode ? ` · کد پستی ${draft.postalCode}` : ''}`)
  lines.push('اگه همه‌چیز درسته «تأیید» رو بفرستید تا ثبتش کنم؛ اگه چیزی باید عوض بشه، همون رو درستش رو بفرستید')
  return lines.join('\n')
}

export function composeOrderSubmitted(draft: OrderDraftState, lang: OrderLang): string {
  return lang === 'en'
    ? `Your pre-order is filed ✅\nReference: ${draft.code}\nA colleague will message you here to arrange payment and delivery.`
    : `پیش‌سفارشتون ثبت شد ✅\nکد پیگیری: ${draft.code}\nهمکارم برای هماهنگی پرداخت و ارسال همین‌جا بهتون پیام می‌ده`
}

export function composeOrderDeclined(lang: OrderLang): string {
  return lang === 'en'
    ? 'No problem. Which part should I change? Just send the correct value.'
    : 'باشه؛ کدوم مورد رو اصلاح کنم؟ همون رو با مقدار درست بفرستید'
}

export function composeOrderCancelled(lang: OrderLang): string {
  return lang === 'en'
    ? 'Okay, I’ve cancelled this order. Whenever you’re ready, just tell me.'
    : 'باشه، این سفارش رو لغو کردم 🙂 هر وقت خواستید دوباره بگید'
}

export function composeItemUnavailable(item: Pick<OrderDraftItem, 'name' | 'variant'>, lang: OrderLang, restockLine: string | null): string {
  const label = item.variant ? `${item.name} — ${item.variant}` : item.name
  if (lang === 'en') return `“${label}” is out of stock right now.${restockLine ? ` ${restockLine}` : ' I can suggest a similar available model if you like.'}`
  return `«${label}» الان ناموجوده 😕${restockLine ? `\n${restockLine}` : '\nاگه بخواید مدل موجودِ مشابهش رو پیشنهاد می‌دم'}`
}

/**
 * Per-turn instruction for the reply model when the customer asks a question
 * in the middle of an order: answer it, then remind the one next step. The
 * model must never claim the order is already filed.
 */
export function orderInProgressInstruction(draft: OrderDraftState, missing: OrderSlot[], lang: OrderLang): string {
  const item = draft.items[0]
  const labels = slotLabels(missing.filter((slot) => slot !== 'product' && slot !== 'variant'), draft, lang)
  const next = missing.includes('product')
    ? (lang === 'en' ? 'which product they want' : 'اینکه کدوم محصول رو می‌خواد')
    : missing.includes('variant')
      ? (lang === 'en' ? 'which variant they want' : 'اینکه کدوم مدل/طرح رو می‌خواد')
      : labels.length
        ? (lang === 'en' ? joinEn(labels) : joinFa(labels))
        : (lang === 'en' ? 'a confirmation of the summary' : 'تأیید خلاصهٔ سفارش')
  if (lang === 'en') {
    return `=== In-chat order in progress ===\nThe customer is placing a pre-order${item ? ` for “${itemLabel(item)}” × ${item.quantity}` : ''}. Answer their question briefly from the trusted data, then in one short sentence remind them that to finish the order you still need ${next}. Never say the order is placed or registered; it is filed only after they confirm the summary.`
  }
  return `=== پیش‌سفارش درون‌چت در جریان است ===\nمشتری در حال ثبت پیش‌سفارش${item ? ` «${itemLabel(item)}» × ${faNumber(item.quantity)}` : ''} است. اول کوتاه و فقط از دادهٔ معتبر به سؤالش جواب بده، بعد در یک جملهٔ کوتاه یادآوری کن که برای تکمیل سفارش هنوز ${next} لازم است. هرگز نگو سفارش ثبت شد؛ ثبت فقط بعد از تأیید خلاصه انجام می‌شود.`
}

/** Operator-facing plain-text summary (handoff alert, Telegram, dashboard). */
export function formatOrderForOperator(draft: OrderDraftState): string {
  const total = orderTotal(draft)
  const lines = [`🛒 پیش‌سفارش #${draft.code}`]
  for (const item of draft.items) {
    const price = item.unitPrice != null ? ` — ${faNumber(item.unitPrice * item.quantity)} تومان` : ''
    lines.push(`• ${itemLabel(item)} × ${faNumber(item.quantity)}${price}`)
  }
  if (total != null && draft.items.length > 1) lines.push(`جمع کالا: ${faNumber(total)} تومان`)
  lines.push(`مشتری: ${draft.customerName ?? '—'} — ${displayPhone(draft.customerPhone) ?? '—'}`)
  lines.push(`آدرس: ${[draft.city, draft.address].filter(Boolean).join('، ') || '—'}${draft.postalCode ? ` — کد پستی ${draft.postalCode}` : ''}`)
  lines.push('پرداخت و هزینهٔ ارسال هنوز با مشتری هماهنگ نشده است.')
  return lines.join('\n')
}

/** «دومی»، «۲»، «اولی رو» → zero-based index into the offered list. */
export function parseOrdinalChoice(message: string, count: number): number | null {
  const text = normalizeOrderText(message)
  if (wordCount(text) > 6) return null
  const ordinals: Array<[RegExp, number]> = [
    [/(?:^|\s)(?:اولی|اول|یکمی|first)(?:\s|$|رو|و)/u, 0],
    [/(?:^|\s)(?:دومی|دوم|second)(?:\s|$|رو|و)/u, 1],
    [/(?:^|\s)(?:سومی|سوم|third)(?:\s|$|رو|و)/u, 2],
    [/(?:^|\s)(?:چهارمی|چهارم|fourth)(?:\s|$|رو|و)/u, 3],
    [/(?:^|\s)(?:پنجمی|پنجم|fifth)(?:\s|$|رو|و)/u, 4],
    [/(?:^|\s)(?:ششمی|ششم|sixth)(?:\s|$|رو|و)/u, 5],
  ]
  for (const [pattern, index] of ordinals) if (pattern.test(text)) return index < count ? index : null
  if (/(?:^|\s)(?:آخری|last)(?:\s|$)/u.test(text)) return count - 1
  const bare = text.match(/^(?:شماره\s)?(\d)(?:\s?(?:رو|را|ی|می))?$/u)
  if (bare) {
    const index = Number(bare[1]) - 1
    return index >= 0 && index < count ? index : null
  }
  return null
}
