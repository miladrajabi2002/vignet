import { describe, expect, it } from 'vitest'
import {
  contactPhoneLookupVariants,
  normalizeContactPhone,
} from '@/lib/phone'

describe('CRM phone identity normalization', () => {
  it.each([
    '+989128352271',
    '09128352271',
    '989128352271',
    '9128352271',
    '00989128352271',
  ])('maps %s to one canonical customer identity', (value) => {
    expect(normalizeContactPhone(value)).toBe('09128352271')
  })

  it('returns legacy spellings for backwards-compatible lookup', () => {
    expect(contactPhoneLookupVariants('09128352271')).toEqual([
      '09128352271',
      '+989128352271',
      '989128352271',
      '9128352271',
      '00989128352271',
    ])
  })
})
