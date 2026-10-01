import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTelegramLikeAdapter } from '@/lib/channels/telegram-like'
import { rubikaAdapter } from '@/lib/channels/rubika'
import { instagramAdapter } from '@/lib/channels/instagram'
import type { CheckoutCard } from '@/lib/commerce/checkout-link'

const card: CheckoutCard = {
  code: 'A7K2Q9',
  url: 'https://shop.example/?vigent_checkout=abcdefghijklmnopqrstuvwx',
  storeHost: 'shop.example',
  items: [{ name: 'میز <آرتا>', variant: 'گردویی', quantity: 1, lineTotal: 6_900_000 }],
  shipping: { label: 'پیک تهران', cost: 80_000 },
  discount: null,
  total: 6_980_000,
  expiresAt: '',
  lang: 'fa',
}

function captureFetch(responder: (url: string) => unknown = () => ({ ok: true, result: {} })) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : {} })
    return new Response(JSON.stringify(responder(url)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('checkout cards on messenger channels', () => {
  it('Telegram: HTML-escaped cart text with one URL button carrying the amount', async () => {
    const calls = captureFetch()
    await createTelegramLikeAdapter({ channel: 'TELEGRAM', baseUrl: 'https://api.telegram.org', token: 't' }).sendCheckoutCard!('42', card)
    expect(calls[0].url).toContain('/sendMessage')
    expect(calls[0].body.text).toContain('میز &lt;آرتا&gt;')
    expect(calls[0].body.parse_mode).toBe('HTML')
    const markup = JSON.parse(String(calls[0].body.reply_markup))
    expect(markup.inline_keyboard[0][0]).toEqual({ text: '💳 پرداخت ۶٬۹۸۰٬۰۰۰ تومان', url: card.url })
  })

  it('Bale: plain text (no HTML parse mode) with the same button', async () => {
    const calls = captureFetch()
    await createTelegramLikeAdapter({ channel: 'BALE', baseUrl: 'https://tapi.bale.ai', token: 't' }).sendCheckoutCard!('42', card)
    expect(calls[0].body.parse_mode).toBeUndefined()
    expect(calls[0].body.text).toContain('میز <آرتا>')
    expect(JSON.parse(String(calls[0].body.reply_markup)).inline_keyboard[0][0].url).toBe(card.url)
  })

  it('Rubika: keyboard row with the URL button', async () => {
    const calls = captureFetch(() => ({ status: 'OK', data: {} }))
    await rubikaAdapter('t').sendCheckoutCard!('chat', card)
    const call = calls.find((item) => item.url.endsWith('/sendMessage'))!
    expect((call.body.reply_markup as { rows: Array<{ buttons: Array<{ url: string }> }> }).rows[0].buttons[0].url).toBe(card.url)
  })

  it('Instagram: button template with a web_url button inside Meta limits', async () => {
    const calls = captureFetch((url) => (url.includes('/me?') ? { username: 'shop' } : { recipient_id: '1' }))
    await instagramAdapter('IGAAtoken').sendCheckoutCard!('igsid', card)
    const send = calls.find((item) => item.url.endsWith('/me/messages'))!
    const payload = (send.body.message as { attachment: { payload: { template_type: string; text: string; buttons: Array<{ type: string; url: string; title: string }> } } }).attachment.payload
    expect(payload.template_type).toBe('button')
    expect(payload.text.length).toBeLessThanOrEqual(640)
    expect(payload.buttons[0]).toMatchObject({ type: 'web_url', url: card.url })
    expect(payload.buttons[0].title.length).toBeLessThanOrEqual(20)
  })
})
