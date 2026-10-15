import { describe, expect, it } from 'vitest'
import { friendlySyncError, isPlausibleStoreUrl } from '@/components/integrations/woo-ui'
import { storeHost } from '@/components/integrations/woo-styles'

describe('WooCommerce store address check', () => {
  it('accepts bare domains, schemes and Persian TLD-free paths', () => {
    expect(isPlausibleStoreUrl('shop.example.ir')).toBe(true)
    expect(isPlausibleStoreUrl('http://shop.example.com/store/')).toBe(true)
  })

  it('rejects text that cannot be a site', () => {
    expect(isPlausibleStoreUrl('')).toBe(false)
    expect(isPlausibleStoreUrl('my shop')).toBe(false)
    expect(isPlausibleStoreUrl('localhost')).toBe(false)
    expect(isPlausibleStoreUrl('shop.')).toBe(false)
  })

  it('shows the address people recognise', () => {
    expect(storeHost('https://www.shop.ir/')).toBe('www.shop.ir')
  })
})

describe('WooCommerce sync failures in plain words', () => {
  it('explains the common transport failures', () => {
    expect(friendlySyncError('cURL error 28: Operation timed out after 30001 ms', true)).toContain('به‌موقع جواب نداد')
    expect(friendlySyncError('getaddrinfo ENOTFOUND shop.example.com', false)).toContain('Could not reach the site')
    expect(friendlySyncError('HTTP 401 Unauthorized', false)).toContain('Connect')
    expect(friendlySyncError('PRODUCT_LIMIT:100', false)).toContain('plan limit')
  })

  it('leaves unknown messages to the raw text', () => {
    expect(friendlySyncError('something odd', true)).toBeNull()
    expect(friendlySyncError(null, true)).toBeNull()
  })
})
