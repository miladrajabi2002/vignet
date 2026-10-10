/**
 * The inbox draws a scenario reply part by part: the Direct text, the button
 * message with its buttons, media, the product rail where the cards were
 * sent, and the public reply under the comment — under the scenario's name.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScenarioReceiptView } from '@/components/crm/scenario-receipt'
import { readOutboundReceipt } from '@/lib/conversations/outbound-receipt'

function render(parts: unknown[], rail = false) {
  const receipt = readOutboundReceipt({
    vigentoOutbound: { scenario: { id: 'auto-1', name: 'قیمت', type: 'COMMENT' }, parts },
  })
  if (!receipt) throw new Error('receipt did not parse')
  return renderToStaticMarkup(
    createElement(ScenarioReceiptView, {
      receipt,
      locale: 'fa',
      dateLabel: 'TIME',
      productRail: rail ? createElement('div', null, 'RAIL') : undefined,
    }),
  )
}

/** Visible text in document order. */
function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('ScenarioReceiptView', () => {
  it('names the scenario and keeps the Direct and the comment reply apart', () => {
    const text = textOf(render([
      { kind: 'text', text: 'بهای محصول ارسال شد' },
      { kind: 'text', via: 'comment', text: 'تو دایرکت فرستادم 🌟' },
    ]))
    expect(text).toContain('سناریوی کامنت · قیمت')
    expect(text).toContain('پاسخ عمومی زیر کامنت تو دایرکت فرستادم 🌟')
    expect(text.indexOf('بهای محصول ارسال شد')).toBeLessThan(text.indexOf('پاسخ عمومی زیر کامنت'))
    expect(text.endsWith('TIME')).toBe(true)
  })

  it('shows button messages with their buttons and why they were sent', () => {
    const html = render([
      { kind: 'buttons', role: 'opener', text: 'برای دریافت بزنید', buttons: [{ title: 'مشاهده' }] },
      { kind: 'buttons', role: 'follow_gate', text: 'اول فالو کن', buttons: [{ title: 'فالو کردم' }] },
      { kind: 'buttons', text: 'لینک خرید', buttons: [{ title: 'خرید', url: 'https://example.com/p/1' }] },
      { kind: 'buttons', text: 'انتخاب کن', buttons: [{ title: 'الف' }, { title: 'ب' }], style: 'chips' },
    ])
    const text = textOf(html)
    expect(text).toContain('پیام شروع')
    expect(text).toContain('برای دریافت بزنید مشاهده')
    expect(text).toContain('درخواست فالو اول فالو کن فالو کردم')
    expect(html).toContain('href="https://example.com/p/1"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
    expect(text).toContain('انتخاب کن الف ب')
  })

  it('draws the product rail where the cards were sent, exactly once', () => {
    const text = textOf(render([
      { kind: 'text', text: 'قبل' },
      { kind: 'products' },
      { kind: 'products' },
      { kind: 'text', text: 'بعد' },
    ], true))
    expect(text.match(/RAIL/g)).toHaveLength(1)
    expect(text.indexOf('قبل')).toBeLessThan(text.indexOf('RAIL'))
    expect(text.indexOf('RAIL')).toBeLessThan(text.indexOf('بعد'))
  })

  it('still shows the rail when an older receipt has no products part', () => {
    expect(textOf(render([{ kind: 'text', text: 'متن' }], true))).toContain('RAIL')
  })

  it('renders media with its caption and a note when the link was not kept', () => {
    const html = render([
      { kind: 'media', media: 'photo', mediaUrl: 'https://cdn.example.com/a.jpg', caption: 'کپشن عکس' },
      { kind: 'media', media: 'audio' },
    ])
    expect(html).toContain('https://cdn.example.com/a.jpg')
    expect(textOf(html)).toContain('کپشن عکس')
    expect(textOf(html)).toContain('پیام صوتی ارسال شد')
  })
})
