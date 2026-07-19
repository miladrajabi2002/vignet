import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildOperatorAlertKeyboard,
  buildOperatorMenuKeyboard,
  parseOperatorBotCallback,
} from '@/lib/channels/operator-bot'
import { setTelegramWebhook } from '@/lib/channels/telegram'

afterEach(() => vi.unstubAllGlobals())

describe('operator Telegram inline management controls', () => {
  it('builds a complete glass-button management menu', () => {
    const menu = buildOperatorMenuKeyboard('https://vigent.ir/', true)
    const buttons = menu.inline_keyboard.flat()

    expect(buttons.map((button) => button.callback_data)).toEqual(
      expect.arrayContaining(['menu:open', 'menu:stats', 'menu:health', 'channel:pause', 'menu:help']),
    )
    expect(buttons.find((button) => button.url)?.url).toBe('https://vigent.ir/conversations')
  })

  it('changes alert actions as the operator claims and resolves a conversation', () => {
    const initial = buildOperatorAlertKeyboard({
      appUrl: 'https://vigent.ir',
      conversationId: 'conversation-1',
      alertId: 'alert_12345678',
      state: 'open',
    }).inline_keyboard.flat()
    expect(initial.map((button) => button.callback_data)).toEqual(
      expect.arrayContaining(['alert:claim:alert_12345678', 'alert:resolve:alert_12345678']),
    )

    const resolved = buildOperatorAlertKeyboard({
      appUrl: 'https://vigent.ir',
      conversationId: 'conversation-1',
      alertId: 'alert_12345678',
      state: 'resolved',
    }).inline_keyboard.flat()
    expect(resolved.some((button) => button.callback_data?.startsWith('alert:resolve:'))).toBe(false)
    expect(resolved).toContainEqual(
      expect.objectContaining({ callback_data: 'alert:status:alert_12345678' }),
    )
  })

  it('parses only supported, bounded callback payloads', () => {
    expect(parseOperatorBotCallback('menu:health')).toEqual({ type: 'menu', action: 'health' })
    expect(parseOperatorBotCallback('channel:resume')).toEqual({ type: 'channel', action: 'resume' })
    expect(parseOperatorBotCallback('alert:claim:alert_12345678')).toEqual({
      type: 'alert',
      action: 'claim',
      alertId: 'alert_12345678',
    })
    expect(parseOperatorBotCallback('alert:delete:alert_12345678')).toBeNull()
    expect(parseOperatorBotCallback(`alert:claim:${'x'.repeat(80)}`)).toBeNull()
  })

  it('registers callback_query updates on the Telegram webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(setTelegramWebhook('token', 'https://vigent.ir/webhook')).resolves.toBe(true)
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      allowed_updates: ['message', 'callback_query'],
    })
  })
})

describe('operator settings connection status', () => {
  it('renders the connected label in only one place', async () => {
    const source = await readFile('components/crm/operator-channel-setup.tsx', 'utf8')
    expect(source.match(/t\('connected'\)/g)).toHaveLength(1)
    expect(source).toContain('پیام آزمایشی با موفقیت به تلگرام ارسال شد.')
  })
})
