import { Coffee, Moon, Sun } from 'lucide-react'

export type Locale = 'fa' | 'en'
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'

export interface WeeklyRule {
  weekday: number
  startMinute: number
  endMinute: number
  capacity: number | null
  active: boolean
}

export interface ServiceException {
  id: string
  date: string
  closed: boolean
  startMinute: number | null
  endMinute: number | null
  capacity: number | null
  note: string | null
}

export interface ServiceRow {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  slotIntervalMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  capacity: number
  timezone: string
  location: string | null
  price: number | null
  active: boolean
  appointmentCount: number
  weeklyRules: WeeklyRule[]
  exceptions: ServiceException[]
}

export interface AppointmentRow {
  id: string
  serviceId: string
  serviceName: string
  serviceLocation: string | null
  contactId: string | null
  customerName: string
  customerPhone: string | null
  startsAt: string
  endsAt: string
  timezone: string
  partySize: number
  status: AppointmentStatus
  source: string
  notes: string | null
  /** Customer reminders sent (or skipped) for this booking. */
  reminders?: AppointmentReminders
}

export type AppointmentReminderStatus = 'sent' | 'stored' | 'skipped_window' | 'no_conversation' | 'failed'
export type AppointmentReminders = Partial<Record<'h24' | 'h2', { status: AppointmentReminderStatus; at: string }>>

/** metadata.reminders from the API row (see lib/bookings/customer-reminders). */
export function remindersFromMetadata(metadata: unknown): AppointmentReminders | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  const raw = (metadata as Record<string, unknown>).reminders
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: AppointmentReminders = {}
  for (const stage of ['h24', 'h2'] as const) {
    const item = (raw as Record<string, unknown>)[stage] as { status?: unknown; at?: unknown } | undefined
    if (item && typeof item.status === 'string') out[stage] = { status: item.status as AppointmentReminderStatus, at: String(item.at ?? '') }
  }
  return Object.keys(out).length ? out : undefined
}

export interface SlotRow {
  startMinute: number
  startsAt: string
  endsAt: string
  remainingCapacity: number
}

export interface DaySummary {
  total: number
  active: number
  pending: number
  people: number
}

/** Saturday-first week, the order Iranian businesses read their schedule in. */
export const WEEKDAYS = [
  { value: 6, fa: 'شنبه', short: 'ش', en: 'Sat' },
  { value: 0, fa: 'یکشنبه', short: 'ی', en: 'Sun' },
  { value: 1, fa: 'دوشنبه', short: 'د', en: 'Mon' },
  { value: 2, fa: 'سه‌شنبه', short: 'س', en: 'Tue' },
  { value: 3, fa: 'چهارشنبه', short: 'چ', en: 'Wed' },
  { value: 4, fa: 'پنجشنبه', short: 'پ', en: 'Thu' },
  { value: 5, fa: 'جمعه', short: 'ج', en: 'Fri' },
] as const

export const STATUS_META: Record<AppointmentStatus, { fa: string; en: string; tone: 'ok' | 'warn' | 'danger' | 'signal' | 'neutral' }> = {
  PENDING: { fa: 'در انتظار تأیید', en: 'Pending', tone: 'warn' },
  CONFIRMED: { fa: 'تأییدشده', en: 'Confirmed', tone: 'ok' },
  COMPLETED: { fa: 'انجام‌شده', en: 'Completed', tone: 'neutral' },
  CANCELLED: { fa: 'لغوشده', en: 'Cancelled', tone: 'danger' },
  NO_SHOW: { fa: 'حاضر نشد', en: 'No-show', tone: 'neutral' },
}

// Deterministic accent per service so a service keeps its colour everywhere.
const ACCENTS = [
  { bar: 'bg-[var(--text-primary)]', soft: 'bg-black/[0.05] text-[var(--text-primary)]', hex: '#111111' },
  { bar: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-800', hex: '#10b981' },
  { bar: 'bg-sky-500', soft: 'bg-sky-500/10 text-sky-800', hex: '#0ea5e9' },
  { bar: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-800', hex: '#f59e0b' },
  { bar: 'bg-violet-500', soft: 'bg-violet-500/10 text-violet-800', hex: '#765ff2' },
  { bar: 'bg-rose-500', soft: 'bg-rose-500/10 text-rose-800', hex: '#f43f5e' },
  { bar: 'bg-teal-500', soft: 'bg-teal-500/10 text-teal-800', hex: '#14b8a6' },
]

export function serviceAccent(serviceId: string) {
  let hash = 0
  for (let index = 0; index < serviceId.length; index++) hash = (hash * 31 + serviceId.charCodeAt(index)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}

export function num(value: number, fa: boolean): string {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

export function minuteLabel(value: number): string {
  if (value >= 1440) return '24:00'
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function timeToMinute(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN
  return hour * 60 + minute
}

/** Human duration: «۱ ساعت و ۳۰ دقیقه» / «45 min». */
export function durationLabel(minutes: number, fa: boolean): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!fa) return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest} min`
  if (!hours) return `${num(rest, true)} دقیقه`
  return rest ? `${num(hours, true)} ساعت و ${num(rest, true)} دقیقه` : `${num(hours, true)} ساعت`
}

export function shiftDateKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()
}

/** Weekdays on which at least one active service takes bookings. */
export function openWeekdays(services: readonly ServiceRow[]): Set<number> {
  const open = new Set<number>()
  for (const service of services) {
    if (!service.active) continue
    for (const rule of service.weeklyRules) if (rule.active) open.add(rule.weekday)
  }
  return open
}

export function isClosedDate(services: readonly ServiceRow[], dateKey: string): boolean {
  const active = services.filter((service) => service.active)
  if (!active.length) return false
  const weekday = weekdayOf(dateKey)
  return active.every((service) => {
    const exception = service.exceptions.find((item) => item.date === dateKey)
    if (exception) return exception.closed
    return !service.weeklyRules.some((rule) => rule.active && rule.weekday === weekday)
  })
}

export type DayPart = 'morning' | 'afternoon' | 'evening'

export const DAY_PARTS: Record<DayPart, { fa: string; en: string; Icon: typeof Sun }> = {
  morning: { fa: 'صبح', en: 'Morning', Icon: Sun },
  afternoon: { fa: 'بعدازظهر', en: 'Afternoon', Icon: Coffee },
  evening: { fa: 'عصر و شب', en: 'Evening', Icon: Moon },
}

export function dayPartOfMinute(minute: number): DayPart {
  if (minute < 12 * 60) return 'morning'
  if (minute < 17 * 60) return 'afternoon'
  return 'evening'
}

export function localMinuteOf(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso))
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  return hour * 60 + minute
}

export function appointmentFromApi(value: Record<string, unknown>): AppointmentRow {
  const service = (value.service ?? {}) as Record<string, unknown>
  return {
    id: String(value.id),
    serviceId: String(value.serviceId),
    serviceName: String(service.name ?? ''),
    serviceLocation: typeof service.location === 'string' ? service.location : null,
    contactId: typeof value.contactId === 'string' ? value.contactId : null,
    customerName: String(value.customerName ?? ''),
    customerPhone: typeof value.customerPhone === 'string' ? value.customerPhone : null,
    startsAt: String(value.startsAt),
    endsAt: String(value.endsAt),
    timezone: String(value.timezone ?? 'Asia/Tehran'),
    partySize: Number(value.partySize) || 1,
    status: value.status as AppointmentStatus,
    source: String(value.source ?? 'dashboard'),
    notes: typeof value.notes === 'string' ? value.notes : null,
    reminders: remindersFromMetadata(value.metadata),
  }
}

export function serviceFromApi(raw: Record<string, unknown>): ServiceRow {
  const count = (raw._count ?? {}) as Record<string, unknown>
  const exceptions = Array.isArray(raw.exceptions) ? raw.exceptions : []
  const rules = Array.isArray(raw.weeklyRules) ? raw.weeklyRules : []
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: typeof raw.description === 'string' ? raw.description : null,
    durationMinutes: Number(raw.durationMinutes),
    slotIntervalMinutes: Number(raw.slotIntervalMinutes),
    bufferBeforeMinutes: Number(raw.bufferBeforeMinutes) || 0,
    bufferAfterMinutes: Number(raw.bufferAfterMinutes) || 0,
    capacity: Number(raw.capacity),
    timezone: String(raw.timezone),
    location: typeof raw.location === 'string' ? raw.location : null,
    price: typeof raw.price === 'number' && raw.price > 0 ? raw.price : null,
    active: Boolean(raw.active),
    appointmentCount: Number(count.appointments) || 0,
    weeklyRules: rules.map((value) => {
      const rule = value as Record<string, unknown>
      return {
        weekday: Number(rule.weekday),
        startMinute: Number(rule.startMinute),
        endMinute: Number(rule.endMinute),
        capacity: typeof rule.capacity === 'number' ? rule.capacity : null,
        active: rule.active !== false,
      }
    }),
    exceptions: exceptions.map((value) => {
      const exception = value as Record<string, unknown>
      return {
        id: String(exception.id),
        date: exception.date instanceof Date ? exception.date.toISOString().slice(0, 10) : String(exception.date).slice(0, 10),
        closed: Boolean(exception.closed),
        startMinute: typeof exception.startMinute === 'number' ? exception.startMinute : null,
        endMinute: typeof exception.endMinute === 'number' ? exception.endMinute : null,
        capacity: typeof exception.capacity === 'number' ? exception.capacity : null,
        note: typeof exception.note === 'string' ? exception.note : null,
      }
    }),
  }
}

const BOOKING_ERRORS: Record<string, { fa: string; en: string }> = {
  CAPACITY_EXCEEDED: { fa: 'این زمان همین حالا پر شد؛ زمان دیگری را انتخاب کنید.', en: 'That time just filled up. Pick another slot.' },
  SLOT_IN_PAST: { fa: 'این زمان گذشته است؛ زمان دیگری را انتخاب کنید.', en: 'That time has already passed.' },
  OUTSIDE_AVAILABILITY: { fa: 'این زمان خارج از ساعات کاری این خدمت است.', en: 'That time is outside this service’s hours.' },
  SERVICE_INACTIVE: { fa: 'این خدمت غیرفعال است؛ ابتدا آن را فعال کنید.', en: 'This service is inactive.' },
  CUSTOMER_LIMIT: { fa: 'سقف تعداد مشتریان پلن پر شده است.', en: 'Your plan’s customer limit is reached.' },
  PLAN_BLOCKED: { fa: 'پلن فضای کاری فعال نیست؛ برای ثبت تغییر، پلن را تمدید کنید.', en: 'Your plan is inactive.' },
  APPOINTMENT_NOT_ACTIVE: { fa: 'این نوبت دیگر فعال نیست.', en: 'This appointment is no longer active.' },
  TRANSACTION_CONFLICT: { fa: 'در همین لحظه رزرو دیگری ثبت شد؛ دوباره تلاش کنید.', en: 'Another booking landed at the same moment. Try again.' },
  INVALID: { fa: 'اطلاعات کامل یا معتبر نیست؛ نام و شماره را بررسی کنید.', en: 'Some details are missing or invalid.' },
}

export function bookingErrorMessage(code: string | undefined, fa: boolean): string {
  const copy = code ? BOOKING_ERRORS[code] : undefined
  if (copy) return fa ? copy.fa : copy.en
  return fa ? 'ثبت انجام نشد؛ دوباره تلاش کنید.' : 'That did not go through. Try again.'
}
