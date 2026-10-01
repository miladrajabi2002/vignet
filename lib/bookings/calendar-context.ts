import {
  DEFAULT_BOOKING_TIMEZONE,
  dateKeyInTimeZone,
  formatMinuteOfDay,
  weekdayForDateKey,
} from '@/lib/bookings/time'

const FA_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function weekdayName(weekday: number, isFa = true): string {
  return (isFa ? FA_WEEKDAYS : EN_WEEKDAYS)[((weekday % 7) + 7) % 7]
}

export function shiftDateKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

/** «۷ مهر ۱۴۰۵» — the Jalali label a Persian customer actually uses. */
export function jalaliLabel(dateKey: string, withYear = true): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00.000Z`))
}

/**
 * Human label for one bookable date: «سه‌شنبه ۷ مهر ۱۴۰۵».
 * Tool results carry it so the model never converts calendars itself.
 */
export function bookingDateLabel(dateKey: string, isFa = true): string {
  const weekday = weekdayName(weekdayForDateKey(dateKey), isFa)
  if (!isFa) {
    const gregorian = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateKey}T12:00:00.000Z`))
    return `${weekday}, ${gregorian}`
  }
  return `${weekday} ${jalaliLabel(dateKey)}`
}

/**
 * Calendar grounding for the booking model. Without it the model cannot turn
 * «فردا»، «شنبه» or «۱۲ مهر» into the Gregorian YYYY-MM-DD the tools require
 * and it guesses — which silently books the wrong day.
 */
export function bookingCalendarContext(params: {
  now?: Date
  timeZone?: string
  days?: number
  isFa?: boolean
} = {}): string {
  const now = params.now ?? new Date()
  const timeZone = params.timeZone ?? DEFAULT_BOOKING_TIMEZONE
  const days = Math.min(Math.max(params.days ?? 14, 1), 31)
  const isFa = params.isFa ?? true
  const today = dateKeyInTimeZone(now, timeZone)
  const localClock = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)

  const rows = Array.from({ length: days }, (_, index) => {
    const key = shiftDateKey(today, index)
    const relative = index === 0
      ? (isFa ? ' (امروز)' : ' (today)')
      : index === 1
        ? (isFa ? ' (فردا)' : ' (tomorrow)')
        : index === 2
          ? (isFa ? ' (پس‌فردا)' : ' (day after tomorrow)')
          : ''
    return `${key} = ${bookingDateLabel(key, isFa)}${relative}`
  })

  return [
    isFa
      ? `تقویم مرجع رزرو (منطقه زمانی ${timeZone}، ساعت فعلی ${localClock}). تاریخ ابزارها میلادی YYYY-MM-DD است؛ تاریخ نسبی یا شمسی مشتری را فقط با این جدول تبدیل کن:`
      : `Booking reference calendar (${timeZone}, local time now ${localClock}). Tools use Gregorian YYYY-MM-DD; convert relative or Persian dates only with this table:`,
    ...rows,
    isFa
      ? 'startMinute یعنی دقیقه از نیمه‌شب: ساعت × ۶۰ + دقیقه (مثلاً ۱۰:۳۰ = 630).'
      : 'startMinute is minutes after local midnight: hour × 60 + minute (10:30 = 630).',
  ].join('\n')
}

export interface WeeklyRuleLike {
  weekday: number
  startMinute: number
  endMinute: number
  active: boolean
}

/** «شنبه تا چهارشنبه ۰۹:۰۰–۱۷:۰۰» style summary grouped by identical hours. */
export function summarizeWeeklyHours(rules: readonly WeeklyRuleLike[], isFa = true): Array<{ day: string; hours: string }> {
  const order = [6, 0, 1, 2, 3, 4, 5]
  return order.map((weekday) => {
    const ranges = rules
      .filter((rule) => rule.active && rule.weekday === weekday)
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((rule) => `${formatMinuteOfDay(rule.startMinute)}-${rule.endMinute === 1440 ? '24:00' : formatMinuteOfDay(rule.endMinute)}`)
    return {
      day: weekdayName(weekday, isFa),
      hours: ranges.length ? ranges.join(isFa ? ' و ' : ', ') : (isFa ? 'تعطیل' : 'closed'),
    }
  })
}
