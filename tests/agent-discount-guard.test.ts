import { describe, expect, it } from 'vitest'
import { actionCapabilityInstruction, stripAgentDiscountOffers } from '@/lib/agent-kernel/skills/action-capabilities'

describe('agent never grants discounts', () => {
  it.each([
    'براتون ۱۰٪ تخفیف می‌ذارم که راحت‌تر بخرید',
    'برای شما یه تخفیف ویژه اعمال می‌کنم',
    'بهتون تخفیف میدم اگه امروز بخرید',
    '۱۵ درصد تخفیف میدم',
    'یه کد تخفیف اختصاصی براتون ساختم: VIP20',
    "I'll give you a 10% discount if you order today.",
    "We can knock 50,000 off for you.",
  ])('removes the promise: %s', (line) => {
    const out = stripAgentDiscountOffers(`این مدل موجوده.\n${line}\nرنگ گردویی هم داره.`, !/^[A-Za-z]/.test(line))
    expect(out).not.toContain(line)
    expect(out).toContain('این مدل موجوده.')
    expect(out).toContain('رنگ گردویی هم داره.')
    expect(out).toMatch(/اختیار تخفیف|can’t offer discounts/)
  })

  it.each([
    'این محصول الان ۲۰٪ تخفیف خورده و قیمتش ۱٬۱۰۰٬۰۰۰ تومنه',
    'اگه کد تخفیف فروشگاه رو دارید بفرستید تا بررسی بشه',
    'کد تخفیف VIGENT10 روی سبد اعمال شد',
    'The cushion is on sale today.',
  ])('keeps honest store facts: %s', (line) => {
    expect(stripAgentDiscountOffers(line, true)).toBe(line)
  })

  it('the selling instructions forbid discounts in both modes and languages', () => {
    expect(actionCapabilityInstruction(true, true, true)).toContain('اختیار تخفیف دادن نداری')
    expect(actionCapabilityInstruction(false, true, true)).toContain('no authority to discount')
    expect(actionCapabilityInstruction(true, true, false)).toContain('تخفیف یا قیمت ویژه پیشنهاد نده')
    expect(actionCapabilityInstruction(false, true, false)).toContain('offer a discount')
  })
})
