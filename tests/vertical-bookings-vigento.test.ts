import { describe, expect, it } from 'vitest'
import {
  buildAvailableSlots,
  effectiveAvailabilityWindows,
  inspectRequestedSlot,
  intervalsOverlap,
} from '@/lib/bookings/availability'
import {
  localDateRangeUtc,
  localDateTimeToUtc,
  weekdayForDateKey,
} from '@/lib/bookings/time'
import {
  getDashboardModules,
  getVerticalPack,
} from '@/lib/verticals/registry'
import { fallbackVigentoDraft, vigentoDraftSchema } from '@/lib/ai/vigento-draft'
import { buildTurnReceipts } from '@/lib/conversations/activity'
import { isMarketingOptOutMessage } from '@/lib/crm/marketing-consent'
import { campaignDeliveryText } from '@/lib/campaigns/process'

describe('vertical workspace registry', () => {
  it('keeps CRM/AI/reporting common and adds only the relevant specialist module', () => {
    expect(getDashboardModules('APPOINTMENTS')).toContain('appointments')
    expect(getDashboardModules('APPOINTMENTS')).not.toContain('products')
    expect(getDashboardModules('COMMERCE')).toContain('products')
    expect(getDashboardModules('COMMERCE')).not.toContain('appointments')
    expect(getDashboardModules('EDUCATION')).toEqual(expect.arrayContaining([
      'agents',
      'conversations',
      'contacts',
      'analytics',
    ]))
    expect(getVerticalPack('unknown').key).toBe('CUSTOM')
  })
})

describe('timezone-safe availability and capacity', () => {
  const weeklyRules = [{
    weekday: 6,
    startMinute: 9 * 60,
    endMinute: 12 * 60,
    capacity: null,
    active: true,
  }]

  it('converts Tehran local wall time to UTC and produces a real local-day range', () => {
    expect(localDateTimeToUtc('2026-07-11', 9 * 60, 'Asia/Tehran').toISOString())
      .toBe('2026-07-11T05:30:00.000Z')
    const range = localDateRangeUtc('2026-07-11', 'Asia/Tehran')
    expect(range.end.getTime() - range.start.getTime()).toBe(24 * 60 * 60_000)
    expect(weekdayForDateKey('2026-07-11')).toBe(6)
  })

  it('lets date exceptions close or replace the weekly window', () => {
    expect(effectiveAvailabilityWindows({
      dateKey: '2026-07-11',
      defaultCapacity: 2,
      weeklyRules,
      exception: { closed: true, startMinute: null, endMinute: null, capacity: null },
    })).toEqual([])
    expect(effectiveAvailabilityWindows({
      dateKey: '2026-07-11',
      defaultCapacity: 2,
      weeklyRules,
      exception: { closed: false, startMinute: 600, endMinute: 660, capacity: 4 },
    })).toEqual([{ startMinute: 600, endMinute: 660, capacity: 4 }])
  })

  it('removes full slots and keeps remaining capacity accurate', () => {
    const startsAt = localDateTimeToUtc('2026-07-11', 9 * 60, 'Asia/Tehran')
    const appointments = [{
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      partySize: 1,
    }]
    const slots = buildAvailableSlots({
      dateKey: '2026-07-11',
      timeZone: 'Asia/Tehran',
      durationMinutes: 60,
      slotIntervalMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      defaultCapacity: 2,
      partySize: 2,
      weeklyRules,
      appointments,
      now: new Date('2026-07-10T00:00:00.000Z'),
    })
    expect(slots.map((slot) => slot.startMinute)).not.toContain(9 * 60)
    expect(slots.map((slot) => slot.startMinute)).toContain(10 * 60)

    const rejected = inspectRequestedSlot({
      dateKey: '2026-07-11',
      startMinute: 9 * 60,
      timeZone: 'Asia/Tehran',
      durationMinutes: 60,
      slotIntervalMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      defaultCapacity: 1,
      partySize: 1,
      weeklyRules,
      appointments,
    })
    expect(rejected).toMatchObject({ allowed: false, reason: 'CAPACITY_EXCEEDED' })
    expect(intervalsOverlap(startsAt, appointments[0].endsAt, appointments[0].endsAt, new Date(appointments[0].endsAt.getTime() + 1))).toBe(false)
  })
})

describe('Vigento safe draft and operational receipts', () => {
  it('builds a schema-valid booking draft with handoff and evaluation cases', () => {
    const draft = fallbackVigentoDraft(
      'برای کلینیک یک دستیار رزرو می‌خواهم که زمان آزاد را بررسی کند و موارد حساس را تحویل دهد.',
      'fa',
    )
    expect(vigentoDraftSchema.safeParse(draft).success).toBe(true)
    expect(draft.roleTemplate).toBe('lead_capture')
    expect(draft.handoffEnabled).toBe(true)
    expect(draft.evalCases.length).toBeGreaterThanOrEqual(3)
  })

  it('records only bounded action facts, including a real catalog comparison', () => {
    const receipts = buildTurnReceipts({
      userMessage: 'کدام محصول بهتر است؟ مقایسه کن',
      assistantReply: 'دو انتخاب مناسب:\n[[product:{"name":"A"}]]\n[[product:{"name":"B"}]]',
      retrievedChunks: [
        { metadata: { productId: 'a' } },
        { metadata: { productId: 'b' } },
      ],
    })
    expect(receipts).toEqual(expect.arrayContaining([
      { kind: 'catalog_checked', count: 2 },
      { kind: 'products_compared', count: 2 },
    ]))
  })
})

describe('safe campaign consent language', () => {
  it('recognizes normalized opt-out messages before AI runs', () => {
    expect(isMarketingOptOutMessage('STOP!')).toBe(true)
    expect(isMarketingOptOutMessage('دیگه پیام نده؟')).toBe(true)
    expect(isMarketingOptOutMessage('قیمت محصول چیست؟')).toBe(false)
  })

  it('adds the opt-out footer in the message language', () => {
    expect(campaignDeliveryText('اطلاع‌رسانی جدید')).toContain('برای لغو')
    expect(campaignDeliveryText('A new customer update')).toContain('Reply STOP')
  })
})
