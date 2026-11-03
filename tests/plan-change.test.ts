import { describe, expect, it } from 'vitest'
import { carryOverDays, carryOverMs, planChange, upgradedPeriodEnd } from '@/lib/billing/plan-change'

const DAY = 86_400_000
const now = new Date('2026-11-03T10:00:00Z')
const starter = (daysLeft: number, status = 'ACTIVE') => ({
  plan: 'STARTER' as const,
  status,
  currentPeriodEnd: new Date(now.getTime() + daysLeft * DAY),
  monthlyPrice: 8_900_000,
  currency: 'IRR',
})

describe('changing plan mid-period', () => {
  it('tells an upgrade, a renewal and a locked downgrade apart', () => {
    expect(planChange(starter(20), 'PRO', now)).toBe('upgrade')
    expect(planChange(starter(20), 'STARTER', now)).toBe('renew')
    expect(planChange({ ...starter(20), plan: 'PRO' }, 'STARTER', now)).toBe('downgrade')
  })

  it('treats a lapsed or missing plan as a fresh purchase', () => {
    expect(planChange(null, 'STARTER', now)).toBe('new')
    expect(planChange(starter(-1), 'STARTER', now)).toBe('new')
    expect(planChange({ ...starter(-1), plan: 'PRO' }, 'STARTER', now)).toBe('new')
    expect(planChange(starter(20, 'CANCELLED'), 'STARTER', now)).toBe('new')
  })

  it('turns 20 days of Starter into ≈7 days of Pro on top of the 30 paid', () => {
    const carry = carryOverMs(starter(20), { plan: 'PRO', monthlyPrice: 24_900_000, currency: 'IRR' }, 0, now)
    // 20 days × 890k / 2.49M ≈ 7.15 days
    expect(carry / DAY).toBeCloseTo(7.149, 2)
    expect(carryOverDays(carry)).toBe(7)
    expect(upgradedPeriodEnd(carry, now).getTime()).toBe(now.getTime() + 30 * DAY + carry)
  })

  it('uses the list-price ratio when the currencies differ', () => {
    const carry = carryOverMs(starter(10), { plan: 'PRO', monthlyPrice: 30, currency: 'USD' }, 0.5, now)
    expect(carry).toBe(5 * DAY)
  })

  it('carries nothing on a renewal or after the plan ended', () => {
    expect(carryOverMs(starter(20), { plan: 'STARTER', monthlyPrice: 8_900_000, currency: 'IRR' }, 1, now)).toBe(0)
    expect(carryOverMs(starter(-2), { plan: 'PRO', monthlyPrice: 24_900_000, currency: 'IRR' }, 1, now)).toBe(0)
    expect(carryOverMs(null, { plan: 'PRO', monthlyPrice: 24_900_000, currency: 'IRR' }, 1, now)).toBe(0)
  })
})
