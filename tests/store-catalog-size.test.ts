import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { catalogSizeFromHeaders, productPlanLimit } = await import('@/lib/integrations/store-catalog-size')
const { getPlanDefs } = await import('@/lib/billing/plans')

const defs = getPlanDefs()
const header = (value?: string) => new Request('https://x.test', { headers: value === undefined ? {} : { 'x-vigent-catalog-size': value } })

describe('store catalog size', () => {
  it('reads the plugin header and ignores anything that is not a count', () => {
    expect(catalogSizeFromHeaders(header('10000'))).toBe(10_000)
    expect(catalogSizeFromHeaders(header('0'))).toBe(0)
    expect(catalogSizeFromHeaders(header())).toBeUndefined()
    expect(catalogSizeFromHeaders(header(''))).toBeUndefined()
    expect(catalogSizeFromHeaders(header('-5'))).toBeUndefined()
    expect(catalogSizeFromHeaders(header('12abc'))).toBeUndefined()
    expect(catalogSizeFromHeaders(header('999999999'))).toBeUndefined()
  })

  it('recommends the plan that holds the whole store, not just the next one up', () => {
    // Starter holds 500; a 2,000-product store needs Pro (2,500), a 9,000 one Business.
    const full = { plan: 'STARTER' as const, used: 500, limit: 500 }
    expect(productPlanLimit(defs, full, 2_000)).toMatchObject({ recommendedPlan: 'PRO', storeTotal: 2_000 })
    expect(productPlanLimit(defs, full, 9_000)).toMatchObject({ recommendedPlan: 'BUSINESS', recommendedLimit: 10_000, storeTotal: 9_000 })
  })

  it('has no plan to offer when the store is bigger than every plan', () => {
    const full = { plan: 'STARTER' as const, used: 500, limit: 500 }
    expect(productPlanLimit(defs, full, 50_000)).toMatchObject({ recommendedPlan: null, storeTotal: 50_000 })
  })

  it('falls back to the next plan up without a reported store size', () => {
    const full = { plan: 'STARTER' as const, used: 500, limit: 500 }
    expect(productPlanLimit(defs, full, null)).toMatchObject({ recommendedPlan: 'PRO', storeTotal: null })
    // A stale report smaller than what is stored says nothing new.
    expect(productPlanLimit(defs, full, 300)).toMatchObject({ recommendedPlan: 'PRO', storeTotal: null })
  })
})
