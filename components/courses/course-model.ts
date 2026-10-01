import { dateKeyInTimeZone } from '@/lib/bookings/time'
import { localMinuteOf } from '@/components/bookings/booking-model'

export type Locale = 'fa' | 'en'
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED'
export type CourseFormat = 'IN_PERSON' | 'ONLINE' | 'HYBRID'
export type EnrollmentStatus = 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'

export interface SessionRow { id?: string; title: string | null; startsAt: string; endsAt: string }
export interface SeatRow { capacity: number; taken: number; waitlisted: number; left: number }

export interface CourseRow {
  id: string
  title: string
  description: string | null
  instructor: string | null
  format: CourseFormat
  location: string | null
  price: number | null
  capacity: number
  status: CourseStatus
  waitlistEnabled: boolean
  enrollmentDeadline: string | null
  timezone: string
  sessions: SessionRow[]
  seats: SeatRow
}

export interface EnrollmentRow {
  id: string
  name: string
  phone: string | null
  note: string | null
  status: EnrollmentStatus
  source: string
  contactId: string | null
  conversationId: string | null
  createdAt: string
}

/** Editable session in the course's local time. */
export interface SessionDraft { key: string; localDate: string; startMinute: number; endMinute: number; title: string }

export function num(value: number, fa: boolean) {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

export function toman(value: number | null, fa: boolean) {
  if (value === null) return fa ? 'قیمت منتشر نشده' : 'No public price'
  if (value === 0) return fa ? 'رایگان' : 'Free'
  return fa ? `${num(value, true)} تومان` : `${value.toLocaleString('en-US')} Toman`
}

export function courseFromApi(raw: Record<string, unknown>): CourseRow {
  const seats = (raw.seats ?? {}) as Record<string, unknown>
  const sessions = Array.isArray(raw.sessions) ? raw.sessions as Array<Record<string, unknown>> : []
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    description: typeof raw.description === 'string' ? raw.description : null,
    instructor: typeof raw.instructor === 'string' ? raw.instructor : null,
    format: (raw.format as CourseFormat) ?? 'IN_PERSON',
    location: typeof raw.location === 'string' ? raw.location : null,
    price: typeof raw.price === 'number' ? raw.price : null,
    capacity: Number(raw.capacity) || 0,
    status: (raw.status as CourseStatus) ?? 'DRAFT',
    waitlistEnabled: raw.waitlistEnabled !== false,
    enrollmentDeadline: typeof raw.enrollmentDeadline === 'string' ? raw.enrollmentDeadline : raw.enrollmentDeadline instanceof Date ? raw.enrollmentDeadline.toISOString() : null,
    timezone: String(raw.timezone ?? 'Asia/Tehran'),
    sessions: sessions.map((session) => ({
      id: typeof session.id === 'string' ? session.id : undefined,
      title: typeof session.title === 'string' ? session.title : null,
      startsAt: String(session.startsAt instanceof Date ? session.startsAt.toISOString() : session.startsAt),
      endsAt: String(session.endsAt instanceof Date ? session.endsAt.toISOString() : session.endsAt),
    })),
    seats: {
      capacity: Number(seats.capacity) || Number(raw.capacity) || 0,
      taken: Number(seats.taken) || 0,
      waitlisted: Number(seats.waitlisted) || 0,
      left: Number(seats.left) || 0,
    },
  }
}

export function enrollmentFromApi(raw: Record<string, unknown>): EnrollmentRow {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    phone: typeof raw.phone === 'string' ? raw.phone : null,
    note: typeof raw.note === 'string' ? raw.note : null,
    status: raw.status as EnrollmentStatus,
    source: String(raw.source ?? 'dashboard'),
    contactId: typeof raw.contactId === 'string' ? raw.contactId : null,
    conversationId: typeof raw.conversationId === 'string' ? raw.conversationId : null,
    createdAt: String(raw.createdAt),
  }
}

export function sessionToDraft(session: SessionRow, timezone: string, index: number): SessionDraft {
  return {
    key: session.id ?? `s${index}`,
    localDate: dateKeyInTimeZone(new Date(session.startsAt), timezone),
    startMinute: localMinuteOf(session.startsAt, timezone),
    endMinute: localMinuteOf(session.endsAt, timezone),
    title: session.title ?? '',
  }
}

/** The next session that has not ended, or null for a finished course. */
export function nextSession(course: CourseRow, now = Date.now()): { session: SessionRow; index: number } | null {
  const index = course.sessions.findIndex((session) => new Date(session.endsAt).getTime() > now)
  return index < 0 ? null : { session: course.sessions[index], index }
}

export const STATUS_META: Record<CourseStatus, { fa: string; en: string; tone: 'ok' | 'warn' | 'neutral' | 'signal' }> = {
  DRAFT: { fa: 'پیش‌نویس', en: 'Draft', tone: 'neutral' },
  PUBLISHED: { fa: 'در حال ثبت‌نام', en: 'Enrolling', tone: 'ok' },
  CLOSED: { fa: 'ثبت‌نام بسته', en: 'Closed', tone: 'warn' },
  ARCHIVED: { fa: 'بایگانی', en: 'Archived', tone: 'neutral' },
}

export const FORMAT_META: Record<CourseFormat, { fa: string; en: string }> = {
  IN_PERSON: { fa: 'حضوری', en: 'In person' },
  ONLINE: { fa: 'آنلاین', en: 'Online' },
  HYBRID: { fa: 'حضوری و آنلاین', en: 'Hybrid' },
}

export const ENROLLMENT_META: Record<EnrollmentStatus, { fa: string; en: string; tone: 'ok' | 'warn' | 'neutral' | 'signal' | 'danger' }> = {
  PENDING: { fa: 'در انتظار تأیید', en: 'Pending', tone: 'warn' },
  CONFIRMED: { fa: 'قطعی', en: 'Confirmed', tone: 'ok' },
  WAITLISTED: { fa: 'فهرست انتظار', en: 'Waitlist', tone: 'signal' },
  CANCELLED: { fa: 'انصراف', en: 'Cancelled', tone: 'neutral' },
}

export function courseErrorMessage(code: string | undefined, fa: boolean): string {
  switch (code) {
    case 'FULL': return fa ? 'ظرفیت پر است و فهرست انتظار خاموش است.' : 'The course is full and has no waitlist.'
    case 'NOT_OPEN': return fa ? 'این دوره بایگانی شده است.' : 'This course is archived.'
    case 'CUSTOMER_LIMIT': return fa ? 'سقف مشتریان پلن پر شده است.' : 'Your plan’s customer limit is reached.'
    case 'HAS_ACTIVE_ENROLLMENTS': return fa ? 'این دوره ثبت‌نامی فعال دارد؛ بایگانی‌اش کنید.' : 'It still has active sign-ups; archive it instead.'
    case 'PLAN_BLOCKED': return fa ? 'برای این کار پلن فعال لازم است.' : 'An active plan is required.'
    case 'INVALID': return fa ? 'چند مورد درست پر نشده؛ دوباره بررسی کنید.' : 'Some fields are invalid.'
    default: return fa ? 'انجام نشد؛ دوباره تلاش کنید.' : 'Something went wrong. Try again.'
  }
}
