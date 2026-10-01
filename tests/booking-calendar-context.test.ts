import { describe, expect, it } from 'vitest'
import {
  bookingCalendarContext,
  bookingDateLabel,
  shiftDateKey,
  summarizeWeeklyHours,
} from '@/lib/bookings/calendar-context'
import { BOOKING_AGENT_TOOLS, bookingToolInstruction } from '@/lib/bookings/agent-tools'

describe('booking calendar grounding', () => {
  // 2026-09-28T21:30Z is 01:00 on Tuesday 29 Sep in Tehran (UTC+3:30).
  const now = new Date('2026-09-28T21:30:00.000Z')

  it('labels dates in Jalali with the correct weekday', () => {
    expect(bookingDateLabel('2026-09-29')).toBe('سه‌شنبه ۷ مهر ۱۴۰۵')
    expect(bookingDateLabel('2026-10-02')).toBe('جمعه ۱۰ مهر ۱۴۰۵')
    expect(bookingDateLabel('2026-09-29', false)).toBe('Tuesday, September 29, 2026')
  })

  it('anchors "today" to the Tehran calendar day, not UTC', () => {
    const context = bookingCalendarContext({ now, days: 3 })
    expect(context).toContain('2026-09-29 = سه‌شنبه ۷ مهر ۱۴۰۵ (امروز)')
    expect(context).toContain('2026-09-30 = چهارشنبه ۸ مهر ۱۴۰۵ (فردا)')
    expect(context).toContain('2026-10-01 = پنجشنبه ۹ مهر ۱۴۰۵ (پس‌فردا)')
    expect(context).toContain('ساعت فعلی 01:00')
  })

  it('carries the calendar into the booking instruction', () => {
    const instruction = bookingToolInstruction({ isFa: true, now })
    expect(instruction).toContain('(فردا)')
    expect(instruction).toContain('find_next_available_slots')
    expect(instruction).toContain('list_my_appointments')
  })

  it('summarizes weekly hours Saturday-first, including split shifts and closed days', () => {
    const summary = summarizeWeeklyHours([
      { weekday: 6, startMinute: 540, endMinute: 780, active: true },
      { weekday: 6, startMinute: 840, endMinute: 1080, active: true },
      { weekday: 0, startMinute: 540, endMinute: 1440, active: true },
      { weekday: 1, startMinute: 540, endMinute: 600, active: false },
    ])
    expect(summary[0]).toEqual({ day: 'شنبه', hours: '09:00-13:00 و 14:00-18:00' })
    expect(summary[1]).toEqual({ day: 'یکشنبه', hours: '09:00-24:00' })
    expect(summary[2]).toEqual({ day: 'دوشنبه', hours: 'تعطیل' })
  })

  it('shifts date keys across month and year boundaries', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('exposes customer-scoped lookup, move and earliest-slot tools', () => {
    const names = BOOKING_AGENT_TOOLS.map((tool) => tool.function.name)
    expect(names).toEqual(expect.arrayContaining([
      'list_booking_services',
      'list_available_slots',
      'find_next_available_slots',
      'create_appointment',
      'list_my_appointments',
      'reschedule_appointment',
      'cancel_appointment',
    ]))
  })
})
