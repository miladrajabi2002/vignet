import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'

export type DateLocale = 'fa' | 'en'

export const DEFAULT_DISPLAY_TIMEZONE = 'Asia/Tehran'
export const PERSIAN_DATE_LOCALE = 'fa-IR-u-ca-persian'
export const ENGLISH_DATE_LOCALE = 'en-US-u-ca-gregory'

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function dateLocaleTag(locale: DateLocale): string {
  return locale === 'fa' ? PERSIAN_DATE_LOCALE : ENGLISH_DATE_LOCALE
}

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

export function formatLocalizedDate(
  value: Date | string | number,
  locale: DateLocale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
  timeZone = DEFAULT_DISPLAY_TIMEZONE,
): string {
  const date = asDate(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(dateLocaleTag(locale), { timeZone, ...options }).format(date)
}

export function formatLocalizedDateTime(
  value: Date | string | number,
  locale: DateLocale,
  timeZone = DEFAULT_DISPLAY_TIMEZONE,
): string {
  return formatLocalizedDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }, timeZone)
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  if (!DATE_KEY_RE.test(dateKey)) throw new Error('INVALID_DATE_KEY')
  const [year, month, day] = dateKey.split('-').map(Number)
  const probe = new Date(Date.UTC(year, month - 1, day, 12))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error('INVALID_DATE_KEY')
  }
  return { year, month, day }
}

export function formatDateKey(
  dateKey: string,
  locale: DateLocale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  try {
    parseDateKey(dateKey)
    return formatLocalizedDate(`${dateKey}T12:00:00.000Z`, locale, options, 'UTC')
  } catch {
    return '—'
  }
}

export function todayDateKey(timeZone = DEFAULT_DISPLAY_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export type CalendarMonth = { year: number; month: number }

export function calendarPartsFromDateKey(dateKey: string, locale: DateLocale): { year: number; month: number; day: number } {
  const gregorian = parseDateKey(dateKey)
  if (locale === 'en') return gregorian
  const jalali = toJalaali(gregorian.year, gregorian.month, gregorian.day)
  return { year: jalali.jy, month: jalali.jm, day: jalali.jd }
}

export function dateKeyFromCalendarParts(
  year: number,
  month: number,
  day: number,
  locale: DateLocale,
): string {
  const gregorian = locale === 'fa' ? toGregorian(year, month, day) : { gy: year, gm: month, gd: day }
  const key = `${String(gregorian.gy).padStart(4, '0')}-${String(gregorian.gm).padStart(2, '0')}-${String(gregorian.gd).padStart(2, '0')}`
  parseDateKey(key)
  return key
}

export function calendarMonthLength(month: CalendarMonth, locale: DateLocale): number {
  if (locale === 'fa') return jalaaliMonthLength(month.year, month.month)
  return new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()
}

export function calendarMonthOffset(month: CalendarMonth, locale: DateLocale): number {
  const firstKey = dateKeyFromCalendarParts(month.year, month.month, 1, locale)
  const { year, month: gregorianMonth, day } = parseDateKey(firstKey)
  const weekday = new Date(Date.UTC(year, gregorianMonth - 1, day, 12)).getUTCDay()
  return locale === 'fa' ? (weekday + 1) % 7 : weekday
}

export function shiftCalendarMonth(month: CalendarMonth, amount: number): CalendarMonth {
  const index = month.year * 12 + (month.month - 1) + amount
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 }
}
