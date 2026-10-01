import { describe, expect, it } from 'vitest'
import { storeCartId } from '@/lib/products/presentation'
import type { VariationRow } from '@/lib/products/description'

const synced = { sourceIntegrationId: 'int_1', externalId: '17', stock: 4 }
const walnut: VariationRow = { id: 13, inStock: true, stockQuantity: 3, attributes: { رنگ: 'گردویی' } }
const black: VariationRow = { id: 15, inStock: false, stockQuantity: 0, attributes: { رنگ: 'مشکی' } }

describe('store cart id on product cards', () => {
  it('a synced simple product goes into the store cart by its WooCommerce id', () => {
    expect(storeCartId(synced, [], null)).toBe(17)
  })
  it('a variation card uses the WooCommerce variation id only while it is in stock', () => {
    expect(storeCartId(synced, [walnut, black], walnut)).toBe(13)
    expect(storeCartId(synced, [walnut, black], black)).toBeNull()
  })
  it('a variable parent needs a variant first; sold-out and manual products never get a cart button', () => {
    expect(storeCartId(synced, [walnut, black], null)).toBeNull()
    expect(storeCartId({ ...synced, stock: 0 }, [], null)).toBeNull()
    expect(storeCartId({ sourceIntegrationId: null, externalId: '17', stock: 4 }, [], null)).toBeNull()
    expect(storeCartId({ ...synced, externalId: 'sku-17' }, [], null)).toBeNull()
  })
})
