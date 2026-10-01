import { describe, expect, it } from 'vitest'
import { composeOrderUpdate, followLine, orderChange } from '@/lib/commerce/order-updates-text'
import { holdEndedText, holdReminderText, sumHeld, withHeldStock } from '@/lib/commerce/cart-hold'
import { decodeAttributeText, extractTypedVariations } from '@/lib/products/description'
import { matchVariantInText, nextVariantQuestion } from '@/lib/products/variant-match'
import { badgesFromTags, openState, readMenuSettings, readTable, readableOn, withoutBadge } from '@/lib/menu/settings'
import { buildMenuSections, toMenuItem } from '@/lib/menu/public-data'
import { storeCartId } from '@/lib/products/presentation'

const order = { externalOrderId: '1048', status: 'processing', trackingCode: null, courierName: null, trackingLink: null }

describe('order status updates — what is news', () => {
  it('ignores an unchanged order and «pending» bookkeeping', () => {
    expect(orderChange({ notifiedStatus: 'processing', notifiedTracking: null }, order)).toBeNull()
    expect(orderChange({ notifiedStatus: 'processing', notifiedTracking: null }, { ...order, status: 'pending' })).toBeNull()
  })
  it('reports a new status and a new tracking code', () => {
    expect(orderChange({ notifiedStatus: 'pending', notifiedTracking: null }, order)).toEqual({ status: true, tracking: false })
    expect(orderChange({ notifiedStatus: 'processing', notifiedTracking: null }, { ...order, trackingCode: '123456789012345678901234' }))
      .toEqual({ status: false, tracking: true })
    expect(orderChange({ notifiedStatus: 'wc-processing', notifiedTracking: null }, order)).toBeNull()
  })
  it('writes the tracking code exactly and never claims delivery for «completed»', () => {
    const shipped = { ...order, status: 'completed', trackingCode: '123456789012345678901234', courierName: 'پست پیشتاز' }
    const text = composeOrderUpdate(shipped, { status: true, tracking: true }, 'fa', 'https://tracking.post.ir/?id=123456789012345678901234')
    expect(text).toContain('#1048')
    expect(text).toContain('`123456789012345678901234`')
    expect(text).toContain('پست پیشتاز')
    expect(text).toContain('tracking.post.ir')
    expect(text).not.toContain('تحویل داده شد')
    expect(composeOrderUpdate({ ...order, status: 'wc-shipped' }, { status: true, tracking: false }, 'fa', '')).toContain('ارسال شد')
  })
  it('tells web customers the update stays in the chat', () => {
    expect(followLine('TELEGRAM', 'fa')).toContain('خبرتون می‌کنم')
    expect(followLine('WEB_WIDGET', 'fa')).toContain('در همین گفتگو')
  })
})

describe('cart hold — pure half', () => {
  const lamp = { id: 'lamp', stock: 3, attributes: null }
  const coat = { id: 'coat', stock: null, attributes: { _variations: [{ id: 12, manageStock: true, stockQuantity: 2, attributes: { سایز: 'M' } }, { id: 13, manageStock: false, inStock: true, attributes: { سایز: 'L' } }] } }
  it('sums units across carts per product and variation', () => {
    const held = sumHeld([[{ productId: 'lamp', variationId: null, quantity: 2 }], [{ productId: 'lamp', quantity: 1 }, { productId: 'coat', variationId: 12, quantity: 2 }]])
    expect(held.get('lamp:')).toBe(3)
    expect(held.get('coat:12')).toBe(2)
  })
  it('reduces tracked stock only', () => {
    const held = new Map([['lamp:', 2], ['coat:12', 2], ['coat:13', 5]])
    expect(withHeldStock(lamp, held).stock).toBe(1)
    const variations = extractTypedVariations(withHeldStock(coat, held).attributes)
    expect(variations.find((v) => v.id === 12)?.stockQuantity).toBe(0)
    expect(variations.find((v) => v.id === 12)?.inStock).toBe(false)
    expect(variations.find((v) => v.id === 13)?.inStock).toBe(true) // untracked: untouched
  })
  it('says nothing when the hold ends with everything still available', () => {
    const item = { productId: 'lamp', variationId: null, name: 'آباژور', variant: null, quantity: 1, unitPrice: 1, url: null, maxQuantity: null }
    expect(holdEndedText([], [item], 'fa')).toBeNull()
    expect(holdEndedText([item], [], 'fa')).toContain('سبد الان خالیه')
    expect(holdReminderText([item], new Date('2026-09-30T14:10:00Z'), 'fa')).toContain('۳۰ دقیقه')
  })
})

describe('variations', () => {
  const rows = extractTypedVariations({ _variations: [
    { id: 1, attributes: { رنگ: 'مشکی', سایز: 'M' } },
    { id: 2, attributes: { رنگ: 'مشکی', سایز: 'L' } },
    { id: 3, attributes: { رنگ: 'کرم', سایز: 'M' } },
  ] })
  it('partial, full and single-letter sizes', () => {
    const partial = matchVariantInText(rows, 'مشکی میخوام')
    expect(partial.kind).toBe('partial')
    if (partial.kind === 'partial') expect(nextVariantQuestion(partial.candidates, partial.fixed)).toEqual({ attribute: 'سایز', values: ['M', 'L'] })
    const full = matchVariantInText(rows, 'مشکی سایز l')
    expect(full.kind === 'full' && full.variation.id).toBe(2)
    expect(matchVariantInText(rows, 'کرم').kind).toBe('full') // only one cream exists
    expect(matchVariantInText(rows, 'سلام').kind).toBe('none')
  })
  it('hand-entered (negative id) variations are kept, flagged, and never sent to the store', () => {
    const manual = extractTypedVariations({ _variations: [{ id: -2, attributes: { رنگ: 'آبی' }, manageStock: false, inStock: true }] })
    expect(manual).toHaveLength(1)
    expect(manual[0]).toMatchObject({ id: 2, synthetic: true })
    expect(storeCartId({ sourceIntegrationId: 'int', externalId: '55' }, manual, manual[0])).toBeNull()
  })
  it('decodes percent-encoded Persian attribute names from WooCommerce', () => {
    expect(decodeAttributeText('%d8%b3%d8%a7%db%8c%d8%b2')).toBe('سایز')
    expect(decodeAttributeText('XL')).toBe('XL')
    expect(decodeAttributeText('%zz')).toBe('%zz')
  })
})

describe('digital menu settings', () => {
  it('falls back field by field', () => {
    const settings = readMenuSettings({ theme: 'night', accent: 'red', openAt: '25:00', tagline: 'نان تازه' })
    expect(settings.theme).toBe('night')
    expect(settings.accent).toBeNull()
    expect(settings.openAt).toBe('')
    expect(settings.tagline).toBe('نان تازه')
  })
  it('opening hours, including closing after midnight (Tehran time)', () => {
    // 21:30 UTC = 01:00 Tehran
    expect(openState({ openAt: '12:00', closeAt: '02:00' }, new Date('2026-09-30T21:30:00Z'))).toEqual({ open: true, until: '02:00' })
    expect(openState({ openAt: '12:00', closeAt: '23:00' }, new Date('2026-09-30T21:30:00Z'))).toEqual({ open: false, until: '12:00' })
    expect(openState({ openAt: '', closeAt: '' }, new Date())).toBeNull()
  })
  it('badges from tags, table numbers, readable text colour', () => {
    expect(badgesFromTags(['پیشنهاد سرآشپز', 'spicy', 'مهم'])).toEqual(['chef', 'spicy'])
    expect(withoutBadge(['تند', 'hot', 'ناهار'], 'spicy')).toEqual(['ناهار'])
    expect(readTable('۱۲')).toBe('12')
    expect(readTable('<script>')).toBeNull()
    expect(readableOn('#ffffff')).toBe('#141414')
    expect(readableOn('#17171a')).toBe('#ffffff')
  })
  it('sized dishes show their lowest open price; sections keep category order', () => {
    const pizza = toMenuItem({
      id: 'p', name: 'پیتزا', description: '<p>خمیر تازه</p>', price: null, comparePrice: null, stock: null, images: [], categoryId: 'c2', tags: ['جدید'],
      attributes: { _variations: [
        { id: 1, attributes: { اندازه: 'کوچک' }, price: 320_000, manageStock: false, inStock: true },
        { id: 2, attributes: { اندازه: 'بزرگ' }, price: 450_000, manageStock: false, inStock: true },
      ] },
    })
    expect(pizza.price).toBe(320_000)
    expect(pizza.description).toBe('خمیر تازه')
    expect(pizza.badges).toEqual(['new'])
    const sections = buildMenuSections([{ id: 'c1', name: 'پیش‌غذا' }, { id: 'c2', name: 'پیتزا' }], [
      { id: 'p', name: 'پیتزا', description: null, price: 1, comparePrice: null, stock: null, images: [], categoryId: 'c2' },
      { id: 'x', name: 'بدون دسته', description: null, price: 1, comparePrice: null, stock: null, images: [], categoryId: null },
    ])
    expect(sections.map((section) => section.name)).toEqual(['پیتزا', 'منو'.replace('منو', 'سایر')])
  })
})
