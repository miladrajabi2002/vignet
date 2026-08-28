import { afterEach, describe, expect, it } from 'vitest'
import { getPlanDefs } from '@/lib/billing/plans'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('plan resource and reply-price configuration', () => {
  it('keeps plan reply discounts disabled for every plan', () => {
    process.env.PLAN_REPLY_DISCOUNT_STARTER_BPS = '9000'
    process.env.PLAN_REPLY_DISCOUNT_PRO_BPS = '9000'
    process.env.PLAN_REPLY_DISCOUNT_BUSINESS_BPS = '9000'

    const plans = getPlanDefs()
    expect(Object.values(plans).map((plan) => plan.replyDiscountBps)).toEqual([0, 0, 0, 0])
  })

  it('reads independent product, order, and customer limits from env', () => {
    process.env.PLAN_LIMIT_STARTER_PRODUCTS = '321'
    process.env.PLAN_LIMIT_STARTER_ORDERS = '654'
    process.env.PLAN_LIMIT_STARTER_CUSTOMERS = '987'

    expect(getPlanDefs().STARTER).toMatchObject({
      maxProducts: 321,
      maxOrders: 654,
      maxCustomers: 987,
    })
  })
})
