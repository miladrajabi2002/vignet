/**
 * The lines a payment is for: products picked from the catalog or lines the
 * owner typed (shipping, a custom order). Stored on hand-made payments; a
 * chat order's lines come from its order draft.
 */
export interface PayItem {
  name: string
  quantity: number
  /** Whole tomans per unit; null when the line has no price of its own. */
  unitPrice: number | null
  productId?: string | null
}

export const MAX_PAY_ITEMS = 20

export function readPayItems(value: unknown): PayItem[] {
  if (!Array.isArray(value)) return []
  const items: PayItem[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 120) : ''
    if (!name) continue
    const quantity = typeof item.quantity === 'number' && item.quantity >= 1 ? Math.min(999, Math.round(item.quantity)) : 1
    const unitPrice = typeof item.unitPrice === 'number' && item.unitPrice >= 0 ? Math.round(item.unitPrice) : null
    const productId = typeof item.productId === 'string' ? item.productId : null
    items.push({ name, quantity, unitPrice, productId })
    if (items.length >= MAX_PAY_ITEMS) break
  }
  return items
}

/** The sum of the priced lines, whole tomans. */
export function payItemsTotal(items: PayItem[]): number {
  return items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)
}
