import { describe, it, expect } from 'vitest'
import { cn, generateSlug, formatToman } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })
  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })
})

describe('generateSlug', () => {
  it('matches adjective-noun-rand shape', () => {
    expect(generateSlug()).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]{5}$/)
  })
  it('is (practically) unique across calls', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateSlug()))
    expect(set.size).toBe(50)
  })
})

describe('formatToman', () => {
  it('formats with English digits for en', () => {
    expect(formatToman(1234567, 'en')).toBe('1,234,567')
  })
  it('formats Persian digits for fa', () => {
    // fa-IR groups with the Persian thousands separator; just assert it localized.
    const out = formatToman(1000, 'fa')
    expect(out).not.toBe('1000')
    expect(out).toMatch(/[۰-۹]/)
  })
})
