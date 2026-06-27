/** Locale-aware date/time helpers for the dashboard. */

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

/** Compact relative time, e.g. "۳ دقیقه پیش" / "3 minutes ago". */
export function relativeTime(date: Date, locale: 'fa' | 'en' = 'fa'): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    numeric: 'auto',
  })
  let duration = (date.getTime() - Date.now()) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return ''
}

/** Short localized date+time. */
export function formatDateTime(date: Date, locale: 'fa' | 'en' = 'fa'): string {
  return date.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
