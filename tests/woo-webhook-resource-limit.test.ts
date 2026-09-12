import { describe, expect, it } from 'vitest'
import { wooResourceLimitMessage } from '@/lib/integrations/woocommerce'

describe('WooCommerce webhook resource limits', () => {
  it('classifies plan capacity as an expected terminal webhook outcome', () => {
    expect(wooResourceLimitMessage(new Error('PRODUCT_LIMIT:50'))).toBe('PRODUCT_LIMIT:50')
    expect(wooResourceLimitMessage(new Error('ORDER_LIMIT:100'))).toBe('ORDER_LIMIT:100')
    expect(wooResourceLimitMessage(new Error('CUSTOMER_LIMIT'))).toBe('CUSTOMER_LIMIT')
  })

  it('keeps operational failures retryable', () => {
    expect(wooResourceLimitMessage(new Error('WEBHOOK_DELIVERY_NOT_FOUND'))).toBeNull()
    expect(wooResourceLimitMessage(new Error('PRODUCT_LIMIT:invalid'))).toBeNull()
    expect(wooResourceLimitMessage('redis down')).toBeNull()
  })
})
