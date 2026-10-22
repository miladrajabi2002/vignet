import { describe, expect, it } from 'vitest'
import { daysUntil, planStanding, planUrgency } from '@/lib/billing/plan-standing'

const NOW = new Date('2026-10-10T12:00:00Z')
const PAST = new Date('2026-10-01T00:00:00Z')
const FUTURE = new Date('2026-10-20T00:00:00Z')

describe('plan standing', () => {
  it('runs a trial until trialEndsAt, whatever the subscription says', () => {
    expect(planStanding({ plan: 'TRIAL', trialEndsAt: FUTURE, periodEnd: null }, NOW)).toEqual({ plan: 'TRIAL', active: true, daysLeft: 10 })
    expect(planStanding({ plan: 'TRIAL', trialEndsAt: PAST, periodEnd: FUTURE }, NOW)).toEqual({ plan: 'TRIAL', active: false, daysLeft: -10 })
    expect(planStanding({ plan: 'TRIAL', trialEndsAt: null, periodEnd: null }, NOW)).toEqual({ plan: 'TRIAL', active: false, daysLeft: null })
  })

  it('counts a paid plan as live only inside an active subscription period', () => {
    expect(planStanding({ plan: 'PRO', trialEndsAt: PAST, periodEnd: FUTURE }, NOW)).toEqual({ plan: 'PRO', active: true, daysLeft: 10 })
    expect(planStanding({ plan: 'BUSINESS', trialEndsAt: FUTURE, periodEnd: PAST }, NOW).active).toBe(false)
    // No ACTIVE subscription row at all.
    expect(planStanding({ plan: 'STARTER', trialEndsAt: FUTURE, periodEnd: null }, NOW)).toEqual({ plan: 'STARTER', active: false, daysLeft: null })
  })
})

describe('days until', () => {
  it('counts a partial day left as a whole day', () => {
    expect(daysUntil(new Date('2026-10-10T13:00:00Z'), NOW)).toBe(1)
    expect(daysUntil(new Date('2026-10-12T12:00:00Z'), NOW)).toBe(2)
    expect(daysUntil(NOW, NOW)).toBe(0)
  })

  it('goes negative once the end has passed', () => {
    expect(daysUntil(new Date('2026-10-10T11:00:00Z'), NOW)).toBe(-1)
    expect(daysUntil(new Date('2026-10-07T12:00:00Z'), NOW)).toBe(-3)
  })
})

describe('plan urgency', () => {
  it('steps from ok to soon to critical as the period runs out', () => {
    expect(planUrgency({ active: true, daysLeft: 8 })).toBe('ok')
    expect(planUrgency({ active: true, daysLeft: 7 })).toBe('soon')
    expect(planUrgency({ active: true, daysLeft: 3 })).toBe('soon')
    expect(planUrgency({ active: true, daysLeft: 2 })).toBe('critical')
    expect(planUrgency({ active: true, daysLeft: 0 })).toBe('critical')
  })

  it('treats an ended or dateless plan as expired', () => {
    expect(planUrgency({ active: false, daysLeft: -3 })).toBe('expired')
    expect(planUrgency({ active: false, daysLeft: null })).toBe('expired')
  })
})
