import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decideLowCreditAlertAction,
  discountedReplyPriceIRR,
  estimateRemainingReplies,
} from '@/lib/billing/credit-estimates'
import { calculateFinanceSummary, parseUsdToIrrRate } from '@/lib/admin/finance'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('reply credit estimates and low-credit state', () => {
  it('uses the shared discounted price and floors to affordable successful replies', () => {
    expect(discountedReplyPriceIRR(3_000, 1_000)).toBe(2_700)
    expect(estimateRemainingReplies(27_999, 2_700)).toBe(10)
  })

  it('alerts only below 20 replies, stays latched, and rearms above the threshold', () => {
    expect(decideLowCreditAlertAction({
      armed: null,
      balanceIRR: 60_000,
      replyPriceIRR: 3_000,
    })).toBe('NONE')
    expect(decideLowCreditAlertAction({
      armed: null,
      balanceIRR: 57_000,
      replyPriceIRR: 3_000,
    })).toBe('ALERT')
    expect(decideLowCreditAlertAction({
      armed: false,
      balanceIRR: 30_000,
      replyPriceIRR: 3_000,
    })).toBe('NONE')
    expect(decideLowCreditAlertAction({
      armed: false,
      balanceIRR: 90_000,
      replyPriceIRR: 3_000,
    })).toBe('REARM')
  })
})

describe('admin finance formula', () => {
  it('calculates plans + top-ups - OpenRouter and reports gift-adjusted profit', () => {
    const result = calculateFinanceSummary({
      planRevenueIRR: 10_000_000,
      planRevenueUSD: 10,
      creditTopupIRR: 2_000_000,
      creditTopupUSD: 0,
      openRouterCostUSD: 3,
      giftedCreditIRR: 1_000_000,
      usdToIRR: 1_000_000,
    })

    expect(result.cashRevenueIRR).toBe(22_000_000)
    expect(result.openRouterCostIRR).toBe(3_000_000)
    expect(result.operatingProfitIRR).toBe(19_000_000)
    expect(result.adjustedProfitIRR).toBe(18_000_000)
  })

  it('refuses to invent a consolidated profit when the USD/IRR rate is missing', () => {
    expect(parseUsdToIrrRate(undefined)).toBeNull()
    expect(parseUsdToIrrRate('not-a-rate')).toBeNull()
    const result = calculateFinanceSummary({
      planRevenueIRR: 10_000_000,
      planRevenueUSD: 0,
      creditTopupIRR: 2_000_000,
      creditTopupUSD: 0,
      openRouterCostUSD: 3,
      giftedCreditIRR: 1_000_000,
      usdToIRR: null,
    })
    expect(result.operatingProfitIRR).toBeNull()
    expect(result.adjustedProfitIRR).toBeNull()
  })
})
