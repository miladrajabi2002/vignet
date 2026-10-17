import { describe, expect, it } from 'vitest'
import { LATIN_DIGIT_RE, PERSIAN_DIGIT_RE, latinDigitToPersian, persianDigitToLatin } from '@/lib/agent/parsers/digits'

describe('shared digit conversion', () => {
  it('converts Persian digits to Latin and back', () => {
    expect('قیمت ۱۲۰۰۰ تومان'.replace(PERSIAN_DIGIT_RE, persianDigitToLatin)).toBe('قیمت 12000 تومان')
    expect('میز 17 · 09:30'.replace(LATIN_DIGIT_RE, latinDigitToPersian)).toBe('میز ۱۷ · ۰۹:۳۰')
  })

  it('leaves Arabic-Indic digits alone and is safe to reuse', () => {
    expect('٣ و ۳'.replace(PERSIAN_DIGIT_RE, persianDigitToLatin)).toBe('٣ و 3')
    // Shared /g patterns: repeated replace calls must not carry lastIndex over.
    for (let i = 0; i < 3; i++) expect('۴۵'.replace(PERSIAN_DIGIT_RE, persianDigitToLatin)).toBe('45')
  })
})
