import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
})

describe('messenger config', () => {
  it('round-trips the bot token through encryption', async () => {
    const { buildMessengerConfig, readBotToken } = await import('@/lib/channels/config')
    const cfg = buildMessengerConfig('123456:ABCDEF', 'mybot')
    expect(cfg.botUsername).toBe('mybot')
    expect(cfg.webhookToken).toMatch(/^[\w-]+$/)
    expect(cfg.botTokenEnc).not.toContain('123456')
    expect(readBotToken(cfg as never)).toBe('123456:ABCDEF')
  })

  it('returns null when reading a token from empty config', async () => {
    const { readBotToken } = await import('@/lib/channels/config')
    expect(readBotToken(null as never)).toBeNull()
    expect(readBotToken({} as never)).toBeNull()
  })

  it('produces a safe last-chars hint', async () => {
    const { botTokenHint } = await import('@/lib/channels/config')
    expect(botTokenHint('123456:ABCDEF')).toBe('…ABCDEF')
    expect(botTokenHint('short')).toBe('••••')
  })

  it('generates unique webhook tokens', async () => {
    const { newWebhookToken } = await import('@/lib/channels/config')
    expect(newWebhookToken()).not.toBe(newWebhookToken())
  })
})
