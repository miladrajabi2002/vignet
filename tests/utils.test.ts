import { describe, it, expect } from 'vitest'
import { cn, generateSlug } from '@/lib/utils'

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
