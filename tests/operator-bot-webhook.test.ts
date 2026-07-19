import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  operatorFindMany: vi.fn(),
  operatorUpdate: vi.fn(),
  alertFindFirst: vi.fn(),
  alertUpdate: vi.fn(),
  alertFindMany: vi.fn(),
  alertCount: vi.fn(),
  routeReply: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    operatorChannel: {
      findMany: mocks.operatorFindMany,
      update: mocks.operatorUpdate,
    },
    handoffAlert: {
      findFirst: mocks.alertFindFirst,
      update: mocks.alertUpdate,
      findMany: mocks.alertFindMany,
      count: mocks.alertCount,
    },
  },
}))

vi.mock('@/lib/channels/operator-handoff', () => ({
  readOperatorBotToken: vi.fn(() => 'secret-token'),
  routeOperatorReplyFromTelegram: mocks.routeReply,
}))

vi.mock('@/lib/channels/telegram', () => ({
  TELEGRAM_BASE: 'https://api.telegram.org',
  getTelegramWebhookInfo: vi.fn(),
}))

vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))

import { POST } from '@/app/api/telegram-operator/webhook/route'

describe('operator bot webhook callbacks', () => {
  afterEach(() => vi.unstubAllGlobals())

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.operatorFindMany.mockResolvedValue([
      {
        id: 'operator-1',
        workspaceId: 'workspace-1',
        botToken: 'encrypted-token',
        operatorChatId: '42',
        botUsername: 'vigent_operator_bot',
        active: true,
        lastError: null,
      },
    ])
    mocks.alertFindFirst.mockResolvedValue({
      id: 'alert_12345678',
      conversationId: 'conversation-1',
      state: 'open',
    })
    mocks.alertUpdate.mockResolvedValue({ state: 'claimed' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  it('claims only a workspace-scoped alert for the configured operator chat', async () => {
    const response = await POST(new Request('https://vigent.ir/api/telegram-operator/webhook?token=secret-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 1,
        callback_query: {
          id: 'callback-1',
          data: 'alert:claim:alert_12345678',
          message: {
            message_id: 88,
            chat: { id: 42 },
            text: '🔔 انتقال به اپراتور',
          },
        },
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.alertFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'alert_12345678', workspaceId: 'workspace-1' },
    }))
    expect(mocks.alertUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'alert_12345678' },
      data: { state: 'claimed', claimedBy: 'telegram:42' },
    }))
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/answerCallbackQuery'),
      expect.any(Object),
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/editMessageReplyMarkup'),
      expect.any(Object),
    )
  })

  it('does not run management actions from an unconfigured chat', async () => {
    const response = await POST(new Request('https://vigent.ir/api/telegram-operator/webhook?token=secret-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 2,
        callback_query: {
          id: 'callback-2',
          data: 'alert:resolve:alert_12345678',
          message: { message_id: 89, chat: { id: 99 }, text: '🔔 انتقال به اپراتور' },
        },
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.alertFindFirst).not.toHaveBeenCalled()
    expect(mocks.alertUpdate).not.toHaveBeenCalled()
  })
})
