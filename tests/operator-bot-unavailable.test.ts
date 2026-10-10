import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  operatorUpdate: vi.fn(),
  notificationCreate: vi.fn(),
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    operatorChannel: { findUnique: mocks.findUnique, update: mocks.operatorUpdate },
    notification: { create: mocks.notificationCreate },
  },
}))
vi.mock('@/lib/crypto', () => ({ decrypt: () => 'bot-token' }))
vi.mock('@/lib/queue/jobs', () => ({ dispatchNotification: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({
  captureError: mocks.captureError,
  captureWarning: mocks.captureWarning,
}))

import { notifyWorkspace } from '@/lib/notifications/create'
import { OperatorBotUnavailableError } from '@/lib/notifications/operator-telegram'

const notice = { workspaceId: 'workspace-1', type: 'CHANNEL_DOWN' as const, title: 'عنوان', operatorTelegram: true }

describe('manager bot alerts when the bot itself is unusable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue({
      id: 'operator-1',
      botToken: 'encrypted',
      operatorChatId: '42',
      active: true,
      prefs: null,
      lastError: null,
    })
    mocks.operatorUpdate.mockResolvedValue({})
    mocks.notificationCreate.mockResolvedValue({})
  })

  afterEach(() => vi.unstubAllGlobals())

  it('records a revoked bot token as a warning and shows it on the bot settings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"ok":false,"error_code":401,"description":"Unauthorized"}', { status: 401 }),
    ))

    await notifyWorkspace(notice)

    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1)
    expect(mocks.captureError).not.toHaveBeenCalled()
    expect(mocks.captureWarning).toHaveBeenCalledWith(
      'notify:operator-bot-unavailable',
      expect.any(OperatorBotUnavailableError),
      { workspaceId: 'workspace-1' },
    )
    expect(mocks.operatorUpdate).toHaveBeenCalledWith({
      where: { id: 'operator-1' },
      data: { lastError: expect.stringContaining('Telegram 401') },
    })
  })

  it('still reports a Telegram outage as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 })))

    await notifyWorkspace(notice)

    expect(mocks.captureWarning).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith('notify:operator-telegram', expect.any(Error), { workspaceId: 'workspace-1' })
    expect(mocks.operatorUpdate).not.toHaveBeenCalled()
  })
})
