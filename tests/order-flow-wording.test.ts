import { describe, expect, it } from 'vitest'
import { attributeDisplayName, composeOrderDeclined, composeOrderSummary, composeVariantQuestion, couponErrorText, type OrderDraftState } from '@/lib/commerce/order-capture'
import { shippingCostText } from '@/lib/commerce/checkout-card'
import { detectTurnLanguage } from '@/lib/ai/turn-language'

const draft: OrderDraftState = {
  code: 'A7K2Q9',
  status: 'AWAITING_CONFIRM',
  items: [{ productId: 'p1', variationId: null, name: 'پد آرایش پاک کن', variant: null, quantity: 3, unitPrice: 113_000, url: null, maxQuantity: 16 }],
  customerName: 'مریم احمدی',
  customerPhone: '09351234567',
  city: 'اصفهان',
  address: 'خیابان چهارباغ بالا کوچه ۵ پلاک ۲۰',
  postalCode: null,
  note: null,
  expecting: 'confirm',
}

// Seen in the live sales test of 2026-10-13 (lilium-gallery.ir).
describe('order wording the customer reads', () => {
  it('never calls a zero-priced shipping method free («پس‌کرایه» is paid at the door)', () => {
    expect(shippingCostText(0, 'fa')).not.toContain('رایگان')
    expect(shippingCostText(85_000, 'fa')).toContain('۸۵')
    const summary = composeOrderSummary(draft, 'fa', false, { shipping: { label: 'تیپاکس پس کرایه', cost: 0 }, discount: 0, total: 339_000, gateways: [], couponErrors: [] }, true)
    expect(summary).toContain('ارسال (تیپاکس پس کرایه)')
    expect(summary).not.toContain('رایگان')
  })

  it('says so when the store lists no shipping method for the address', () => {
    const summary = composeOrderSummary(draft, 'fa', false, { shipping: null, discount: 0, total: 339_000, gateways: [], couponErrors: [] }, true)
    expect(summary).toContain('کد پستی رو بفرستید')
    const withCode = composeOrderSummary({ ...draft, postalCode: '8173612345' }, 'fa', false, { shipping: null, discount: 0, total: 339_000, gateways: [], couponErrors: [] }, true)
    expect(withCode).toContain('روشی روی سایت فروشگاه ثبت نشده')
  })

  it('puts the store’s English coupon error into plain Persian', () => {
    expect(couponErrorText('Coupon &quot;test10&quot; cannot be applied because it does not exist.', 'fa')).toBe('این کد روی سایت فروشگاه معتبر نیست یا برای این سبد قابل استفاده نیست')
    expect(couponErrorText('کوپن &quot;test10&quot; وجود ندارد', 'fa')).toBe('کوپن "test10" وجود ندارد')
    expect(couponErrorText('Coupon &quot;x&quot; has expired.', 'en')).toBe('Coupon "x" has expired.')
  })

  it('shows a WooCommerce attribute slug as its name and varies a repeated variant question', () => {
    expect(attributeDisplayName('pa_رنگ-چوب')).toBe('رنگ چوب')
    const item = { ...draft.items[0], name: 'میز تلویزیون آپادانا' }
    const first = composeVariantQuestion(item, ['افرا', 'بلوط'], 'fa', 'pa_رنگ-چوب')
    const again = composeVariantQuestion(item, ['افرا', 'بلوط'], 'fa', 'pa_رنگ-چوب', true)
    expect(first).toContain('کدوم رنگ چوب')
    expect(first).not.toContain('pa_')
    expect(again).not.toBe(first)
    expect(again).toContain('افرا، بلوط')
  })

  it('offers a way out when the customer says no to the summary', () => {
    expect(composeOrderDeclined('fa')).toContain('لغو')
  })
})

describe('reply language', () => {
  const history = [{ role: 'user' as const, content: 'لیپ گلاس حجم دهنده بوستر شیگلم رو می‌خوام بخرم' }]

  it('keeps the conversation’s language for a shade or model typed in Latin letters', () => {
    expect(detectTurnLanguage('Pink Flamingo', history)).toBe('fa')
    expect(detectTurnLanguage('Get Started', history)).toBe('fa')
    expect(detectTurnLanguage('NC25', history)).toBe('fa')
  })

  it('still switches for an English sentence and for a first message in English', () => {
    expect(detectTurnLanguage('do you have it in pink?', history)).toBe('en')
    expect(detectTurnLanguage('2 pieces please', history)).toBe('en')
    expect(detectTurnLanguage('Pink Flamingo', [])).toBe('en')
  })
})
