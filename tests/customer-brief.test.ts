import { describe, expect, it } from 'vitest'
import { cleanCustomFields, customerBriefInstruction, readCustomFields } from '@/lib/crm/customer-brief'

describe('customer custom fields', () => {
  it('drops empty rows and repeated labels, keeping the first', () => {
    expect(cleanCustomFields([
      { label: ' سایز ', value: ' ۳۸ ' },
      { label: 'سایز', value: '۴۰' },
      { label: 'تولد', value: '' },
      { label: '', value: 'x' },
    ])).toEqual([{ label: 'سایز', value: '۳۸' }])
  })

  it('reads stored JSON and skips malformed entries', () => {
    expect(readCustomFields(null)).toEqual([])
    expect(readCustomFields([{ label: 'شرکت', value: 'آلفا' }, { label: 1 }, 'x'])).toEqual([{ label: 'شرکت', value: 'آلفا' }])
  })
})

describe('customerBriefInstruction', () => {
  it('is empty when the owner wrote nothing', () => {
    expect(customerBriefInstruction('fa', { aiBrief: '  ', customFields: [], manualOrders: [] })).toBe('')
  })

  it('carries the note, the fields and the manual orders, subordinate to facts', () => {
    const block = customerBriefInstruction('fa', {
      aiBrief: 'مشتری دائمی ماست؛ تخفیف اضافه نده.',
      customFields: [{ label: 'سایز', value: '۳۸' }],
      manualOrders: [{ title: 'مانتو مشکی', amount: 1_200_000, orderedAt: new Date('2026-10-01T12:00:00Z'), note: null }],
    })
    expect(block).toContain('مشتری دائمی ماست؛ تخفیف اضافه نده.')
    expect(block).toContain('- سایز: ۳۸')
    expect(block).toContain('مانتو مشکی')
    expect(block).toContain('۱٬۲۰۰٬۰۰۰ تومان')
    expect(block).toContain('هرگز قیمت، موجودی، قوانین فروشگاه')
  })

  it('speaks English for an English turn', () => {
    const block = customerBriefInstruction('en', { aiBrief: 'VIP', customFields: [], manualOrders: [] })
    expect(block).toContain("Owner's note:\nVIP")
    expect(block).toContain('never quote it')
  })
})
