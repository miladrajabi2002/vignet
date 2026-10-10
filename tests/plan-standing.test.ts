import { describe, expect, it } from 'vitest'
import { planStanding } from '@/lib/billing/plan-standing'

const NOW = new Date('2026-10-10T12:00:00Z')
const PAST = new Date('2026-10-01T00:00:00Z')
const FUTURE = new Date('2026-10-20T00:00:00Z')

describe('plan standing', () => {
  it('runs a trial until trialEndsAt, whatever the subscription says', () => {
    expect(planStanding({ plan: 'TRIAL', trialEndsAt: FUTURE, periodEnd: null }, NOW)).toEqual({ plan: 'TRIAL', active: true })
    expect(planStanding({ plan: 'TRIAL', trialEndsAt: PAST, periodEnd: FUTURE }, NOW)).toEqual({ plan: 'TRIAL', active: false })
    expect(planStanding({ plan: 'TRIAL', trialEndsAt: null, periodEnd: null }, NOW).active).toBe(false)
  })

  it('counts a paid plan as live only inside an active subscription period', () => {
    expect(planStanding({ plan: 'PRO', trialEndsAt: PAST, periodEnd: FUTURE }, NOW)).toEqual({ plan: 'PRO', active: true })
    expect(planStanding({ plan: 'BUSINESS', trialEndsAt: FUTURE, periodEnd: PAST }, NOW).active).toBe(false)
    // No ACTIVE subscription row at all.
    expect(planStanding({ plan: 'STARTER', trialEndsAt: FUTURE, periodEnd: null }, NOW).active).toBe(false)
  })
})
