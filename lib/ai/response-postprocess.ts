/**
 * Final-reply post-processing (A5).
 *
 * Persian messenger replies conventionally drop the trailing period: «الان چک
 * می‌کنم» reads natural while «الان چک می‌کنم.» feels stiff and bot-like. This
 * strips trailing full stops from short, single-paragraph Persian replies
 * right before persistence/delivery, so every channel (Telegram, Instagram,
 * Rubika, web widget, API) shares one canonical output.
 *
 * Deliberately conservative — the following stay untouched:
 *   • replies without any Persian/Arabic script (English, numbers, links)
 *   • multi-line replies and anything that looks like a list (bullets,
 *     numbered lines, markdown headers) — lists keep their terminal punctuation
 *   • long replies (> 480 chars) — usually structured content, not chat prose
 *   • ellipses mid-sentence and every other character (؟ ! … ‌) are preserved
 */

const PERSIAN_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
const LIST_LINE = /^\s*(?:[-*•·–—]|\d+[.)]|[۰-۹]+[.)]|#{1,6}\s)/
const TRAILING_PERIODS = /[\s\u200c]*[.。．]+$/g

/**
 * «۲،۴۷۰،۰۰۰ تومان»: with the Persian comma between its digit groups a price
 * reads as a list of three numbers. Only a number followed by its currency is
 * touched (تومان، تومن، ریال), so «سایز ۱۴۰،۱۶۰،۱۹۰» stays a list.
 */
const COMMA_GROUPED_PRICE = /[0-9\u06F0-\u06F9]{1,3}(?:\u060C[0-9\u06F0-\u06F9]{3})+(?=\s*(?:\u062A\u0648\u0645\u0627\u0646|\u062A\u0648\u0645\u0646|\u0631\u06CC\u0627\u0644))/g

export function normalizePriceGrouping(reply: string): string {
        return (reply ?? '').replace(COMMA_GROUPED_PRICE, (price) => price.replace(/\u060C/g, '\u066C'))
}

// ── Half-space repair ──────────────────────────────────────────────────────
// The reply model drops the zero-width non-joiner in some replies («میکنم»,
// «نسخههای», «شستوشو»). Only forms that are never a word of their own are
// repaired, from closed lists: no rule guesses at a word boundary.
const VERB_PREFIXES = ['می', 'نمی']
const PRESENT_STEMS = [
  'کن', 'خوا', 'خواه', 'تون', 'توان', 'ش', 'شو', 'د', 'ده', 'گ', 'گو', 'دون', 'دان', 'بین', 'ر', 'رو', 'زن', 'گیر', 'فرست',
  'ذار', 'گذار', 'مون', 'مان', 'رس', 'خر', 'پرس', 'سپار', 'ساز', 'شناس', 'نویس', 'خور', 'بر', 'پسند', 'کش', 'ارز', 'گرد', 'ار', 'آور',
]
const PRESENT_ENDINGS = ['م', 'ی', 'د', 'ه', 'یم', 'ید', 'ین', 'ند', 'ن']
const PAST_STEMS = [
  'کرد', 'خواست', 'تونست', 'توانست', 'شد', 'داد', 'گفت', 'دونست', 'دانست', 'دید', 'رفت', 'زد', 'گرفت', 'فرستاد', 'ذاشت', 'گذاشت',
  'موند', 'ماند', 'رسید', 'خرید', 'پرسید', 'سپرد', 'ساخت', 'شناخت', 'نوشت', 'خورد', 'برد', 'کشید', 'اومد', 'آمد',
]
const PAST_ENDINGS = ['', 'م', 'ی', 'یم', 'ید', 'ین', 'ند', 'ن']
/** «می‌آم» family, written out: «میان» is also the word for «between». */
const COME_FORMS = ['ام', 'ای', 'اد', 'ایم', 'اید', 'این', 'آم', 'آی', 'آد', 'آید', 'آیم', 'آیند']
const JOINED_VERBS: ReadonlyMap<string, string> = new Map(VERB_PREFIXES.flatMap((prefix) => [
  ...PRESENT_STEMS.flatMap((stem) => PRESENT_ENDINGS.map((ending) => [prefix, stem + ending] as const)),
  ...PAST_STEMS.flatMap((stem) => PAST_ENDINGS.map((ending) => [prefix, stem + ending] as const)),
  ...COME_FORMS.map((form) => [prefix, form] as const),
]).map(([prefix, rest]) => [prefix + rest, `${prefix}\u200c${rest}`]))
/** Words that only look like a verb with the prefix. */
const NOT_VERBS: ReadonlySet<string> = new Set(['میدانی', 'میگون'])
const JOINED_COMPOUNDS: ReadonlyMap<string, string> = new Map([
  ['شستوشو', 'شست\u200cوشو'], ['گفتوگو', 'گفت\u200cوگو'], ['جستوجو', 'جست\u200cوجو'], ['کسبوکار', 'کسب\u200cوکار'],
  ['بهطور', 'به\u200cطور'], ['بهخاطر', 'به\u200cخاطر'], ['بهصورت', 'به\u200cصورت'], ['بهعنوان', 'به\u200cعنوان'], ['بهزودی', 'به\u200cزودی'],
])
/** A run of Arabic-script letters: no digits, punctuation or half-spaces. */
const PERSIAN_WORD = /[\u0620-\u064A\u066E-\u06D3\u06D5\u06FA-\u06FF]+/g

function repairWord(word: string): string {
  if (NOT_VERBS.has(word)) return word
  const verb = JOINED_VERBS.get(word)
  if (verb) return verb
  for (const [joined, fixed] of JOINED_COMPOUNDS) {
    if (word.startsWith(joined)) return fixed + word.slice(joined.length)
  }
  // «نسخههای»: the letter «ه» twice before «ا» is always «…ه‌ها…».
  const doubled = word.indexOf('\u0647\u0647\u0627')
  return doubled > 0 ? `${word.slice(0, doubled + 1)}\u200c${word.slice(doubled + 1)}` : word
}

/** Put back the half-spaces of «می‌کنم», «نسخه‌های», «شست‌وشو». Product card lines are data and stay as they are. */
export function restoreHalfSpaces(reply: string): string {
        return (reply ?? '').split('\n')
                .map((line) => line.includes('[[') ? line : line.replace(PERSIAN_WORD, repairWord))
                .join('\n')
}

export function stripTrailingPersianPeriod(reply: string): string {
        const text = (reply ?? '').trimEnd()
        if (!text) return reply

        // Must contain Persian/Arabic script to qualify.
        if (!PERSIAN_SCRIPT.test(text)) return reply

        // Keep lists and structured/markdown content intact.
        const lines = text.split(/\n/)
        if (lines.length > 2) return reply
        if (lines.some((line) => LIST_LINE.test(line))) return reply

        // Only short conversational prose.
        if (text.length > 480) return reply

        // Preserve URLs / decimals at the very end — a trailing dot there is
        // part of data, not sentence punctuation. Digits/latin directly before
        // the period block disqualify the strip.
        if (/[A-Za-z0-9\u06F0-\u06F9]\u200c?\.$/.test(text)) return reply

        const stripped = text.replace(TRAILING_PERIODS, '')
        // Re-trim: the strip may expose trailing ZWNJ/space.
        return stripped.trimEnd() || reply
}
