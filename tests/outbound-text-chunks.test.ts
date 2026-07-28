import { describe, expect, it } from 'vitest'
import { splitOutboundText } from '@/lib/channels/text-chunks'

describe('outbound text splitting', () => {
  it('keeps every part within the platform limit and preserves the full text', () => {
    const text = Array.from({ length: 80 }, (_, i) => `بند ${i + 1}: توضیح سفارش مشتری.`).join('\n')
    const chunks = splitOutboundText(text, 180)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 180)).toBe(true)
    expect(chunks.join('\n').replace(/\s+/g, ' ').trim()).toBe(
      text.replace(/\s+/g, ' ').trim(),
    )
  })

  it('never splits an emoji surrogate pair', () => {
    const chunks = splitOutboundText(`شروع ${'الف'.repeat(35)} 🚀 پایان`, 40)
    expect(chunks.join(' ')).toContain('🚀')
    expect(chunks.some((chunk) => /[\uD800-\uDBFF]$/.test(chunk))).toBe(false)
    expect(chunks.some((chunk) => /^[\uDC00-\uDFFF]/.test(chunk))).toBe(false)
  })
})
