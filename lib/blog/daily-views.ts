/**
 * Tehran-calendar day keys for the blog daily-view aggregate.
 *
 * `BlogPostDailyView.day` stores the *Tehran calendar date* of a view as a
 * DateTime pinned to UTC midnight of that date (e.g. 2026-09-10T00:00:00Z).
 * It is a pure day key, never a real instant, so bucketing never depends on
 * the server's local timezone.
 */

const TEHRAN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** UTC-midnight Date representing the Tehran calendar day of `date`. */
export function tehranDayKey(date: Date = new Date()): Date {
  const [y, m, d] = TEHRAN_DATE_FMT.format(date)
    .split('-')
    .map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * The last `n` Tehran day keys, oldest → newest, ending with today's.
 * `86_400_000` stepping is exact because every key sits on a UTC-midnight
 * boundary (no DST in Iran since 2022).
 */
export function lastNTehranDayKeys(n: number, now: Date = new Date()): Date[] {
  const todayKey = tehranDayKey(now)
  const keys: Date[] = []
  for (let i = n - 1; i >= 0; i--) {
    keys.push(new Date(todayKey.getTime() - i * 86_400_000))
  }
  return keys
}
