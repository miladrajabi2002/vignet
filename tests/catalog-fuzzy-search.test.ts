import { describe, expect, it } from 'vitest'
import { allowedEdits, catalogEditDistance, correctCatalogTerm, correctSearchTerms } from '@/lib/search/fuzzy-terms'
import { attributeValueText } from '@/lib/products/description'
import { matchedVariationLine } from '@/lib/ai/rag'
import { GLOBAL_PRODUCT_WORDS } from '@/lib/ai/conversation'
import { composeSpellingNote } from '@/lib/agent/turn/brief'

const VOCAB = new Set(['شلوار', 'جین', 'مانتو', 'پیراهن', 'آپادانا', 'میز', 'جلومبلی', 'صندلی', 'تلویزیون', 'میزتلویزیون', 'کرم', 'مشکی', 'سرمه', 'سرمه‌ای', 'کتان', 'لینن', 'روناز', 'تونیک', '0788'])

describe('typo-tolerant catalog terms', () => {
  it('corrects common slips to the word the catalog uses', () => {
    expect(correctCatalogTerm('شلوا', VOCAB)).toBe('شلوار') // dropped letter
    expect(correctCatalogTerm('شلاور', VOCAB)).toBe('شلوار') // swapped neighbours
    expect(correctCatalogTerm('مانتوو', VOCAB)).toBe('مانتو') // doubled letter
    expect(correctCatalogTerm('پیرهن', VOCAB)).toBe('پیراهن') // colloquial spelling
    expect(correctCatalogTerm('آپادنا', VOCAB)).toBe('آپادانا') // model name
    expect(correctCatalogTerm('اپادانا', VOCAB)).toBe('آپادانا') // آ typed as ا
    expect(correctCatalogTerm('سندلی', VOCAB)).toBe('صندلی') // س/ص confusion
    expect(correctCatalogTerm('تونیگ', VOCAB)).toBe('تونیک') // ک/گ (Arabic keyboard)
  })

  it('matches a glued or split compound through its space-free form', () => {
    expect(correctCatalogTerm('میز تلویزیون', VOCAB)).toBe('میزتلویزیون')
  })

  it('never rewrites short words, codes, catalog words or protected retail words', () => {
    expect(correctCatalogTerm('کیف', new Set(['کیک']))).toBeNull() // 3 letters: کیف ≠ کیک
    expect(correctCatalogTerm('0789', VOCAB)).toBeNull() // codes are exact
    expect(correctCatalogTerm('شلوار', VOCAB)).toBeNull() // already a catalog word
    expect(correctCatalogTerm('صندل', VOCAB, { protect: GLOBAL_PRODUCT_WORDS })).toBeNull() // sandal ≠ chair
    expect(correctCatalogTerm('صندل', VOCAB)).toBe('صندلی') // (what the guard prevents)
  })

  it('leaves an ambiguous slip as typed instead of guessing', () => {
    expect(correctCatalogTerm('کرمی', new Set(['کرمو', 'کرما']))).toBeNull()
  })

  it('does not invent a word the catalog does not have', () => {
    expect(correctCatalogTerm('کاپشن', VOCAB)).toBeNull()
    expect(correctCatalogTerm('هندزفری', VOCAB)).toBeNull()
  })

  it('distance is weighted and bounded by length', () => {
    expect(catalogEditDistance('سندلی', 'صندلی')).toBe(0.5)
    expect(catalogEditDistance('شلاور', 'شلوار')).toBe(1)
    expect(catalogEditDistance('abcdef', 'uvwxyz', 2)).toBe(3)
    expect([allowedEdits('میز'), allowedEdits('شلوار'), allowedEdits('آپادانا')]).toEqual([0, 1, 2])
  })

  it('corrects a whole term list and reports each fix', () => {
    expect(correctSearchTerms(['شلوا', 'جین', 'مشکی'], VOCAB)).toEqual({
      terms: ['شلوار', 'جین', 'مشکی'],
      corrections: [{ from: 'شلوا', to: 'شلوار' }],
    })
    expect(composeSpellingNote([{ from: 'شلوا', to: 'شلوار' }], 'fa')).toContain('«شلوا» ← «شلوار»')
    expect(composeSpellingNote([], 'fa')).toBe('')
  })
})

const MANTEAU_ATTRIBUTES = {
  'رنگ': 'کرم, مشکی',
  'سایز': 'M, L',
  _variations: [
    { id: 11, sku: '1420170070615', price: 1_900_000, manageStock: true, stockQuantity: 3, attributes: { 'رنگ': 'کرم', 'سایز': 'M' } },
    { id: 12, sku: '1420170070616', price: 1_950_000, manageStock: true, stockQuantity: 0, attributes: { 'رنگ': 'کرم', 'سایز': 'L' } },
    { id: 13, sku: '1420170070617', price: 1_900_000, manageStock: true, stockQuantity: 5, attributes: { 'رنگ': 'مشکی', 'سایز': 'L' } },
  ],
}

describe('attribute and variation values in search', () => {
  it('reads keys, values and variation options but never variation SKUs or prices', () => {
    const text = attributeValueText(MANTEAU_ATTRIBUTES)
    expect(text).toContain('کرم')
    expect(text).toContain('مشکی')
    expect(text).toContain('سایز')
    expect(text).not.toContain('1420170070615')
    expect(text).not.toContain('1900000')
    expect(attributeValueText(null)).toBe('')
  })

  it('names the exact variation the customer described, with its own price and stock', () => {
    const line = matchedVariationLine(MANTEAU_ATTRIBUTES, 'مانتو مشکی سایز L دارین؟')
    expect(line).toContain('تنوعی که مشتری گفت: رنگ: مشکی، سایز: L')
    expect(line).toContain('قیمت:')
    expect(line).toContain('موجودی: 5 عدد')
  })

  it('a partly described variation lists only the options still in stock', () => {
    const line = matchedVariationLine(MANTEAU_ATTRIBUTES, 'مانتو کرم میخوام')
    expect(line).toContain('«رنگ: کرم»')
    expect(line).toContain('1 مورد موجود')
    expect(line).toContain('سایز: M')
    expect(line).not.toContain('سایز: M، L')
  })

  it('says plainly when the described option is sold out', () => {
    expect(matchedVariationLine({ _variations: [MANTEAU_ATTRIBUTES._variations[1]] }, 'کرم L')).toContain('موجودی: ناموجود')
    const soldOutCream = { _variations: [{ ...MANTEAU_ATTRIBUTES._variations[0], stockQuantity: 0 }, MANTEAU_ATTRIBUTES._variations[1], MANTEAU_ATTRIBUTES._variations[2]] }
    expect(matchedVariationLine(soldOutCream, 'مانتو کرم')).toBe('→ «رنگ: کرم» در این محصول الان موجود نیست.')
  })
})
