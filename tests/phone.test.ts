import { describe, it, expect } from 'vitest'
import { normalizePhone, toEnglishDigits, phoneSchema } from '@/lib/phone'

describe('toEnglishDigits', () => {
  it('converts Persian digits to ASCII', () => {
    expect(toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
  })
  it('converts Arabic digits to ASCII', () => {
    expect(toEnglishDigits('٠٩١٢')).toBe('0912')
  })
  it('leaves ASCII untouched', () => {
    expect(toEnglishDigits('09123456789')).toBe('09123456789')
  })
})

describe('normalizePhone', () => {
  it.each([
    ['09123456789', '+989123456789'],
    ['9123456789', '+989123456789'],
    ['+989123456789', '+989123456789'],
    ['00989123456789', '+989123456789'],
    ['989123456789', '+989123456789'],
    ['۰۹۱۲۳۴۵۶۷۸۹', '+989123456789'],
    ['0912 345 6789', '+989123456789'],
    ['0912-345-6789', '+989123456789'],
  ])('normalizes %s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each([
    [''],
    ['12345'],
    ['08123456789'], // landline-style, not a 9-prefixed mobile
    ['+1202555' + '0100'], // non-Iranian
    ['0912345678'], // too short
    ['091234567890'], // too long
  ])('rejects invalid input %s', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('phoneSchema', () => {
  it('parses and normalizes a valid phone', () => {
    expect(phoneSchema.parse('۰۹۱۲۳۴۵۶۷۸۹')).toBe('+989123456789')
  })
  it('throws on an invalid phone', () => {
    expect(() => phoneSchema.parse('not-a-phone')).toThrow()
  })
})
