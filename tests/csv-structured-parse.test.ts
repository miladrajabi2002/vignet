import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/lib/knowledge/parsers'

const LARGE_CSV = [
  'نام محصول,قیمت (تومان),موجودی,رنگ',
  ...Array.from({ length: 500 }, (_, i) =>
    [`گوشی مدل ${i + 1}`, `${(i + 1) * 100_000}`, `${i % 20}`, i % 2 ? 'مشکی' : 'سفید'].join(',')),
].join('\n')

describe('parseCsv — data2prompt-style compact table indexing', () => {
  it('emits a column profile with a numeric range and low-cardinality uniques', () => {
    const text = parseCsv('نام,قیمت,رنگ\nویجت,۱۰۰,مشکی\nگجت,۲۵۰,سفید')
    expect(text).toContain('پروفایل جدول: 2 ردیف، 3 ستون')
    expect(text).toMatch(/قیمت \(عدد /)
    expect(text).toMatch(/رنگ \(مقادیر: مشکی، سفید\)/)
  })

  it('repeats field names per batch header, not per row', () => {
    const text = parseCsv('نام,قیمت\nویجت,۱۰۰\nگجت,۲۵۰')
    const headerCount = (text.match(/\[نام \| قیمت\]/g) ?? []).length
    // One profile section + value batches carry the header line, but never
    // once per row (the old format would have produced "نام:" twice + "قیمت:" twice).
    expect(text).not.toContain('نام: ویجت')
    expect(headerCount).toBeGreaterThanOrEqual(1)
  })

  it('drops fully-empty columns and rows', () => {
    const text = parseCsv('نام,خالی,قیمت\nویجت,,۱۰۰\n,,\nگجت,,۲۵۰')
    expect(text).toContain('2 ستون')
    expect(text).not.toContain('خالی')
    expect(text).not.toContain('ویجت | ۱۰۰ | ')
  })

  it('scales: 500 rows shrink to batched sections with blank-line boundaries', () => {
    const text = parseCsv(LARGE_CSV)
    const sections = text.split('\n\n')
    // Profile + ~dozens of value batches (was one huge undifferentiated text before).
    expect(sections.length).toBeGreaterThan(10)
    expect(sections.every((section) => section.length <= 1_100)).toBe(true)
    // Every row value survives exactly once.
    expect((text.match(/گوشی مدل 123/g) ?? []).length).toBe(1)
  })

  it('returns empty text for header-only or fully empty tables', () => {
    expect(parseCsv('')).toBe('')
    expect(parseCsv('نام,قیمت')).toBe('')
    expect(parseCsv('نام,قیمت\n,')).toBe('')
  })
})

describe('parseCsv — numeric profile across digit scripts', () => {
  it('reads Persian digits and thousands separators as numbers, codes as identifiers', () => {
    const text = parseCsv('نام,قیمت,کد\nالف,"1,250,000",0788\nب,۹۸۰٬۰۰۰,0912\nج,۲۵۰۰۰۰۰,0101')
    expect(text).toMatch(/قیمت \(عدد 980,000 تا 2,500,000\)/)
    expect(text).not.toMatch(/کد \(عدد/)
  })
})
