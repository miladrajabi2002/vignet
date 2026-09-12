import type { ChatMessage } from '@/lib/ai/openrouter'

/**
 * Deterministic per-turn language detection for customer-facing replies.
 *
 * The platform's reply language used to be pinned by `Agent.language`
 * («به زبان فارسی پاسخ بده»), so an Arabic- or English-writing customer of
 * a Persian shop still got Persian answers. The chat kernel now mirrors the
 * customer's own language: the LLM path follows a universal mirroring
 * instruction (agent-kernel/skills/language-mirroring) and the deterministic
 * bypass paths (variant vitrines, showcases, canned notices) pick their
 * template locale from THIS detector — synchronously, with no extra model
 * call, latency or cost.
 *
 * Contract:
 *  - 'fa' → Persian templates (default; the platform's operating language)
 *  - 'en' → Latin-script templates (English)
 *  - 'ar' → Arabic templates (script is Arabic but the text is NOT Persian)
 *  - Messages with no letters at all (digits, emoji, «0788») inherit the last
 *    lettered customer message; with none in history the default is 'fa'.
 */

export type TurnLanguage = 'fa' | 'en' | 'ar'

/** Reply locales the deterministic templates are authored for. */
export const CANNED_REPLY_LANGUAGES: readonly TurnLanguage[] = ['fa', 'ar', 'en']

// Letters that exist in Persian but NOT in standard Arabic orthography.
const PERSIAN_ONLY = /[پچژگ]/g
// Persian-specific forms of ی/ک (Arabic uses U+064A/U+0643 instead).
const PERSIAN_YEH = /\u06CC/g
const PERSIAN_KAF = /\u06A9/g
// The zero-width non-joiner is a hallmark of Persian orthography (می‌خوام).
const ZWNJ = /\u200C/g
// Letters/marks that exist in Arabic but are absent from Persian words.
const ARABIC_ONLY = /[\u0629\u064A\u0643\u0671\u06C1]/g
const ARABIC_TASHKEEL = /[\u064B-\u0652\u0670]/g

/** Arabic function words that never appear in Persian text (normalized to ی/ک). */
const ARABIC_WORDS = new Set([
  'مرحبا', 'اهلا', 'اهلاوسهلا', 'شكرا', 'شكراجزيلا', 'شكراجزیلا', 'الحمدلله',
  'کیف', 'کیفک', 'کیفكم', 'هل', 'انا', 'ارید', 'ابغی', 'بکم', 'کم', 'سعر',
  'اسعار', 'السعر', 'متوفر', 'متوفرة', 'المقاس', 'مقاس', 'الالوان', 'الوان',
  'لون', 'اللون', 'توصیل', 'الطلب', 'طلبات', 'ماذا', 'لماذا', 'وین',
  'فین', 'شو', 'ایش', 'ایه', 'ازای', 'عایز', 'عایزة', 'حلو', 'حلوة', 'کویس',
  'تمام', 'طیب', 'اوك', 'نعم', 'ورحمة', 'برکاته', 'صباح', 'مساء', 'الخیر',
  'اخی', 'اختی', 'استفسار', 'سمحت', 'رجاء', 'مع', 'الی', 'على', 'هذا',
  'هذه', 'ذلك', 'تلک',
])
/** Persian function words that never appear in Arabic text. */
const PERSIAN_WORDS = new Set([
  'سلام', 'درود', 'ممنون', 'مرسی', 'متشکرم', 'سپاس', 'تشکر', 'خوبی',
  'خوبین', 'خوبید', 'چطوری', 'چطورین', 'چطورید', 'قیمت', 'قیمته', 'چنده',
  'چند', 'موجوده', 'موجود', 'موجودین', 'دارین', 'دارید', 'داریدش', 'داره',
  'میخوام', 'می‌خوام', 'میخوامش', 'بفرست', 'بفرستید', 'بفرستین', 'نشون',
  'نشونم', 'بده', 'بدید', 'رنگ', 'رنگش', 'سایز', 'سایزش', 'طرح', 'طرحش',
  'هست', 'هستش', 'هستین', 'نیست', 'ندارم', 'ندارین', 'چیز', 'چیا', 'چه',
  'خبر', 'خداحافظ', 'خدانگهدار', 'بله', 'اره', 'آره', 'نه', 'باشه', 'اوکی',
  'میشه', 'میتونم', 'می‌تونم', 'تومان', 'تومن', 'خرید', 'فروش', 'سفارش',
  'ارسال', 'آدرس', 'نشانی', 'شماره', 'ساعت', 'کدوم', 'کدام', 'این', 'اون',
])

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

function classifyLetteredText(text: string): TurnLanguage {
  // Latin script dominates → English templates. Half the letters suffice:
  // short chats like "salam، این مدل چنده؟" are still mostly Latin words,
  // while a Persian sentence quoting a Latin brand stays Persian.
  const letters = text.replace(/[^\p{L}]/gu, '')
  if (!letters) return 'fa'
  const latin = (letters.match(/[A-Za-z]/g) ?? []).length
  if (latin / letters.length >= 0.5) return 'en'

  // Arabic-script scoring: Persian-only letters/forms vs Arabic-only ones.
  // Letter evidence is computed on the RAW text before yeh/kaf folding.
  const persianScore =
    countMatches(text, PERSIAN_ONLY) * 4 +
    countMatches(text, PERSIAN_YEH) +
    countMatches(text, PERSIAN_KAF) +
    countMatches(text, ZWNJ) * 3
  const arabicScore =
    countMatches(text, ARABIC_ONLY) * 3 +
    countMatches(text, ARABIC_TASHKEEL) * 2

  // Function-word evidence outweighs weak script signals. Arabic ي/ى/ك fold
  // to their Persian look-alikes so mixed-form words still match both lists.
  const normalized = text
    .replace(/[\u064A\u0649]/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
  const tokens = new Set(
    normalized
      .toLocaleLowerCase('fa')
      .split(/[^\p{L}\u200C]+/u)
      .filter(Boolean),
  )
  let persianWords = 0
  let arabicWords = 0
  for (const token of tokens) {
    if (ARABIC_WORDS.has(token)) arabicWords += 2
    else if (PERSIAN_WORDS.has(token)) persianWords += 2
  }

  const fa = persianScore + persianWords
  const ar = arabicScore + arabicWords

  // A bare «سلام» is Persian by platform default; Arabic wins only on
  // positive Arabic evidence (Arabic-only letters or Arabic function words).
  if (ar > 0 && ar >= fa) return 'ar'
  return 'fa'
}

/**
 * Detect the reply language for THIS turn from the customer's message.
 * Pure and synchronous — safe to call on every inbound turn.
 */
export function detectTurnLanguage(message: string, history: ChatMessage[] = []): TurnLanguage {
  const current = (message ?? '').trim()
  if (current) {
    const letters = current.replace(/[^\p{L}]/gu, '')
    if (letters.length >= 2) return classifyLetteredText(current)
  }

  // No usable letters in the current message («0788», «❤», «۰۷۰۶»): inherit
  // the last lettered CUSTOMER message so a bare code inside an Arabic chat
  // still gets the Arabic vitrine intro.
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]
    if (item.role !== 'user') continue
    const content = (item.content ?? '').trim()
    if (!content) continue
    const letters = content.replace(/[^\p{L}]/gu, '')
    if (letters.length >= 2) return classifyLetteredText(content)
  }

  return 'fa'
}

/** Locale used for number formatting in deterministic replies. */
export function numberLocale(lang: TurnLanguage): string {
  if (lang === 'en') return 'en-US'
  if (lang === 'ar') return 'ar-EG'
  return 'fa-IR'
}
