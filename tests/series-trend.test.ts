import { describe, expect, it } from 'vitest'
import { computePeriodTrend } from '@/components/admin/series-trend'

describe('computePeriodTrend', () => {
  it('compares the mean of the last N complete days with the N before, ignoring today', () => {
    // previous 3 days: 2,2,2 · recent 3 days: 3,3,3 · today (partial): 0
    expect(computePeriodTrend([2, 2, 2, 3, 3, 3, 0], 3)).toEqual({ direction: 'up', pct: 50 })
  })

  it('reports a decrease', () => {
    expect(computePeriodTrend([4, 4, 4, 2, 2, 2, 9], 3)).toEqual({ direction: 'down', pct: -50 })
  })

  it('is flat inside the ±5% band', () => {
    expect(computePeriodTrend([100, 100, 102, 102, 0], 2).direction).toBe('flat')
  })

  it('treats growth from zero as +100% and zero to zero as flat', () => {
    expect(computePeriodTrend([0, 0, 3, 3, 0], 2)).toEqual({ direction: 'up', pct: 100 })
    expect(computePeriodTrend([0, 0, 0, 0, 5], 2)).toEqual({ direction: 'flat', pct: 0 })
  })

  it('is flat when there is no earlier window to compare with', () => {
    expect(computePeriodTrend([5, 5, 5], 3)).toEqual({ direction: 'flat', pct: 0 })
    expect(computePeriodTrend([], 7)).toEqual({ direction: 'flat', pct: 0 })
  })
})
