import { describe, expect, it } from 'vitest'
import { detectCartEditCue, mentionsLine, planCartEditDeterministic } from '@/lib/commerce/cart-edit'
import type { OrderDraftItem } from '@/lib/commerce/order-capture'

function item(productId: string, name: string, quantity = 1, variant: string | null = null): OrderDraftItem {
  return { productId, variationId: null, name, variant, quantity, unitPrice: 1_000, url: null, maxQuantity: null }
}

const cart = [item('tv', 'میز تلویزیون لیان'), item('lamp', 'آباژور چوبی'), item('puff', 'پاف مخمل', 1, 'رنگ: طوسی')]

describe('cart edit cues', () => {
  it('detects additions', () => {
    for (const message of ['یه پاف طوسی هم اضافه کن', 'یه آباژور هم بذار', 'دو تا کوسن هم اضافه کن', 'اینم می‌خوام', 'add a cushion', 'I also want a lamp']) {
      expect(detectCartEditCue(message), message).toBe('add')
    }
  })

  it('detects removals', () => {
    for (const message of ['لیان رو حذف کن', 'آباژور رو نمیخوام', 'پاف رو بردار', 'remove the lamp']) {
      expect(detectCartEditCue(message), message).toBe('remove')
    }
  })

  it('detects quantity and variant changes', () => {
    for (const message of ['دوتا کن', 'سه تا بشه', 'رنگش رو سفید کن', 'به جاش مشکی بذار', 'make it two']) {
      expect(detectCartEditCue(message), message).toBe('change')
    }
  })

  it('ignores ordinary order answers', () => {
    for (const message of ['علی رضایی 09123456789', 'تهران، خیابان آزادی، پلاک ۲۰', 'تایید', 'ارسالش چند روزه؟']) {
      expect(detectCartEditCue(message), message).toBeNull()
    }
  })
})

describe('deterministic cart planner (model unavailable)', () => {
  it('removes the one line the message names by a distinctive word', () => {
    expect(mentionsLine('لیان رو حذف کن', cart[0], cart)).toBe(true)
    expect(mentionsLine('لیان رو حذف کن', cart[1], cart)).toBe(false)
    expect(planCartEditDeterministic({ cue: 'remove', message: 'لیان رو حذف کن', cart, identified: [], quantity: undefined }))
      .toEqual([{ op: 'remove', line: 1 }])
  })

  it('does nothing when the removal is ambiguous', () => {
    expect(planCartEditDeterministic({ cue: 'remove', message: 'اون یکی رو حذف کن', cart, identified: [], quantity: undefined })).toEqual([])
  })

  it('adds the product the search identified, never one already in the cart', () => {
    const identified = [{ id: 'lamp', name: 'آباژور چوبی', price: 1, variants: [] }, { id: 'cushion', name: 'کوسن', price: 1, variants: [] }]
    expect(planCartEditDeterministic({ cue: 'add', message: 'کوسن هم بذار', cart, identified, quantity: 2 }))
      .toEqual([{ op: 'add', productId: 'cushion', variant: null, quantity: 2 }])
  })

  it('changes the quantity of the named line, else the last one', () => {
    expect(planCartEditDeterministic({ cue: 'change', message: 'آباژور رو دوتا کن', cart, identified: [], quantity: 2 }))
      .toEqual([{ op: 'set_quantity', line: 2, quantity: 2 }])
    expect(planCartEditDeterministic({ cue: 'change', message: 'دوتا کن', cart, identified: [], quantity: 2 }))
      .toEqual([{ op: 'set_quantity', line: 3, quantity: 2 }])
  })
})
