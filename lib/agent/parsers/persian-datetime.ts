/**
 * Booking dates and times the way Persian customers say them, resolved to a
 * calendar day in the business time zone:
 *
 *   «پس‌فردا عصر»            → day+2, 16:00–19:00
 *   «شنبه هفته بعد ساعت ۵»   → next week's Saturday, 17:00
 *   «۱۵ مهر ۱۰ و نیم صبح»    → 15 Mehr, 10:30
 *   «سه روز دیگه»           → day+3
 *   «فردا یه ربع به شش»      → day+1, 17:45
 *
 * Deterministic and shape-certain: it never guesses a meaning the words do
 * not carry (no day → no date), and the booking flow still confirms the
 * resolved weekday + date with the customer before anything is booked.
 * Small typos in long date words («پسفدا», «یکشبنه») are tolerated; anything
 * looser is the understanding layer's job (it writes the normalized form).
 */
import { catalogEditDistance } from '@/lib/search/fuzzy-terms'
import { DEFAULT_BOOKING_TIMEZONE, dateKeyInTimeZone, weekdayForDateKey } from '@/lib/bookings/time'
import { bookingDateLabel, shiftDateKey } from '@/lib/bookings/calendar-context'
import { toEnglishDigits } from '@/lib/phone'

export interface DayWindow {
  from: number
  to: number
  /** The part of day the customer named («عصر»). */
  label: string
}

export interface ResolvedDateTime {
  /** Gregorian YYYY-MM-DD in the business time zone, never in the past. */
  dateKey: string | null
  /** Minutes after local midnight. */
  minute: number | null
  /** Part of day when no exact time was given (or alongside it). */
  window: DayWindow | null
  /** «ساعت ۵» with no part of day was read as 17:00. */
  assumedAfternoon: boolean
  /** Phrases that produced the result (for logs and tests). */
  evidence: string[]
}

const MONTHS: Array<[string, number]> = [
  ['فروردین', 1], ['اردیبهشت', 2], ['خرداد', 3], ['تیر', 4], ['امرداد', 5], ['مرداد', 5],
  ['شهریور', 6], ['مهر', 7], ['آبان', 8], ['ابان', 8], ['آذر', 9], ['اذر', 9], ['دی', 10],
  ['بهمن', 11], ['اسفند', 12],
]

/** JS weekday numbers (0 = Sunday … 6 = Saturday). */
const WEEKDAYS: Array<[string, number]> = [
  ['یکشنبه', 0], ['1شنبه', 0], ['دوشنبه', 1], ['2شنبه', 1], ['سهشنبه', 2], ['3شنبه', 2],
  ['چهارشنبه', 3], ['چارشنبه', 3], ['4شنبه', 3], ['پنجشنبه', 4], ['پنشنبه', 4], ['پنجشمبه', 4], ['5شنبه', 4],
  ['جمعه', 5], ['شنبه', 6],
]

const NUMBER_WORDS: Record<string, number> = {
  'یک': 1, 'یه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'چار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8,
  'نه': 9, 'ده': 10, 'یازده': 11, 'دوازده': 12,
}

const ORDINAL_WORDS: Record<string, number> = {
  'اول': 1, 'یکم': 1, 'دوم': 2, 'سوم': 3, 'چهارم': 4, 'پنجم': 5, 'ششم': 6, 'هفتم': 7, 'هشتم': 8, 'نهم': 9,
  'دهم': 10, 'یازدهم': 11, 'دوازدهم': 12, 'سیزدهم': 13, 'چهاردهم': 14, 'پانزدهم': 15, 'پونزدهم': 15,
  'شانزدهم': 16, 'شونزدهم': 16, 'هفدهم': 17, 'هیفدهم': 17, 'هجدهم': 18, 'هیجدهم': 18, 'نوزدهم': 19,
  'بیستم': 20, 'بیست و یکم': 21, 'بیست و دوم': 22, 'بیست و سوم': 23, 'بیست و چهارم': 24, 'بیست و پنجم': 25,
  'بیست و ششم': 26, 'بیست و هفتم': 27, 'بیست و هشتم': 28, 'بیست و نهم': 29, 'سیام': 30, 'سی ام': 30, 'سی و یکم': 31,
}

const DAY_PARTS: Array<[string, DayWindow]> = [
  ['صبح زود', { from: 7 * 60, to: 9 * 60, label: 'صبح زود' }],
  ['قبل از ظهر', { from: 9 * 60, to: 12 * 60, label: 'قبل از ظهر' }],
  ['قبلازظهر', { from: 9 * 60, to: 12 * 60, label: 'قبل از ظهر' }],
  ['پیش از ظهر', { from: 9 * 60, to: 12 * 60, label: 'قبل از ظهر' }],
  ['بعد از ظهر', { from: 14 * 60, to: 17 * 60, label: 'بعدازظهر' }],
  ['بعدازظهر', { from: 14 * 60, to: 17 * 60, label: 'بعدازظهر' }],
  ['بعد ظهر', { from: 14 * 60, to: 17 * 60, label: 'بعدازظهر' }],
  ['امشب', { from: 19 * 60, to: 23 * 60, label: 'شب' }],
  ['صبح', { from: 8 * 60, to: 12 * 60, label: 'صبح' }],
  ['ظهر', { from: 12 * 60, to: 14 * 60, label: 'ظهر' }],
  ['عصر', { from: 16 * 60, to: 19 * 60, label: 'عصر' }],
  ['غروب', { from: 17 * 60 + 30, to: 20 * 60, label: 'غروب' }],
  ['شب', { from: 19 * 60, to: 23 * 60, label: 'شب' }],
]

/** Long date words whose small typos are tolerated («پسفدا»). */
const FUZZY_KEYWORDS = ['پسفردا', 'امروز', 'یکشنبه', 'دوشنبه', 'سهشنبه', 'چهارشنبه', 'پنجشنبه', 'فروردین', 'اردیبهشت', 'خرداد', 'شهریور', 'بعدازظهر']

function normalize(text: string): string {
  return toEnglishDigits(text)
    .normalize('NFKC')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه')
    .replace(/[‌‍]/g, ' ')
    // Glue the weekday compounds and «پس فردا» so one token = one meaning.
    .replace(/(یک|دو|سه|چهار|چار|پنج|[1-5])\s+شنبه/g, '$1شنبه')
    .replace(/پس\s*پس\s*فردا/g, 'پسپسفردا')
    .replace(/پس\s+فردا/g, 'پسفردا')
    .replace(/[،,.!؟?؛;:()«»"]/g, (char) => (char === ':' ? ':' : ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa')
}

function fuzzyFix(text: string): string {
  return text.split(' ').map((word) => {
    if ([...word].length < 5 || FUZZY_KEYWORDS.includes(word)) return word
    const hit = FUZZY_KEYWORDS.find((keyword) => catalogEditDistance(word, keyword, 1) <= 1)
    return hit ?? word
  }).join(' ')
}

function jalaliParts(dateKey: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(`${dateKey}T12:00:00.000Z`))
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? NaN)
  return { year: value('year'), month: value('month'), day: value('day') }
}

/** First day ≥ today (within ~13 months) with this Jalali month/day (and year). */
export function nextJalaliDate(today: string, month: number, day: number, year?: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  for (let offset = 0; offset <= 400; offset++) {
    const key = shiftDateKey(today, offset)
    const jalali = jalaliParts(key)
    if (jalali.month === month && jalali.day === day && (year == null || jalali.year === year)) return key
  }
  return null
}

function gregorianKey(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

function numberValue(token: string | undefined): number | null {
  if (!token) return null
  if (/^\d{1,2}$/.test(token)) return Number(token)
  return NUMBER_WORDS[token] ?? null
}

const MONTH_PATTERN = MONTHS.map(([name]) => name).join('|')
const ORDINAL_PATTERN = Object.keys(ORDINAL_WORDS).sort((a, b) => b.length - a.length).join('|')

function resolveDate(text: string, today: string, evidence: string[]): { dateKey: string | null; rest: string } {
  let rest = text
  const take = (match: RegExpMatchArray) => {
    evidence.push(match[0].trim())
    rest = rest.replace(match[0], ' ')
  }
  const withinRange = (key: string | null) => key && key >= today && key <= shiftDateKey(today, 400) ? key : null

  // 2026-10-05 / 1405/07/13
  const full = rest.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (full) {
    const [year, month, day] = [Number(full[1]), Number(full[2]), Number(full[3])]
    const key = year >= 1900 ? gregorianKey(year, month, day) : year >= 1300 && year < 1500 ? nextJalaliDate(today, month, day, year) : null
    if (withinRange(key)) { take(full); return { dateKey: key, rest } }
  }
  // ۱۵ مهر / پونزدهم مهر ۱۴۰۵ / ۱۵ام مهر
  const named = rest.match(new RegExp(`(?:^|\\s)(\\d{1,2}|${ORDINAL_PATTERN})(?:\\s*ام|\\s*م)?\\s+(${MONTH_PATTERN})(?:\\s+(1[34]\\d{2}))?(?=\\s|$)`))
  if (named) {
    const day = /^\d+$/.test(named[1]) ? Number(named[1]) : ORDINAL_WORDS[named[1]]
    const month = MONTHS.find(([name]) => name === named[2])?.[1] ?? 0
    const key = nextJalaliDate(today, month, day, named[3] ? Number(named[3]) : undefined)
    if (withinRange(key)) { take(named); return { dateKey: key, rest } }
  }
  // ۷/۲۰ (month/day, Iranian order) — never right after «ساعت».
  const short = rest.match(/(?:^|\s)(?<!ساعت\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/)
  if (short) {
    let [month, day] = [Number(short[1]), Number(short[2])]
    if (month > 12 && day <= 12) [month, day] = [day, month]
    const key = nextJalaliDate(today, month, day)
    if (withinRange(key)) { take(short); return { dateKey: key, rest } }
  }
  const relative: Array<[RegExp, number]> = [
    [/(?:^|\s)پسپسفردا(?=\s|$)/, 3],
    [/(?:^|\s)پسفردا(?=\s|$)/, 2],
    [/(?:^|\s)فردا(?:\s*شب|\s*صبح|\s*عصر)?(?=\s|$)/, 1],
    [/(?:^|\s)(?:امروز|امشب)(?=\s|$)/, 0],
  ]
  for (const [pattern, offset] of relative) {
    const match = rest.match(pattern)
    if (match) {
      evidence.push(match[0].trim())
      // Keep «امشب / فردا عصر» in the text: the part of day is read below.
      rest = rest.replace(match[0], match[0].replace(/پسپسفردا|پسفردا|فردا|امروز/, ' '))
      return { dateKey: shiftDateKey(today, offset), rest }
    }
  }
  const inDays = rest.match(/(?:^|\s)(\d{1,2}|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)\s+(روز|هفته)\s+(?:دیگه|دیگر|بعد)(?=\s|$)/)
  if (inDays) {
    const count = numberValue(inDays[1]) ?? 0
    const offset = inDays[2] === 'هفته' ? count * 7 : count
    if (offset > 0 && offset <= 90) { take(inDays); return { dateKey: shiftDateKey(today, offset), rest } }
  }
  const weekdayHit = WEEKDAYS.map(([name, weekday]) => ({ match: rest.match(new RegExp(`(?:^|\\s)(?:این\\s+|همین\\s+)?${name}(?:\\s+(?:بعد(?!\\s*(?:از\\s*)?ظهر)|آینده|اینده|دیگه|دیگر))?(?=\\s|$)`)), weekday }))
    .find((hit) => hit.match)
  const nextWeek = /(?:^|\s)هفته\s+(?:بعد|آینده|اینده|دیگه|دیگر)(?=\s|$)/.test(rest)
  if (weekdayHit?.match) {
    take(weekdayHit.match)
    const todayWeekday = weekdayForDateKey(today)
    if (nextWeek) {
      // Iranian weeks start on Saturday: «یکشنبه هفته بعد» = the Sunday after
      // the coming Saturday.
      const toSaturday = ((6 - todayWeekday + 7) % 7) || 7
      const saturday = shiftDateKey(today, toSaturday)
      const intoWeek = (weekdayHit.weekday - 6 + 7) % 7
      rest = rest.replace(/هفته\s+(?:بعد|آینده|اینده|دیگه|دیگر)/, ' ')
      return { dateKey: shiftDateKey(saturday, intoWeek), rest }
    }
    const strictlyAfter = /(?:بعد|آینده|اینده|دیگه|دیگر)$/.test(weekdayHit.match[0].trim())
    let offset = (weekdayHit.weekday - todayWeekday + 7) % 7
    if (offset === 0 && strictlyAfter) offset = 7
    return { dateKey: shiftDateKey(today, offset), rest }
  }
  if (/(?:^|\s)آخر\s+(?:این\s+)?هفته(?=\s|$)/.test(rest)) {
    evidence.push('آخر هفته')
    return { dateKey: shiftDateKey(today, (4 - weekdayForDateKey(today) + 7) % 7), rest }
  }
  if (/(?:^|\s)اول\s+هفته(?:\s+(?:بعد|دیگه|آینده))?(?=\s|$)/.test(rest)) {
    evidence.push('اول هفته')
    return { dateKey: shiftDateKey(today, ((6 - weekdayForDateKey(today) + 7) % 7) || 7), rest }
  }
  return { dateKey: null, rest }
}

function resolveTime(text: string, evidence: string[]): Pick<ResolvedDateTime, 'minute' | 'window' | 'assumedAfternoon'> {
  const window = DAY_PARTS.find(([name]) => new RegExp(`(?:^|\\s)${name}(?=\\s|$)`).test(text))?.[1] ?? null
  const hourToken = '(\\d{1,2}|یک|یه|دو|سه|چهار|چار|پنج|شش|شیش|هفت|هشت|نه|ده|یازده|دوازده)'
  let hour: number | null = null
  let minute = 0
  const quarterTo = text.match(new RegExp(`(?:یه|یک)?\\s*ربع\\s+به\\s+${hourToken}(?=\\s|$)`))
  const clock = text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?=\s|$)/)
  const spoken = text.match(new RegExp(`(?:ساعت\\s+)${hourToken}(?:\\s+و\\s+(نیم|ربع|\\d{1,2}(?:\\s+دقیقه)?))?(?=\\s|$)`))
    ?? (window ? text.match(new RegExp(`(?:^|\\s)${hourToken}(?:\\s+و\\s+(نیم|ربع|\\d{1,2}(?:\\s+دقیقه)?))?\\s+(?:${DAY_PARTS.map(([name]) => name).join('|')})(?=\\s|$)`)) : null)
  if (quarterTo) {
    const value = numberValue(quarterTo[1])
    if (value != null) { hour = value - 1; minute = 45; evidence.push(quarterTo[0].trim()) }
  } else if (clock) {
    hour = Number(clock[1]); minute = Number(clock[2]); evidence.push(clock[0].trim())
  } else if (spoken) {
    const value = numberValue(spoken[1])
    if (value != null) {
      hour = value
      const extra = spoken[2]
      minute = extra === 'نیم' ? 30 : extra === 'ربع' ? 15 : extra ? Number(extra.replace(/\D/g, '')) || 0 : 0
      evidence.push(spoken[0].trim())
    }
  }
  if (hour == null || hour > 23 || minute > 59) return { minute: null, window, assumedAfternoon: false }
  let assumedAfternoon = false
  if (window) {
    const label = window.label
    if ((label === 'عصر' || label === 'بعدازظهر' || label === 'غروب' || label === 'شب') && hour < 12) hour += 12
    if (label === 'ظهر' && hour >= 1 && hour <= 4) hour += 12
    if (label === 'شب' && hour === 24) return { minute: null, window, assumedAfternoon: false }
  } else if (hour >= 1 && hour <= 6) {
    // «ساعت ۵» for an appointment means 17:00 in everyday Persian.
    hour += 12
    assumedAfternoon = true
  }
  if (hour > 23) return { minute: null, window, assumedAfternoon: false }
  return { minute: hour * 60 + minute, window, assumedAfternoon }
}

export function resolvePersianDateTime(
  input: string,
  options: { now?: Date; timeZone?: string } = {},
): ResolvedDateTime {
  const evidence: string[] = []
  const today = dateKeyInTimeZone(options.now ?? new Date(), options.timeZone ?? DEFAULT_BOOKING_TIMEZONE)
  const text = fuzzyFix(normalize(input ?? ''))
  if (!text) return { dateKey: null, minute: null, window: null, assumedAfternoon: false, evidence }
  const { dateKey, rest } = resolveDate(text, today, evidence)
  const time = resolveTime(` ${rest} `.replace(/\s+/g, ' '), evidence)
  return { dateKey, ...time, evidence }
}

function clockText(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** «یکشنبه ۱۳ مهر ۱۴۰۵ (2026-10-05)، عصر (16:00 تا 19:00)» — empty when nothing resolved. */
export function describeResolvedDateTime(resolved: ResolvedDateTime, isFa = true): string {
  const parts: string[] = []
  if (resolved.dateKey) parts.push(`${bookingDateLabel(resolved.dateKey, isFa)} (${resolved.dateKey})`)
  if (resolved.minute != null) {
    parts.push(isFa
      ? `ساعت ${clockText(resolved.minute)}${resolved.assumedAfternoon ? ' (عصر فرض شد؛ اگر صبح منظور است بپرس)' : ''}`
      : `at ${clockText(resolved.minute)}${resolved.assumedAfternoon ? ' (assumed afternoon)' : ''}`)
  } else if (resolved.window) {
    parts.push(isFa
      ? `${resolved.window.label} (${clockText(resolved.window.from)} تا ${clockText(resolved.window.to)})`
      : `${resolved.window.label} (${clockText(resolved.window.from)}–${clockText(resolved.window.to)})`)
  }
  return parts.join(isFa ? '، ' : ', ')
}
