import { describe, expect, it } from 'vitest'
import { stockFilterWhere } from '@/lib/products/stock-filter'

describe('stockFilterWhere', () => {
  it('keeps the catalog tab unfiltered and hidden as a visibility flag', () => {
    expect(stockFilterWhere('', 3)).toEqual({})
    expect(stockFilterWhere('hidden', 3)).toEqual({ active: false })
  })

  it('counts zero and negative stock as out of stock, never as low', () => {
    expect(stockFilterWhere('out_of_stock', 3)).toEqual({ stock: { lte: 0 } })
    expect(stockFilterWhere('low_stock', 3)).toMatchObject({ stock: { gt: 0 } })
  })

  it('excludes low-stock products from the in-stock tab so the states do not overlap', () => {
    const inStock = stockFilterWhere('in_stock', 3)
    expect(inStock).toMatchObject({
      OR: [{ stock: null }, { stock: { gt: 0 }, NOT: { OR: expect.any(Array) } }],
    })
  })

  it('drops the level rule when the alert level is off, leaving only alerted products low', () => {
    expect(stockFilterWhere('low_stock', 0)).toEqual({
      stock: { gt: 0 },
      OR: [{ lowStockAlertedAt: { not: null } }],
    })
  })
})
