export const DEFAULT_BOOKING_TIMEZONE = 'Asia/Tehran'

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone)
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

export function assertDateKey(value: string): string {
  if (!DATE_KEY_RE.test(value)) throw new Error('INVALID_LOCAL_DATE')
  const [year, month, day] = value.split('-').map(Number)
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error('INVALID_LOCAL_DATE')
  }
  return value
}

export function dateKeyInTimeZone(
  date: Date,
  timeZone = DEFAULT_BOOKING_TIMEZONE,
): string {
  const parts = zonedParts(date, timeZone)
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Convert a local calendar date + minutes after midnight to an exact UTC Date. */
export function localDateTimeToUtc(
  dateKey: string,
  minuteOfDay: number,
  timeZone = DEFAULT_BOOKING_TIMEZONE,
): Date {
  assertDateKey(dateKey)
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1439) {
    throw new Error('INVALID_LOCAL_TIME')
  }
  // Throws RangeError for an unknown IANA timezone before any data is persisted.
  new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())

  const [year, month, day] = dateKey.split('-').map(Number)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let instant = localAsUtc
  // Iteration handles zones whose offset changes near the requested date.
  for (let index = 0; index < 3; index++) {
    const next = localAsUtc - timeZoneOffsetMs(new Date(instant), timeZone)
    if (next === instant) break
    instant = next
  }

  const result = new Date(instant)
  const check = zonedParts(result, timeZone)
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute
  ) {
    // A DST spring-forward gap, rather than silently booking a different time.
    throw new Error('NON_EXISTENT_LOCAL_TIME')
  }
  return result
}

export function localDateRangeUtc(
  dateKey: string,
  timeZone = DEFAULT_BOOKING_TIMEZONE,
): { start: Date; end: Date } {
  const start = localDateTimeToUtc(dateKey, 0, timeZone)
  const [year, month, day] = assertDateKey(dateKey).split('-').map(Number)
  const nextKeyDate = new Date(Date.UTC(year, month - 1, day + 1))
  const nextKey = [
    nextKeyDate.getUTCFullYear(),
    String(nextKeyDate.getUTCMonth() + 1).padStart(2, '0'),
    String(nextKeyDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
  return { start, end: localDateTimeToUtc(nextKey, 0, timeZone) }
}

/** Stable value for Prisma `@db.Date`; it does not represent local midnight. */
export function dateKeyToDatabaseDate(dateKey: string): Date {
  return new Date(`${assertDateKey(dateKey)}T00:00:00.000Z`)
}

export function weekdayForDateKey(dateKey: string): number {
  const [year, month, day] = assertDateKey(dateKey).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

export function minuteOfDayInTimeZone(
  date: Date,
  timeZone = DEFAULT_BOOKING_TIMEZONE,
): number {
  const parts = zonedParts(date, timeZone)
  return parts.hour * 60 + parts.minute
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
