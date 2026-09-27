import { describe, expect, it } from 'vitest'
import {
  applyOrderSlots,
  assistantOfferedOrder,
  composeOrderAsk,
  composeOrderSubmitted,
  composeOrderSummary,
  detectOrderIntent,
  extractOrderSlots,
  formatOrderForOperator,
  isOrderCancellation,
  isOrderConfirmation,
  isOrderDecline,
  isQuestion,
  missingOrderSlots,
  newDraftCode,
  orderInProgressInstruction,
  parseOrdinalChoice,
  type OrderDraftState,
} from '@/lib/commerce/order-capture'

function draft(overrides: Partial<OrderDraftState> = {}): OrderDraftState {
  return {
    code: 'A7K2Q9',
    status: 'COLLECTING',
    items: [{ productId: 'p1', variationId: null, name: 'میز تلویزیون آپادانا ۱۶۰', variant: null, quantity: 1, unitPrice: 12_500_000, url: null, maxQuantity: null }],
    customerName: null,
    customerPhone: null,
    city: null,
    address: null,
    postalCode: null,
    note: null,
    expecting: null,
    ...overrides,
  }
}

describe('order intent', () => {
  it.each([
    'میخوام سفارش بدم',
    'می‌خوام همینو بخرم',
    'چطوری سفارش بدم؟',
    'از کجا بخرمش؟',
    'همینو میخوام',
    'سفارشمو ثبت کنید',
    'ثبت سفارش',
    'یکی ازش برام بفرستید',
    'I want to buy this',
    'how can I order?',
  ])('detects «%s»', (message) => {
    expect(detectOrderIntent(message)).toBe(true)
  })

  it.each([
    'سفارشم ثبت شده؟',
    'سفارشم کجاست',
    'کد رهگیری سفارشم چیه',
    'اینو میخوام ببینم',
    'قیمتش چنده؟',
    'عکس بیشتر دارید؟',
  ])('ignores «%s»', (message) => {
    expect(detectOrderIntent(message)).toBe(false)
  })

  it('recognises the agent’s own order offer', () => {
    expect(assistantOfferedOrder('می‌خواید همین‌جا براتون ثبتش کنم؟')).toBe(true)
    expect(assistantOfferedOrder('قیمتش ۱۲ میلیونه')).toBe(false)
  })
})

describe('control messages', () => {
  it('confirmation needs a short, unambiguous yes', () => {
    expect(isOrderConfirmation('بله')).toBe(true)
    expect(isOrderConfirmation('آره ثبتش کن')).toBe(true)
    expect(isOrderConfirmation('تأیید')).toBe(true)
    expect(isOrderConfirmation('درسته ممنون')).toBe(true)
    expect(isOrderConfirmation('بله ولی آدرس عوض شده')).toBe(false)
    expect(isOrderConfirmation('بله میخوام بدونم ارسالش چند روزه و هزینش چقدره')).toBe(false)
  })

  it('decline and cancel are distinct', () => {
    expect(isOrderDecline('نه')).toBe(true)
    expect(isOrderCancellation('بیخیال')).toBe(true)
    expect(isOrderCancellation('لغوش کنید')).toBe(true)
    expect(isOrderCancellation('نمیخوامش')).toBe(true)
    // An address containing a long number is data, not a cancellation.
    expect(isOrderCancellation('نمیخوام 09121234567')).toBe(false)
  })

  it('questions are routed to the model', () => {
    expect(isQuestion('ارسالش چند روز طول میکشه؟')).toBe(true)
    expect(isQuestion('علی رضایی')).toBe(false)
  })
})

describe('slot extraction', () => {
  it('parses a multi-line reply with name, phone and address', () => {
    const slots = extractOrderSlots('علی رضایی\n۰۹۱۲ ۳۴۵ ۶۷۸۹\nتهران، خیابان آزادی، کوچه ۵، پلاک ۱۲', 'name', ['name', 'phone', 'address'])
    expect(slots.name).toBe('علی رضایی')
    expect(slots.phone).toBe('09123456789')
    expect(slots.city).toBe('تهران')
    expect(slots.address).toContain('خیابان آزادی')
  })

  it('parses a single-line reply: name, city, street, phone, postal code', () => {
    const slots = extractOrderSlots('مریم احمدی شیراز خیابان زند پلاک ۴ 09351234567 کد پستی 7134567890', 'name', ['name', 'phone', 'address'])
    expect(slots.name).toBe('مریم احمدی')
    expect(slots.phone).toBe('09351234567')
    expect(slots.city).toBe('شیراز')
    expect(slots.address?.startsWith('شیراز')).toBe(true)
    expect(slots.postalCode).toBe('7134567890')
  })

  it('labelled fields win', () => {
    const slots = extractOrderSlots('اسم: سارا کریمی\nشماره: 09120000000\nآدرس: کرج، گوهردشت، بلوار موذن', null, ['name', 'phone', 'address'])
    expect(slots.name).toBe('سارا کریمی')
    expect(slots.phone).toBe('09120000000')
    expect(slots.city).toBe('کرج')
  })

  it('a bare name counts only when a name was asked for', () => {
    expect(extractOrderSlots('رضا محمدی', 'name', ['name']).name).toBe('رضا محمدی')
    expect(extractOrderSlots('رضا محمدی', 'phone', ['phone']).name).toBeUndefined()
  })

  it('a street-less line is an address only when an address was asked for', () => {
    expect(extractOrderSlots('اصفهان جلفا جنب کلیسا', 'address', ['address']).address).toContain('جلفا')
    expect(extractOrderSlots('ارسالش چند روزه', 'address', ['address']).address).toBeUndefined()
  })

  it('reads quantities with units only', () => {
    expect(extractOrderSlots('۲ تا میخوام', null).quantity).toBe(2)
    expect(extractOrderSlots('دو عدد', null).quantity).toBe(2)
    expect(extractOrderSlots('طبقه ۲ واحد ۵', 'address').quantity).toBeUndefined()
  })

  it('never mistakes greetings or confirmations for names', () => {
    expect(extractOrderSlots('ممنون', 'name', ['name']).name).toBeUndefined()
    expect(extractOrderSlots('باشه', 'name', ['name']).name).toBeUndefined()
  })
})

describe('draft state', () => {
  it('asks fields in a fixed order and treats city+address as one slot', () => {
    expect(missingOrderSlots(draft(), false)).toEqual(['name', 'phone', 'address'])
    expect(missingOrderSlots(draft({ items: [] }), false)).toEqual(['product', 'name', 'phone', 'address'])
    expect(missingOrderSlots(draft(), true)[0]).toBe('variant')
    expect(missingOrderSlots(draft({ customerName: 'علی', customerPhone: '09120000000', address: 'خیابان آزادی' }), false)).toEqual(['address'])
    expect(missingOrderSlots(draft({ customerName: 'علی', customerPhone: '09120000000', address: 'تهران خیابان آزادی' }), false)).toEqual([])
  })

  it('caps quantity at tracked stock', () => {
    const state = draft({ items: [{ ...draft().items[0], maxQuantity: 3 }] })
    applyOrderSlots(state, { quantity: 5 })
    expect(state.items[0].quantity).toBe(3)
  })

  it('codes avoid look-alike characters', () => {
    const code = newDraftCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })
})

describe('customer-facing text is built from real data', () => {
  const complete = draft({ customerName: 'علی رضایی', customerPhone: '09123456789', city: 'تهران', address: 'خیابان آزادی، پلاک ۱۲', postalCode: '1234567890' })

  it('opening ask names the product and lists only missing fields', () => {
    const text = composeOrderAsk({ draft: draft({ customerPhone: '09123456789' }), missing: ['name', 'address'], lang: 'fa', opening: true })
    expect(text).toContain('میز تلویزیون آپادانا ۱۶۰')
    expect(text).toContain('نام و نام خانوادگی')
    expect(text).not.toContain('شماره موبایل')
  })

  it('follow-up ask thanks by first name', () => {
    const text = composeOrderAsk({ draft: draft({ customerName: 'علی رضایی' }), missing: ['phone'], lang: 'fa', opening: false })
    expect(text).toMatch(/^ممنون علی/)
  })

  it('summary shows every field and asks for confirmation', () => {
    const text = composeOrderSummary(complete, 'fa')
    expect(text).toContain('۱۲٬۵۰۰٬۰۰۰ تومان')
    expect(text).toContain('09123456789')
    expect(text).toContain('تهران، خیابان آزادی')
    expect(text).toContain('کد پستی 1234567890')
    expect(text).toContain('تأیید')
  })

  it('submitted text carries the reference and never claims payment', () => {
    const text = composeOrderSubmitted(complete, 'fa')
    expect(text).toContain('A7K2Q9')
    expect(text).toContain('هماهنگی پرداخت')
    expect(text).not.toMatch(/پرداخت شد|ارسال شد/)
  })

  it('operator summary is complete', () => {
    const text = formatOrderForOperator(complete)
    expect(text).toContain('#A7K2Q9')
    expect(text).toContain('علی رضایی')
    expect(text).toContain('1234567890')
  })

  it('mid-order instruction forbids a premature «ثبت شد»', () => {
    const text = orderInProgressInstruction(draft(), ['name', 'phone', 'address'], 'fa')
    expect(text).toContain('هرگز نگو سفارش ثبت شد')
    expect(text).toContain('شماره موبایل')
  })
})

describe('ordinal choice', () => {
  it.each([
    ['دومی', 1],
    ['اولی رو', 0],
    ['۳', 2],
    ['آخری', 3],
  ])('«%s» → %i', (message, index) => {
    expect(parseOrdinalChoice(message as string, 4)).toBe(index)
  })

  it('out of range is null', () => {
    expect(parseOrdinalChoice('پنجمی', 3)).toBeNull()
  })
})
