/**
 * Locale-aware date/time helpers for the dashboard.
 *
 * NOTE: values that flow through Next.js `unstable_cache` (or cross the
 * server→client boundary as serialized props) are JSON-serialised, so Prisma
 * `Date` objects arrive here as ISO strings. Every helper therefore accepts
 * `Date | string | number` and coerces via `asDate` — calling `.getTime()` on
 * a raw string throws `TypeError: a.getTime is not a function`, which was
 * taking down the public marketing homepage (PopularPosts feeds cached blog
 * posts into `relativeTime`). See lib/localized-date.ts for the same pattern.
 */

import { formatLocalizedDateTime } from '@/lib/localized-date'

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
        { amount: 60, unit: 'second' },
        { amount: 60, unit: 'minute' },
        { amount: 24, unit: 'hour' },
        { amount: 7, unit: 'day' },
        { amount: 4.34524, unit: 'week' },
        { amount: 12, unit: 'month' },
        { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

/** Coerce a Date / ISO string / epoch number into a real Date instance. */
function asDate(value: Date | string | number): Date {
        return value instanceof Date ? value : new Date(value)
}

/** Compact relative time, e.g. "۳ دقیقه پیش" / "3 minutes ago". */
export function relativeTime(
        date: Date | string | number,
        locale: 'fa' | 'en' = 'fa',
): string {
        const d = asDate(date)
        // Guard against invalid/NaN input so a bad cached value never throws and
        // takes the whole page down — mirrors the "return '—'" behaviour of
        // formatLocalizedDate in lib/localized-date.ts.
        if (Number.isNaN(d.getTime())) return ''
        const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
                numeric: 'auto',
        })
        let duration = (d.getTime() - Date.now()) / 1000
        for (const division of DIVISIONS) {
                if (Math.abs(duration) < division.amount) {
                        return rtf.format(Math.round(duration), division.unit)
                }
                duration /= division.amount
        }
        return ''
}

/** Short localized date+time. */
export function formatDateTime(
        date: Date | string | number,
        locale: 'fa' | 'en' = 'fa',
): string {
        return formatLocalizedDateTime(date, locale)
}

/**
 * "Smart" list time: relative for recent items ("۲ ساعت پیش"), absolute
 * date+time once older than a week, when "۳ ماه پیش" stops being useful and
 * the user needs the actual date to act on.
 */
export function smartTime(
        date: Date | string | number,
        locale: 'fa' | 'en' = 'fa',
): string {
        const d = asDate(date)
        if (Number.isNaN(d.getTime())) return ''
        const ageMs = Date.now() - d.getTime()
        const oneWeek = 7 * 24 * 60 * 60 * 1000
        if (ageMs < oneWeek) return relativeTime(d, locale)
        return formatDateTime(d, locale)
}

/**
 * Compact number for dashboard/stat displays: 1K / 1.2M style with the exact
 * value available for a tooltip. Falls back to plain grouping below 1000.
 */
export function compactNumber(
        value: number,
        locale: 'fa' | 'en' = 'fa',
): string {
        const tag = locale === 'fa' ? 'fa-IR' : 'en-US'
        if (Math.abs(value) < 1000) return value.toLocaleString(tag)
        return new Intl.NumberFormat(tag, {
                notation: 'compact',
                maximumFractionDigits: 1,
        }).format(value)
}

/**
 * Middle truncation for IDs / filenames / long tokens where the END of the
 * string carries the distinguishing information:
 * `quarterly_report_final_v3.pdf` → `quarterly_rep…_v3.pdf`.
 * Falls back to the plain string when it already fits.
 */
export function middleTruncate(value: string, maxLength = 24): string {
        if (value.length <= maxLength) return value
        if (maxLength < 5) return value.slice(0, maxLength)
        const keep = maxLength - 1 // one char reserved for the ellipsis
        const head = Math.ceil(keep * 0.6)
        const tail = keep - head
        return `${value.slice(0, head)}…${value.slice(value.length - tail)}`
}
