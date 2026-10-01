import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildOperatorAlertKeyboard,
  parseOperatorBotCallback,
} from '@/lib/channels/operator-bot'
import { setTelegramWebhook } from '@/lib/channels/telegram'

afterEach(() => vi.unstubAllGlobals())

describe('operator Telegram inline management controls', () => {
  it('changes alert actions as the operator claims and resolves a conversation', () => {
    const initial = buildOperatorAlertKeyboard({
      appUrl: 'https://vigent.ir',
      conversationId: 'conversation-1',
      alertId: 'alert_12345678',
      state: 'open',
    }).inline_keyboard.flat()
    expect(initial.map((button) => button.callback_data)).toEqual(
      expect.arrayContaining(['a:c:alert_12345678', 'a:r:alert_12345678', 'a:w:alert_12345678', 'a:q:alert_12345678']),
    )

    const resolved = buildOperatorAlertKeyboard({
      appUrl: 'https://vigent.ir',
      conversationId: 'conversation-1',
      alertId: 'alert_12345678',
      state: 'resolved',
    }).inline_keyboard.flat()
    expect(resolved.some((button) => button.callback_data?.startsWith('a:r:'))).toBe(false)
    expect(resolved).toContainEqual(
      expect.objectContaining({ callback_data: 'a:t:alert_12345678' }),
    )
  })

  it('parses only supported, bounded callback payloads', () => {
    expect(parseOperatorBotCallback('m:health')).toEqual({ type: 'screen', screen: 'health' })
    expect(parseOperatorBotCallback('m:rep:7')).toEqual({ type: 'report', days: 7 })
    expect(parseOperatorBotCallback('ch:resume')).toEqual({ type: 'channel', action: 'resume' })
    expect(parseOperatorBotCallback('a:c:alert_12345678')).toEqual({ type: 'alert', action: 'claim', alertId: 'alert_12345678' })
    expect(parseOperatorBotCallback('a:s:alert_12345678:2')).toEqual({ type: 'send', alertId: 'alert_12345678', index: 2 })
    expect(parseOperatorBotCallback('g:y:agent_12345678')).toEqual({ type: 'agent', action: 'confirm', agentId: 'agent_12345678' })
    expect(parseOperatorBotCallback('p:daily')).toEqual({ type: 'pref', key: 'daily' })
    // Buttons on messages sent before the redesign keep working.
    expect(parseOperatorBotCallback('menu:open')).toEqual({ type: 'screen', screen: 'queue' })
    expect(parseOperatorBotCallback('alert:claim:alert_12345678')).toEqual({ type: 'alert', action: 'claim', alertId: 'alert_12345678' })
    expect(parseOperatorBotCallback('m:unknown')).toBeNull()
    expect(parseOperatorBotCallback('alert:delete:alert_12345678')).toBeNull()
    expect(parseOperatorBotCallback(`a:c:${'x'.repeat(80)}`)).toBeNull()
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
