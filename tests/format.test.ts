import { describe, it, expect } from 'vitest'
import { relativeTime, formatDateTime } from '@/lib/format'
import {
  calendarPartsFromDateKey,
  dateKeyFromCalendarParts,
  formatLocalizedDate,
  formatDateKey,
} from '@/lib/localized-date'

describe('relativeTime', () => {
  it('reports seconds-ago for a very recent time (en)', () => {
    const out = relativeTime(new Date(Date.now() - 5000), 'en')
    expect(out).toMatch(/second|now/i)
  })
  it('reports minutes for a few minutes ago (en)', () => {
    const out = relativeTime(new Date(Date.now() - 3 * 60 * 1000), 'en')
    expect(out).toMatch(/minute/i)
  })
  it('accepts an ISO date after a cached value is JSON-serialized', () => {
    const serialized = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    expect(relativeTime(serialized, 'en')).toMatch(/minute/i)
  })
  it('fails safely for an invalid serialized date', () => {
    expect(relativeTime('not-a-date', 'en')).toBe('')
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

  it('uses the Persian calendar only for the Persian locale', () => {
    const date = new Date('2026-03-21T10:30:00Z')
    expect(formatLocalizedDate(date, 'fa')).toContain('۱۴۰۵')
    expect(formatLocalizedDate(date, 'en')).toContain('2026')
    expect(formatDateKey('2026-03-21', 'fa')).toContain('۱۴۰۵')
    expect(formatDateKey('2026-03-21', 'en')).toContain('2026')
  })

  it('converts between the Jalali calendar UI and Gregorian storage keys', () => {
    expect(calendarPartsFromDateKey('2026-03-21', 'fa')).toEqual({ year: 1405, month: 1, day: 1 })
    expect(dateKeyFromCalendarParts(1405, 1, 1, 'fa')).toBe('2026-03-21')
    expect(calendarPartsFromDateKey('2026-03-21', 'en')).toEqual({ year: 2026, month: 3, day: 21 })
  })
})
