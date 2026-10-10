/**
 * The rule the scenario form and the engine share: is this comment→DM reply
 * the ONE message Instagram allows to a commenter outside the 24-hour window,
 * or does it need the opening button message first?
 */
import { describe, expect, it } from 'vitest'
import { fitsOnePrivateReply, IG_BUTTON_TEXT_LIMIT, IG_SINGLE_TEXT_LIMIT } from '@/lib/instagram/comment-opener'
import { readOutboundReceipt, sanitizeOutboundParts } from '@/lib/conversations/outbound-receipt'

describe('fitsOnePrivateReply', () => {
  it('accepts one short text and one key message', () => {
    expect(fitsOnePrivateReply([{ type: 'TEXT', text: 'سلام' }])).toBe(true)
    expect(fitsOnePrivateReply([{ type: 'QUICK_REPLY', text: 'انتخاب کن' }])).toBe(true)
  })

  it('rejects media, product cards and anything in two parts', () => {
    expect(fitsOnePrivateReply([{ type: 'IMAGE' }])).toBe(false)
    expect(fitsOnePrivateReply([{ type: 'VIDEO' }])).toBe(false)
    expect(fitsOnePrivateReply([{ type: 'AUDIO' }])).toBe(false)
    expect(fitsOnePrivateReply([{ type: 'PRODUCT' }])).toBe(false)
    expect(fitsOnePrivateReply([{ type: 'PRODUCT_LIST' }])).toBe(false)
    expect(fitsOnePrivateReply([{ type: 'TEXT', text: 'a' }, { type: 'TEXT', text: 'b' }])).toBe(false)
    expect(fitsOnePrivateReply([])).toBe(false)
  })

  it('rejects a text the adapter would split into several messages', () => {
    expect(fitsOnePrivateReply([{ type: 'TEXT', text: 'ا'.repeat(IG_SINGLE_TEXT_LIMIT) }])).toBe(true)
    expect(fitsOnePrivateReply([{ type: 'TEXT', text: 'ا'.repeat(IG_SINGLE_TEXT_LIMIT + 1) }])).toBe(false)
    expect(fitsOnePrivateReply([{ type: 'QUICK_REPLY', text: 'ا'.repeat(IG_BUTTON_TEXT_LIMIT + 1) }])).toBe(false)
  })
})

describe('scenario receipt metadata', () => {
  it('reads the ordered parts and the scenario', () => {
    const receipt = readOutboundReceipt({
      vigentoOutbound: {
        scenario: { id: 'auto-1', name: 'قیمت', type: 'COMMENT' },
        parts: [
          { kind: 'buttons', role: 'opener', text: 'بزن', buttons: [{ title: 'مشاهده' }] },
          { kind: 'media', media: 'photo', mediaUrl: 'https://cdn.example.com/a.jpg' },
          { kind: 'products' },
          { kind: 'text', via: 'comment', text: 'تو دایرکت فرستادم' },
        ],
      },
    })
    expect(receipt?.scenario).toEqual({ id: 'auto-1', name: 'قیمت', type: 'COMMENT' })
    expect(receipt?.parts.map((part) => part.kind)).toEqual(['buttons', 'media', 'products', 'text'])
  })

  it('returns null for an ordinary reply and for older media-only receipts', () => {
    expect(readOutboundReceipt(null)).toBeNull()
    expect(readOutboundReceipt({ turnCost: {} })).toBeNull()
    expect(readOutboundReceipt({ vigentoOutbound: { media: [{ kind: 'photo', mediaUrl: 'https://x/a.jpg' }] } })).toBeNull()
  })

  it('drops malformed parts and never keeps a non-https link', () => {
    const parts = sanitizeOutboundParts([
      { kind: 'text', text: '' },
      { kind: 'media', media: 'photo', mediaUrl: 'javascript:alert(1)' },
      { kind: 'buttons', text: 'x', buttons: [{ title: 'خرید', url: 'javascript:alert(1)' }, { title: '' }] },
      { kind: 'nope' } as never,
    ])
    expect(parts).toEqual([
      { kind: 'media', media: 'photo' },
      { kind: 'buttons', text: 'x', buttons: [{ title: 'خرید' }] },
    ])
  })
})
