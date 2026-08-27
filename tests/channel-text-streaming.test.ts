import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTelegramLikeAdapter } from '@/lib/channels/telegram-like'
import { rubikaAdapter } from '@/lib/channels/rubika'

type RecordedCall = { url: string; body: Record<string, unknown> }

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('messenger live text streaming', () => {
  const calls: RecordedCall[] = []

  beforeEach(() => {
    calls.length = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ url, body })
      if (url.endsWith('/sendMessage')) {
        return response({ ok: true, result: { message_id: 42 }, data: { message_id: 'rubika-42' } })
      }
      return response({ ok: true, result: true })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('uses Telegram sendMessageDraft and persists one final message', async () => {
    const adapter = createTelegramLikeAdapter({
      channel: 'TELEGRAM',
      baseUrl: 'https://api.telegram.test',
      token: 'token',
    })
    const stream = adapter.startTextStream!('123')

    stream.update('سلام')
    stream.update('سلام دنیا')
    await stream.finish('سلام **دنیا**', { quickReplies: ['ادامه'] })

    expect(calls.map((call) => call.url.split('/').pop())).toEqual([
      'sendMessageDraft',
      'sendMessage',
    ])
    expect(calls[0].body).toMatchObject({ chat_id: 123, text: 'سلام', parse_mode: 'HTML' })
    expect(calls[0].body.draft_id).toEqual(expect.any(Number))
    expect(calls[1].body).toMatchObject({
      chat_id: '123',
      text: 'سلام <b>دنیا</b>',
      parse_mode: 'HTML',
    })
  })

  it('streams Bale by editing the first partial instead of duplicating it', async () => {
    vi.useFakeTimers()
    const adapter = createTelegramLikeAdapter({
      channel: 'BALE',
      baseUrl: 'https://tapi.bale.test',
      token: 'token',
    })
    const stream = adapter.startTextStream!('chat-1')

    stream.update('بخش اول')
    await vi.advanceTimersByTimeAsync(0)
    stream.update('بخش اول و دوم')
    await vi.advanceTimersByTimeAsync(1_100)
    await stream.finish('پاسخ نهایی', { quickReplies: ['بله', 'خیر'] })

    expect(calls.map((call) => call.url.split('/').pop())).toEqual([
      'sendMessage',
      'editMessageText',
      'editMessageText',
    ])
    expect(calls[1].body).toMatchObject({ message_id: 42, text: 'بخش اول و دوم' })
    expect(calls[2].body).toMatchObject({
      message_id: 42,
      text: 'پاسخ نهایی',
      reply_markup: {
        keyboard: [[{ text: 'بله' }, { text: 'خیر' }]],
      },
    })
  })

  it('uses Rubika sendMessage plus editMessageText as its streaming fallback', async () => {
    const adapter = rubikaAdapter('token')
    const stream = adapter.startTextStream!('chat-guid')

    stream.update('شروع پاسخ')
    await stream.finish('پاسخ کامل')

    expect(calls.map((call) => call.url.split('/').pop())).toEqual([
      'sendMessage',
      'editMessageText',
    ])
    expect(calls[1].body).toEqual({
      chat_id: 'chat-guid',
      message_id: 'rubika-42',
      text: 'پاسخ کامل',
    })
  })

  it('falls back to a durable final send when a preview endpoint fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ url, body })
      if (url.endsWith('/sendMessageDraft')) {
        return new Response(JSON.stringify({ ok: false }), { status: 404 })
      }
      return response({ ok: true, result: { message_id: 42 } })
    })
    const adapter = createTelegramLikeAdapter({
      channel: 'TELEGRAM',
      baseUrl: 'https://api.telegram.test',
      token: 'token',
    })
    const stream = adapter.startTextStream!('123')

    stream.update('partial')
    await stream.finish('final')

    expect(calls.map((call) => call.url.split('/').pop())).toEqual([
      'sendMessageDraft',
      'sendMessage',
    ])
    expect(calls[1].body.text).toBe('final')
  })
})
