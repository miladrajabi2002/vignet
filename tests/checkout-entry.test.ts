import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { cartPageIn, checkoutEntryUrl, entryFromIntegration } from '@/lib/commerce/checkout-entry'

const SLUG = 'abcdefghijklmnopqrstuvwx'

// A page cache that ignores unknown query strings answers
// https://store/?vigent_checkout=… with the cached homepage: the plugin never
// runs and no order is created. With that cache cold, the plugin's «invalid
// link» page was stored as the homepage itself (seen live, 2026-10-13).
describe('where a payment link enters the store', () => {
  it('uses the WooCommerce callback endpoint once the plugin answers there', () => {
    expect(checkoutEntryUrl('https://shop.example', SLUG, { pluginVersion: '5.1.3' }))
      .toBe(`https://shop.example/?wc-api=vigent_checkout&vigent_checkout=${SLUG}`)
    expect(checkoutEntryUrl('https://vigent.ir/demo-shop/', SLUG, { pluginVersion: '5.2.0' }))
      .toBe(`https://vigent.ir/demo-shop/?wc-api=vigent_checkout&vigent_checkout=${SLUG}`)
  })

  it('keeps the plain store link for older plugins with a healthy store', () => {
    expect(checkoutEntryUrl('https://shop.example', SLUG, { pluginVersion: '5.0.1' })).toBe(`https://shop.example/?vigent_checkout=${SLUG}`)
    expect(checkoutEntryUrl('https://shop.example', SLUG)).toBe(`https://shop.example/?vigent_checkout=${SLUG}`)
  })

  it('goes through the store’s cart page, which no cache stores, for older plugins', () => {
    expect(checkoutEntryUrl('https://shop.example', SLUG, { pluginVersion: '5.0.1', entryUrl: 'https://shop.example/cart/' }))
      .toBe(`https://shop.example/cart/?vigent_checkout=${SLUG}`)
  })

  it('never sends a customer to another site', () => {
    expect(checkoutEntryUrl('https://shop.example', SLUG, { pluginVersion: '5.0.1', entryUrl: 'https://evil.example/cart/' }))
      .toBe(`https://shop.example/?vigent_checkout=${SLUG}`)
    expect(checkoutEntryUrl('https://shop.example', SLUG, { pluginVersion: '5.0.1', entryUrl: 'http://shop.example/cart/' }))
      .toBe(`https://shop.example/?vigent_checkout=${SLUG}`)
  })

  it('reads the stored cart page from the connection', () => {
    expect(entryFromIntegration({ pluginVersion: '5.0.1', capabilities: { checkoutEntry: { url: 'https://shop.example/cart/', checkedAt: '2026-10-13T00:00:00.000Z' } } }))
      .toEqual({ pluginVersion: '5.0.1', entryUrl: 'https://shop.example/cart/' })
    expect(entryFromIntegration({ pluginVersion: null, capabilities: null })).toEqual({ pluginVersion: null, entryUrl: null })
  })

  it('reads the store’s own cart address from a WooCommerce page', () => {
    const html = 'var wc_add_to_cart_params = {"ajax_url":"\\/wp-admin\\/admin-ajax.php","cart_url":"https:\\/\\/shop.example\\/%d8%b3%d8%a8%d8%af\\/","x":1};'
    expect(cartPageIn(html, 'https://shop.example')).toBe('https://shop.example/%d8%b3%d8%a8%d8%af/')
    expect(cartPageIn('{"cart_url":"https:\\/\\/other.example\\/cart\\/"}', 'https://shop.example')).toBeNull()
    expect(cartPageIn('<html><body>فروشگاه</body></html>', 'https://shop.example')).toBeNull()
  })
})
