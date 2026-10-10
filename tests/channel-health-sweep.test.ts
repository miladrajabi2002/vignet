import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  redis: { incr: vi.fn(), expire: vi.fn(), del: vi.fn(), set: vi.fn() },
  captureError: vi.fn(),
  captureWarning: vi.fn(),
  notifyWorkspace: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { agentChannel: { findMany: mocks.findMany, update: mocks.update } },
}))
vi.mock('@/lib/redis', () => ({ getRedis: () => mocks.redis }))
vi.mock('@/lib/errors/capture', () => ({
  captureError: mocks.captureError,
  captureWarning: mocks.captureWarning,
}))
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: mocks.notifyWorkspace }))
vi.mock('@/lib/channels/config', () => ({ readBotToken: () => 'bot-token' }))
vi.mock('@/lib/channels/telegram', () => ({ TELEGRAM_BASE: 'https://telegram.test' }))
vi.mock('@/lib/channels/bale', () => ({ BALE_BASE: 'https://bale.test' }))
vi.mock('@/lib/channels/rubika', () => ({ getRubikaBotInfo: vi.fn() }))
vi.mock('@/lib/channels/instagram', () => ({ getInstagramInfo: vi.fn() }))

import { sweepChannelHealth } from '@/lib/channels/health'

const channel = {
  id: 'channel-1',
  type: 'TELEGRAM',
  config: {},
  healthStatus: 'ok',
  healthAlertedAt: null,
  agent: { id: 'agent-1', name: 'فروشنده', workspaceId: 'workspace-1' },
}

/** Answer the Telegram probe one way and the SMS proxy probe as healthy. */
function stubFetch(telegram: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    String(url).startsWith('https://telegram.test') ? telegram() : Promise.resolve(new Response(null, { status: 200 })),
  ))
}

describe('channel health sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('IPPANEL_PROXY_URL', 'https://sms-proxy.test')
    mocks.findMany.mockResolvedValue([channel])
    mocks.update.mockResolvedValue({})
    mocks.redis.incr.mockResolvedValue(1)
    mocks.redis.expire.mockResolvedValue(1)
    mocks.redis.del.mockResolvedValue(1)
    mocks.redis.set.mockResolvedValue('OK')
    mocks.notifyWorkspace.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('tells the owner in plain language when the token is rejected, without logging a platform error', async () => {
    stubFetch(async () => new Response(JSON.stringify({ ok: false, error_code: 401 }), { status: 401 }))

    const stats = await sweepChannelHealth()

    expect(stats).toMatchObject({ checked: 1, down: 1, unreachable: 0, disabled: 0, notified: 1 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ healthStatus: 'down', healthError: 'TOKEN_REJECTED' }),
    }))
    const notice = mocks.notifyWorkspace.mock.calls[0][0]
    expect(notice.title).toBe('اتصال تلگرام «فروشنده» قطع شده است')
    expect(notice.body).toContain('توکن این ربات را دیگر قبول نمی‌کند')
    expect(notice.body).not.toMatch(/[A-Za-z]{4,}/)
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('auto-disables after the third rejected check and records a warning, not an error', async () => {
    stubFetch(async () => new Response('{}', { status: 401 }))
    mocks.findMany.mockResolvedValue([{ ...channel, healthStatus: 'down' }])
    mocks.redis.incr.mockResolvedValue(3)

    const stats = await sweepChannelHealth()

    expect(stats).toMatchObject({ down: 1, disabled: 1 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ active: false, healthStatus: 'down' }),
    }))
    expect(mocks.update.mock.calls[0][0].data.healthError).toMatch(/^TOKEN_REJECTED/)
    expect(mocks.captureWarning).toHaveBeenCalledWith(
      'channel-health:customer-disconnected',
      expect.stringContaining('خطای سیستم نیست'),
      expect.objectContaining({ workspaceId: 'workspace-1' }),
    )
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('treats an unreachable provider as our signal: no disable, no owner notice, one error', async () => {
    stubFetch(async () => {
      throw new Error('fetch failed')
    })

    const stats = await sweepChannelHealth()

    expect(stats).toMatchObject({ down: 0, unreachable: 1, disabled: 0, notified: 0 })
    expect(mocks.redis.incr).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ healthStatus: 'degraded', healthError: 'UNREACHABLE: fetch failed' }),
    }))
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('active')
    expect(mocks.notifyWorkspace).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith('channel-health:sweep', expect.any(Error), {})
  })
})
