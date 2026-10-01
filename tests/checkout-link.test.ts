import { describe, expect, it } from 'vitest'
import {
  checkoutCardText,
  checkoutMarker,
  composeCheckoutFallback,
  composeLinkMessage,
  extractCouponCode,
  isLinkRequest,
  isPaymentClaim,
  isValidLinkSlug,
  newLinkSlug,
  parseCheckoutDirective,
  pluginSupportsCheckout,
  signPayload,
  storeCheckoutUrl,
  verifyPayloadSignature,
  type CheckoutCard,
} from '@/lib/commerce/checkout-link'
import { stripProductTokens } from '@/lib/widget/config'
import { parseProductShowcaseContent } from '@/components/products/product-showcase'
import { stripFabricatedPaymentLinks } from '@/lib/agent-kernel/skills/action-capabilities'

const card: CheckoutCard = {
  code: 'A7K2Q9',
  url: 'https://shop.example/?vigent_checkout=abcdefghijklmnopqrstuvwx',
  storeHost: 'shop.example',
  items: [
    { name: 'میز تلویزیون آرتا', variant: 'رنگ: گردویی', quantity: 1, lineTotal: 6_900_000 },
    { name: 'پاف مخمل', variant: null, quantity: 2, lineTotal: 2_500_000 },
  ],
  shipping: { label: 'پیک تهران', cost: 80_000 },
  discount: 500_000,
  total: 8_980_000,
  expiresAt: '2026-10-01T10:00:00.000Z',
  lang: 'fa',
}

describe('checkout link tokens and signatures', () => {
  it('issues unguessable URL-safe slugs', () => {
    const slugs = new Set(Array.from({ length: 200 }, () => newLinkSlug()))
    expect(slugs.size).toBe(200)
    for (const slug of slugs) expect(isValidLinkSlug(slug)).toBe(true)
    expect(isValidLinkSlug('short')).toBe(false)
    expect(isValidLinkSlug('<script>alert(1)</script>xx')).toBe(false)
  })

  it('builds the store link on the site root, including sub-directory installs', () => {
    expect(storeCheckoutUrl('https://vigent.ir/demo-shop', 'abc')).toBe('https://vigent.ir/demo-shop/?vigent_checkout=abc')
    expect(storeCheckoutUrl('https://shop.example/', 'abc')).toBe('https://shop.example/?vigent_checkout=abc')
  })

  it('verifies the same HMAC the plugin computes and rejects replays and tampering', () => {
    const now = 1_790_000_000
    const body = '{"slug":"x"}'
    const signature = signPayload('secret', String(now), body)
    expect(verifyPayloadSignature({ secret: 'secret', timestamp: String(now), signature, body, nowSeconds: now + 10 })).toBe(true)
    expect(verifyPayloadSignature({ secret: 'secret', timestamp: String(now), signature, body: '{"slug":"y"}', nowSeconds: now })).toBe(false)
    expect(verifyPayloadSignature({ secret: 'other', timestamp: String(now), signature, body, nowSeconds: now })).toBe(false)
    expect(verifyPayloadSignature({ secret: 'secret', timestamp: String(now), signature, body, nowSeconds: now + 301 })).toBe(false)
    expect(verifyPayloadSignature({ secret: 'secret', timestamp: null, signature, body, nowSeconds: now })).toBe(false)
  })

  it('gates payment links on plugin 5.0+', () => {
    expect(pluginSupportsCheckout('5.0.0')).toBe(true)
    expect(pluginSupportsCheckout('5.1')).toBe(true)
    expect(pluginSupportsCheckout('10.0.0')).toBe(true)
    expect(pluginSupportsCheckout('4.3.11')).toBe(false)
    expect(pluginSupportsCheckout(null)).toBe(false)
  })
})

describe('checkout card marker', () => {
  it('round-trips through the reply and never leaks JSON as text', () => {
    const reply = composeLinkMessage(card, new Date('2026-09-30T10:00:00.000Z'))
    const parsed = parseCheckoutDirective(reply)
    expect(parsed.checkout).toEqual(card)
    expect(parsed.text).not.toContain('[[checkout')
    expect(parsed.text).toContain('A7K2Q9')
    expect(parsed.text).toContain('تا ۲۴ ساعت معتبره')
  })

  it('drops a truncated marker instead of showing it', () => {
    const parsed = parseCheckoutDirective('سلام\n[[checkout:{"code":"A7K2Q9","url":"https://sh')
    expect(parsed.checkout).toBeNull()
    expect(parsed.text).toBe('سلام')
  })

  it('refuses non-http URLs inside a marker', () => {
    const parsed = parseCheckoutDirective(checkoutMarker({ ...card, url: 'javascript:alert(1)' }))
    expect(parsed.checkout).toBeNull()
  })

  it('is stripped from history, previews and the dashboard transcript', () => {
    const content = `لینک پرداخت آماده‌ست\n${checkoutMarker(card)}`
    expect(stripProductTokens(content)).toBe('لینک پرداخت آماده‌ست')
    const showcase = parseProductShowcaseContent(content)
    expect(showcase.text).toBe('لینک پرداخت آماده‌ست')
    expect(showcase.checkout?.code).toBe('A7K2Q9')
  })

  it('renders a text fallback with the link and every amount for plain-text channels', () => {
    const text = composeCheckoutFallback(card)
    expect(text).toContain(card.url)
    expect(text).toContain('۸٬۹۸۰٬۰۰۰')
    expect(checkoutCardText(card)).toContain('تخفیف')
    expect(checkoutCardText(card)).not.toContain(card.url)
  })
})

describe('customer intents around an open payment link', () => {
  it('recognises payment claims', () => {
    for (const message of ['پرداخت کردم', 'من پرداخت کردم', 'واریز کردم', 'پرداخت شد؟', 'کارت به کارت کردم', 'I paid']) {
      expect(isPaymentClaim(message)).toBe(true)
    }
    expect(isPaymentClaim('چطوری پرداخت کنم؟')).toBe(false)
  })

  it('recognises link requests', () => {
    for (const message of ['لینک پرداخت رو دوباره بفرست', 'لینک کار نمیکنه', 'لینک کو؟', 'send the payment link again']) {
      expect(isLinkRequest(message)).toBe(true)
    }
    expect(isLinkRequest('سلام')).toBe(false)
  })

  it('extracts coupon codes, including Persian digits', () => {
    expect(extractCouponCode('کد تخفیف VIGENT10 دارم')).toBe('VIGENT10')
    expect(extractCouponCode('کد تخفیفم: yalda۱۴۰۵')).toBe('YALDA1405')
    expect(extractCouponCode('coupon code SUMMER-5')).toBe('SUMMER-5')
    expect(extractCouponCode('تخفیف دارید؟')).toBeNull()
  })
})

describe('fabricated payment links in model replies', () => {
  it('removes order-pay URLs, gateway pages and invented checkout markers', () => {
    const invented = 'آباژور چوبی: لینک پرداخت سفارش #46:\nhttps://shop.example/checkout/order-pay/46/?pay_for_order=true&key=wc_order_6b1a2c3d4e5f\nممنون'
    const cleaned = stripFabricatedPaymentLinks(invented, true)
    expect(cleaned).not.toMatch(/order-pay|wc_order_/)
    expect(cleaned).toContain('لینک پرداخت رو فقط خود سیستم')
    expect(stripFabricatedPaymentLinks('پرداخت: https://sandbox.zarinpal.com/pg/StartPay/S000', true)).not.toContain('zarinpal')
    expect(stripFabricatedPaymentLinks(`بفرمایید ${checkoutMarker(card)}`, true)).not.toContain('[[checkout')
  })

  it('leaves ordinary replies and product links alone', () => {
    const reply = 'میز آرتا موجوده؛ صفحه‌ش: https://shop.example/product/arta'
    expect(stripFabricatedPaymentLinks(reply, true)).toBe(reply)
  })
})
