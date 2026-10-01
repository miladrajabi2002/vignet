import { gregorianToJalali, instantToWallClock, jalaliToGregorian, wallClockToInstant } from '@doranjs/core'

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

export function dateKeyInTimeZone(value: Date | string | number, timeZone = DEFAULT_DISPLAY_TIMEZONE): string {
  const date = asDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const wall = instantToWallClock(date.getTime(), timeZone)
  return `${String(wall.year).padStart(4, '0')}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`
}

/** Convert a Gregorian machine date key into an inclusive Tehran-time filter
 * boundary without depending on the browser or server's local time zone. */
export function dateKeyBoundaryISOString(dateKey: string, end = false, timeZone = DEFAULT_DISPLAY_TIMEZONE): string {
  const { year, month, day } = parseDateKey(dateKey)
  return new Date(wallClockToInstant({
    year,
    month,
    day,
    hour: end ? 23 : 0,
    minute: end ? 59 : 0,
    second: end ? 59 : 0,
    millisecond: end ? 999 : 0,
  }, timeZone)).toISOString()
}

export type CalendarMonth = { year: number; month: number }

export function calendarPartsFromDateKey(dateKey: string, locale: DateLocale): { year: number; month: number; day: number } {
  const gregorian = parseDateKey(dateKey)
  if (locale === 'en') return gregorian
  return gregorianToJalali(gregorian.year, gregorian.month, gregorian.day)
}

export function dateKeyFromCalendarParts(
  year: number,
  month: number,
  day: number,
  locale: DateLocale,
): string {
  const gregorian = locale === 'fa' ? jalaliToGregorian(year, month, day) : { year, month, day }
  const key = `${String(gregorian.year).padStart(4, '0')}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`
  parseDateKey(key)
  return key
}
