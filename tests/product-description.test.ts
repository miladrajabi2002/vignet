/**
 * Tests for the product description HTML helpers in lib/products/description.ts.
 *
 * These helpers are shared between the dashboard's product detail page and
 * the Instagram automation engine's product card subtitle. Both surfaces must
 * strip the same HTML patterns (notably `<ul><li>…</li></ul>` blocks that
 * WooCommerce merchants put inside product descriptions) so the dashboard
 * doesn't show raw tags and Instagram's Generic Template subtitle doesn't get
 * rejected (Meta does not render HTML inside template subtitles).
 */
import { describe, expect, it } from 'vitest'
import {
  extractListItems,
  stripListBlocks,
  cleanDescriptionForChat,
  normalizeAttributes,
  formatAttrValue,
} from '@/lib/products/description'
import { buildProductText } from '@/lib/products/catalog'

describe('extractListItems', () => {
  it('returns [] when the description has no <li> tags', () => {
    expect(extractListItems('just a plain description')).toEqual([])
  })

  it('returns [] when the description is empty', () => {
    expect(extractListItems('')).toEqual([])
  })

  it('extracts label: value pairs split on ASCII colon', () => {
    const html = '<ul><li>جنس: پنبه‌ای</li><li>سایزبندی: فری سایز</li></ul>'
    expect(extractListItems(html)).toEqual([
      { label: 'جنس', value: 'پنبه‌ای' },
      { label: 'سایزبندی', value: 'فری سایز' },
    ])
  })

  it('extracts label: value pairs split on Persian colon', () => {
    const html = '<ul><li>جنس：پنبه‌ای</li></ul>'
    expect(extractListItems(html)).toEqual([{ label: 'جنس', value: 'پنبه‌ای' }])
  })

  it('handles items without a colon as label-only rows', () => {
    const html = '<ul><li>ضدآب</li><li>سبک</li></ul>'
    expect(extractListItems(html)).toEqual([
      { label: 'ضدآب', value: '' },
      { label: 'سبک', value: '' },
    ])
  })

  it('strips nested HTML tags inside <li>', () => {
    const html = '<ul><li>جنس: <strong>پنبه‌ای</strong></li></ul>'
    expect(extractListItems(html)).toEqual([{ label: 'جنس', value: 'پنبه‌ای' }])
  })

  it('decodes HTML entities', () => {
    const html = '<ul><li>توضیح: a &amp; b &lt;tag&gt;</li></ul>'
    expect(extractListItems(html)).toEqual([{ label: 'توضیح', value: 'a & b <tag>' }])
  })
})

describe('stripListBlocks', () => {
  it('returns empty string for empty input', () => {
    expect(stripListBlocks('')).toBe('')
  })

  it('removes <ul>…</ul> blocks entirely', () => {
    const html = 'intro text <ul><li>جنس: پنبه‌ای</li></ul> tail'
    expect(stripListBlocks(html)).toBe('intro text  tail')
  })

  it('strips other HTML tags', () => {
    const html = '<p>hello</p><br/><b>world</b>'
    expect(stripListBlocks(html)).toBe('helloworld')
  })

  it('decodes HTML entities', () => {
    expect(stripListBlocks('a &amp; b')).toBe('a & b')
    expect(stripListBlocks('x &nbsp; y')).toBe('x   y')
  })
})

describe('cleanDescriptionForChat', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(cleanDescriptionForChat(null)).toBe('')
    expect(cleanDescriptionForChat(undefined)).toBe('')
    expect(cleanDescriptionForChat('')).toBe('')
  })

  it('returns plain text unchanged when short enough', () => {
    expect(cleanDescriptionForChat('یک توضیح کوتاه')).toBe('یک توضیح کوتاه')
  })

  it('strips HTML tags', () => {
    expect(cleanDescriptionForChat('<p>hello</p>')).toBe('hello')
  })

  it('merges list-item text into the cleaned description', () => {
    const html = '<p>معرفی محصول</p><ul><li>جنس: پنبه‌ای</li><li>سایز: فری</li></ul>'
    const out = cleanDescriptionForChat(html)
    expect(out).toContain('معرفی محصول')
    expect(out).toContain('جنس: پنبه‌ای')
    expect(out).toContain('سایز: فری')
  })

  it('truncates to the given max length on a word boundary', () => {
    const long = 'این یک توضیح خیلی طولانی است که باید کوتاه شود'
    const out = cleanDescriptionForChat(long, 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('normalizeAttributes', () => {
  it('returns [] for non-object input', () => {
    expect(normalizeAttributes(null)).toEqual([])
    expect(normalizeAttributes(undefined)).toEqual([])
    expect(normalizeAttributes('string')).toEqual([])
  })

  it('handles the flat object shape { key: value }', () => {
    expect(normalizeAttributes({ color: 'blue', size: 'XL' })).toEqual([
      { label: 'color', value: 'blue' },
      { label: 'size', value: 'XL' },
    ])
  })

  it('handles the WC REST array shape [{ name, options }]', () => {
    const input = [{ name: 'رنگ', options: ['آبی', 'قرمز'] }]
    expect(normalizeAttributes(input)).toEqual([
      { label: 'رنگ', value: 'آبی، قرمز' },
    ])
  })

  it('handles the webhook nested-object shape { key: { name, options } }', () => {
    const input = { color: { name: 'رنگ', options: ['blue'] } }
    expect(normalizeAttributes(input)).toEqual([
      { label: 'رنگ', value: 'blue' },
    ])
  })

  it('handles multi-value arrays', () => {
    const input = { color: ['blue', 'red'] }
    expect(normalizeAttributes(input)).toEqual([
      { label: 'color', value: 'blue، red' },
    ])
  })

  it('never renders [object Object]', () => {
    const input = { weird: { foo: 'bar' } }
    const out = normalizeAttributes(input)
    // Either the row is skipped (preferred) or, if included, its value must
    // never be the literal string "[object Object]".
    for (const row of out) {
      expect(row.value).not.toContain('[object Object]')
    }
  })
})

describe('formatAttrValue', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatAttrValue(null)).toBe('')
    expect(formatAttrValue(undefined)).toBe('')
  })

  it('joins arrays with Persian comma', () => {
    expect(formatAttrValue(['a', 'b', 'c'])).toBe('a، b، c')
  })

  it('prefers .name for objects, then .options, then .value', () => {
    expect(formatAttrValue({ name: 'نام' })).toBe('نام')
    expect(formatAttrValue({ options: ['x', 'y'] })).toBe('x، y')
    expect(formatAttrValue({ value: 'v' })).toBe('v')
  })

  it('returns stringified JSON for unrecognized object shapes (avoids [object Object])', () => {
    expect(formatAttrValue({ random: 1 })).toBe('{"random":1}')
  })

  it('returns String(v) for primitives', () => {
    expect(formatAttrValue(42)).toBe('42')
    expect(formatAttrValue('hello')).toBe('hello')
  })
})

describe('catalog embedding text', () => {
  it('keeps WooCommerce list specifications as searchable plain text', () => {
    const text = buildProductText({
      id: 'product-1',
      workspaceId: 'workspace-1',
      name: 'مانتو آزاد',
      description: '<p>معرفی</p><ul><li>جنس کار: بابوس</li><li>سایزبندی: ۴۲ تا ۴۸</li></ul>',
      price: 1_000_000,
      comparePrice: null,
      sku: null,
      stock: 2,
      tags: [],
      attributes: null,
      category: { name: 'مانتو' },
    })

    expect(text).toContain('جنس کار: بابوس')
    expect(text).toContain('سایزبندی: ۴۲ تا ۴۸')
    expect(text).not.toContain('<li>')
  })
})
