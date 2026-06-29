import { describe, it, expect } from 'vitest'
import { relativeTime, formatDateTime } from '@/lib/format'

describe('relativeTime', () => {
  it('reports seconds-ago for a very recent time (en)', () => {
    const out = relativeTime(new Date(Date.now() - 5000), 'en')
    expect(out).toMatch(/second|now/i)
  })
  it('reports minutes for a few minutes ago (en)', () => {
    const out = relativeTime(new Date(Date.now() - 3 * 60 * 1000), 'en')
    expect(out).toMatch(/minute/i)
  })
  it('reports hours for a few hours ago (en)', () => {
    const out = relativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000), 'en')
    expect(out).toMatch(/hour/i)
  })
  it('localizes to Persian digits for fa', () => {
    const out = relativeTime(new Date(Date.now() - 3 * 60 * 1000), 'fa')
    expect(out).toMatch(/[۰-۹]/)
  })
})

describe('formatDateTime', () => {
  it('returns a non-empty localized string', () => {
    expect(formatDateTime(new Date('2026-06-29T10:30:00Z'), 'en')).toBeTruthy()
  })
})
