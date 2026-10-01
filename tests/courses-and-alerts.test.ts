import { describe, expect, it } from 'vitest'
import { enrollmentOpen, placementFor, seatSummary } from '@/lib/courses/service'
import { hasCourseIntent } from '@/lib/courses/intent'
import { enrollmentClaimWithoutAction } from '@/lib/courses/chat-orchestrator'
import { dueReminderStage, composeBookingReminder } from '@/lib/bookings/customer-reminders'
import { expiryStage, PAID_STAGES, TRIAL_STAGES } from '@/lib/billing/plan-expiry-alerts'
import { lowStockAlertText } from '@/lib/commerce/low-stock'

const HOUR = 3_600_000

describe('course seats and waitlist', () => {
  it('counts pending and confirmed as taken seats', () => {
    expect(seatSummary(10, { PENDING: 2, CONFIRMED: 5, WAITLISTED: 3, CANCELLED: 4 })).toEqual({ capacity: 10, taken: 7, waitlisted: 3, left: 3 })
  })

  it('places into a seat, then the waitlist, then refuses', () => {
    expect(placementFor({ seatsLeft: 1, waitlistEnabled: true })).toBe('PENDING')
    expect(placementFor({ seatsLeft: 1, waitlistEnabled: true, requested: 'CONFIRMED' })).toBe('CONFIRMED')
    expect(placementFor({ seatsLeft: 0, waitlistEnabled: true })).toBe('WAITLISTED')
    expect(placementFor({ seatsLeft: 0, waitlistEnabled: false })).toBeNull()
  })

  it('closes sign-up at the deadline or when the first session starts', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    const past = new Date('2026-09-30T10:00:00Z')
    const future = new Date('2026-10-05T10:00:00Z')
    expect(enrollmentOpen({ status: 'PUBLISHED', enrollmentDeadline: null, firstSessionAt: future }, now)).toBe('open')
    expect(enrollmentOpen({ status: 'PUBLISHED', enrollmentDeadline: past, firstSessionAt: future }, now)).toBe('deadline')
    expect(enrollmentOpen({ status: 'PUBLISHED', enrollmentDeadline: null, firstSessionAt: past }, now)).toBe('deadline')
    expect(enrollmentOpen({ status: 'DRAFT', enrollmentDeadline: null, firstSessionAt: future }, now)).toBe('not_open')
  })

  it('detects course intent and unverified enrollment claims', () => {
    expect(hasCourseIntent([{ role: 'user', content: 'برای دوره پایتون ثبت‌نام دارید؟' }])).toBe(true)
    expect(hasCourseIntent([{ role: 'user', content: 'قیمت این کفش چنده' }])).toBe(false)
    expect(enrollmentClaimWithoutAction('ثبت‌نام شما انجام شد', [])).toBe('enrolled')
    expect(enrollmentClaimWithoutAction('ثبت‌نام شما انجام شد', [{ kind: 'course_enrolled' }])).toBeNull()
  })
})

describe('booking reminders in the conversation', () => {
  const startsAt = new Date('2026-10-03T10:00:00Z')
  const bookedEarly = new Date('2026-09-28T10:00:00Z')

  it('fires the day-ahead reminder once, then the two-hour one', () => {
    expect(dueReminderStage({ startsAt, createdAt: bookedEarly, now: new Date(startsAt.getTime() - 20 * HOUR), log: {} })).toBe('h24')
    expect(dueReminderStage({ startsAt, createdAt: bookedEarly, now: new Date(startsAt.getTime() - 20 * HOUR), log: { h24: { status: 'sent', at: '' } } })).toBeNull()
    expect(dueReminderStage({ startsAt, createdAt: bookedEarly, now: new Date(startsAt.getTime() - 90 * 60_000), log: { h24: { status: 'sent', at: '' } } })).toBe('h2')
    expect(dueReminderStage({ startsAt, createdAt: bookedEarly, now: new Date(startsAt.getTime() - 10 * 60_000), log: {} })).toBeNull()
  })

  it('skips reminders for a booking made just before it', () => {
    const bookedLate = new Date(startsAt.getTime() - 5 * HOUR)
    expect(dueReminderStage({ startsAt, createdAt: bookedLate, now: new Date(startsAt.getTime() - 4.5 * HOUR), log: {} })).toBeNull()
    expect(dueReminderStage({ startsAt, createdAt: bookedLate, now: new Date(startsAt.getTime() - 90 * 60_000), log: {} })).toBe('h2')
  })

  it('writes a Persian reminder with the day and a way to cancel', () => {
    const text = composeBookingReminder({ stage: 'h24', lang: 'fa', serviceName: 'کوتاهی مو', startsAt, timezone: 'Asia/Tehran', location: null, now: new Date(startsAt.getTime() - 20 * HOUR) })
    expect(text).toContain('فردا')
    expect(text).toContain('«کوتاهی مو»')
    expect(text).toContain('لغو')
  })
})

describe('owner alerts', () => {
  it('picks the tightest expiry stage', () => {
    expect(expiryStage(6.5 * 24 * HOUR, PAID_STAGES)).toBe(7)
    expect(expiryStage(2 * 24 * HOUR, PAID_STAGES)).toBe(3)
    expect(expiryStage(10 * HOUR, PAID_STAGES)).toBe(1)
    expect(expiryStage(8 * 24 * HOUR, PAID_STAGES)).toBeNull()
    expect(expiryStage(5 * 24 * HOUR, TRIAL_STAGES)).toBeNull()
  })

  it('summarises low stock for one or many products', () => {
    expect(lowStockAlertText([{ name: 'ماگ', stock: 0 }]).title).toBe('«ماگ» تمام شد')
    const many = lowStockAlertText([{ name: 'الف', stock: 0 }, { name: 'ب', stock: 2 }])
    expect(many.title).toContain('۲ محصول')
    expect(many.body).toContain('ناموجود')
    expect(many.body).toContain('۲ عدد مانده')
  })
})
