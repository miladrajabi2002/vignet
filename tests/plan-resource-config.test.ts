import { afterEach, describe, expect, it } from 'vitest'
import { getPlanDefs, recommendedUpgradePlan, type PlanDef } from '@/lib/billing/plans'
import type { Plan } from '@prisma/client'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

function withProducts(limits: Partial<Record<Plan, number>>): Record<Plan, PlanDef> {
  const plans = getPlanDefs()
  for (const [plan, maxProducts] of Object.entries(limits) as [Plan, number][]) {
    plans[plan] = { ...plans[plan], maxProducts }
  }
  return plans
}

describe('plan resource and reply-price configuration', () => {
  it('keeps plan reply discounts disabled for every plan', () => {
    process.env.PLAN_REPLY_DISCOUNT_STARTER_BPS = '9000'
    process.env.PLAN_REPLY_DISCOUNT_PRO_BPS = '9000'
    process.env.PLAN_REPLY_DISCOUNT_BUSINESS_BPS = '9000'

    const plans = getPlanDefs()
    expect(Object.values(plans).map((plan) => plan.replyDiscountBps)).toEqual([0, 0, 0, 0])
  })

  it('ignores env for limits the admin panel manages', () => {
    process.env.PLAN_LIMIT_STARTER_PRODUCTS = '321'

    expect(getPlanDefs().STARTER).toMatchObject({
      maxProducts: 500,
      maxOrders: 2_000,
      maxCustomers: 2_000,
    })
  })

  it('recommends the smallest higher tier that can accept one more resource', () => {
    const plans = getPlanDefs()

    expect(recommendedUpgradePlan(plans, 'TRIAL', 'products', 50)).toBe('STARTER')
    expect(recommendedUpgradePlan(plans, 'STARTER', 'products', 500)).toBe('PRO')
    expect(recommendedUpgradePlan(plans, 'PRO', 'customers', 10_000)).toBe('BUSINESS')
    expect(recommendedUpgradePlan(plans, 'BUSINESS', 'orders', 50_000)).toBeNull()
  })

  it('skips a higher tier when its customized allowance is still too small', () => {
    const plans = withProducts({ STARTER: 60, PRO: 80, BUSINESS: 1000 })

    expect(recommendedUpgradePlan(plans, 'TRIAL', 'products', 80)).toBe('BUSINESS')
  })
})
