/**
 * Shape-certain evidence checks used to verify what the understanding model
 * reported. These are not intent detectors: they only answer «does this
 * number / phone / word really appear in what the customer wrote?».
 * (The only place in lib/agent/ where Persian regex literals are allowed.)
 */
import { normalizeIranianMobile, toEnglishDigits } from '@/lib/phone'

/** Normalization shared by every evidence check. */
export function normalizeEvidenceText(value: string): string {
  return toEnglishDigits(value)
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ى/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[‌‍]/g, ' ')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa')
}

/** Same text without spaces: «میزتلویزیون» and «میز تلویزیون» compare equal. */
export function compactEvidenceText(value: string): string {
  return normalizeEvidenceText(value).replace(/[\s\-_.،,]/g, '')
}

/** Every digit run in the text, ASCII. */
export function digitRuns(value: string): string[] {
  return toEnglishDigits(value).match(/\d+/g) ?? []
}

/** The digits of `value` (e.g. a phone or order ref) occur in `text`. */
export function digitsAppearIn(value: string, text: string): boolean {
  const wanted = toEnglishDigits(value).replace(/\D/g, '')
  if (!wanted) return false
  const haystack = toEnglishDigits(text).replace(/[\s\-()]/g, '')
  if (haystack.includes(wanted)) return true
  // 09121234567 written as +98 912 123 4567: compare national forms.
  const nationalWanted = normalizeIranianMobile(wanted)
  if (!nationalWanted) return false
  return digitRuns(toEnglishDigits(text).replace(/[\s\-()]/g, '')).some((run) => normalizeIranianMobile(run) === nationalWanted)
}

/** A valid Iranian mobile written in the message, normalized (09XXXXXXXXX). */
export function verifiedMobile(value: string, message: string): string | null {
  const phone = normalizeIranianMobile(value)
  if (!phone) return null
  return digitsAppearIn(phone.slice(1), message) ? phone : null
}

const UNIT_WORDS: Array<[RegExp, number]> = [
  [/میلیارد|billion/u, 1_000_000_000],
  [/میلیون|million|م(?=\s|$)/u, 1_000_000],
  [/هزار|thousand|k(?=\s|$)/u, 1_000],
]

/**
 * A price the model converted to Toman («۱۵ میلیون» → 15000000) is backed by
 * the message: some number in the message times a unit word (or as-is)
 * equals the value.
 */
export function priceAppearsIn(value: number, message: string): boolean {
  if (!Number.isFinite(value) || value <= 0) return false
  const text = normalizeEvidenceText(message)
  const numbers = (text.match(/\d+(?:[.,/]\d+)?/g) ?? []).map((raw) => Number(raw.replace(/,/g, '').replace('/', '.')))
  const multipliers = [1, ...UNIT_WORDS.filter(([pattern]) => pattern.test(text)).map(([, multiplier]) => multiplier)]
  // «۵۰۰ تومن» is colloquial for 500 thousand Toman.
  const colloquialThousands = /تومن|تومان|toman/u.test(text)
  return numbers.some((number) => multipliers.some((multiplier) => Math.abs(number * multiplier - value) < 1)
    || (colloquialThousands && number < 10_000 && Math.abs(number * 1_000 - value) < 1))
}

/** A word or phrase occurs in the text (normalized, spacing-insensitive). */
export function phraseAppearsIn(phrase: string, ...texts: string[]): boolean {
  const wanted = compactEvidenceText(phrase)
  if (wanted.length < 2) return false
  return texts.some((text) => compactEvidenceText(text).includes(wanted))
}

/**
 * Most meaningful tokens of `value` occur in the message («تهران، سعادت‌آباد،
 * خیابان سرو، پلاک ۱۲» rewritten with a comma less still counts).
 */
export function tokensMostlyIn(value: string, message: string, ratio = 0.7): boolean {
  const tokens = normalizeEvidenceText(value).split(/[\s،,.:;/\-]+/u).filter((token) => token.length >= 2)
  if (!tokens.length) return false
  const haystack = compactEvidenceText(message)
  const found = tokens.filter((token) => haystack.includes(token.replace(/\s/g, ''))).length
  return found / tokens.length >= ratio
}

/** A leading-zero product code shape («0788») — never a phone number. */
export function isProductCodeShape(value: string): boolean {
  const digits = toEnglishDigits(value).trim()
  return /^0\d{2,7}$/.test(digits) || /^[a-z]{0,4}[-_]?\d{2,10}$/i.test(digits)
}
