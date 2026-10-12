import type { Prisma } from '@prisma/client'

export const STOCK_FILTER_KEYS = ['in_stock', 'low_stock', 'out_of_stock', 'hidden'] as const
export type StockFilter = '' | (typeof STOCK_FILTER_KEYS)[number]

/**
 * Tracked stock at or under the alert level (and above zero). Products with
 * their own level count once an alert has been raised for them, the same
 * rule the alert sweep uses, so the list and the bell agree.
 */
function lowStockCondition(lowStockThreshold: number): Prisma.ProductWhereInput {
  return {
    OR: [
      { lowStockAlertedAt: { not: null } },
      ...(lowStockThreshold > 0 ? [{ lowStockThreshold: null, stock: { lte: lowStockThreshold } }] : []),
    ],
  }
}

/**
 * Where clause for one filter tab. The three stock states are a partition:
 * unlimited or above the alert level is in stock, 1..level is running low,
 * zero or below is out of stock (an oversold product can go negative).
 * So the tab counts add up to the catalog total. Hidden is a visibility
 * flag rather than a stock state, so it overlaps them.
 */
export function stockFilterWhere(filter: StockFilter, lowStockThreshold: number): Prisma.ProductWhereInput {
  switch (filter) {
    case 'in_stock':
      return { OR: [{ stock: null }, { stock: { gt: 0 }, NOT: lowStockCondition(lowStockThreshold) }] }
    case 'low_stock':
      return { stock: { gt: 0 }, ...lowStockCondition(lowStockThreshold) }
    case 'out_of_stock':
      return { stock: { lte: 0 } }
    case 'hidden':
      return { active: false }
    default:
      return {}
  }
}
