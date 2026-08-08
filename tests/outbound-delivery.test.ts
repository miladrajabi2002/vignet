import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sendText: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { agentChannel: { findFirst: mocks.findFirst } },
}))
vi.mock('@/lib/channels/config', () => ({ readBotToken: () => 'token' }))
vi.mock('@/lib/instagram/config', () => ({ readPageToken: () => 'token' }))
vi.mock('@/lib/channels/registry', () => ({
  isMessengerType: (channel: string) => ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'].includes(channel),
  getAdapter: () => ({ sendText: mocks.sendText }),
}))

import { resolveConversationRecipient, sendOutbound } from '@/lib/channels/outbound'

describe('structured outbound delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findFirst.mockResolvedValue({ config: {} })
    mocks.sendText.mockResolvedValue(undefined)
  })

  it.each(['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'] as const)(
    'reports sent for %s only after its provider adapter accepts the message',
    async (channel) => {
      await expect(sendOutbound('agent-1', channel, 'chat-1', 'hello')).resolves.toEqual({ status: 'sent' })
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { agentId: 'agent-1', type: channel, active: true },
        select: { config: true },
      })
      expect(mocks.sendText).toHaveBeenCalledWith('chat-1', 'hello')
    },
  )

  it.each(['WEB_WIDGET', 'CHAT_LINK', 'API'] as const)(
    'treats %s conversation history as its successful delivery transport',
    async (channel) => {
      await expect(sendOutbound('agent-1', channel, null, 'hello')).resolves.toEqual({
        status: 'stored',
        reason: 'history_delivery',
      })
      expect(mocks.findFirst).not.toHaveBeenCalled()
      expect(mocks.sendText).not.toHaveBeenCalled()
    },
  )

  it('reports unavailable when a messenger recipient cannot be resolved', async () => {
    await expect(sendOutbound('agent-1', 'TELEGRAM', null, 'hello')).resolves.toEqual({
      status: 'unavailable',
      reason: 'missing_thread',
    })
    expect(mocks.sendText).not.toHaveBeenCalled()
  })

  it('reports unavailable when the active channel is missing', async () => {
    mocks.findFirst.mockResolvedValue(null)
    await expect(sendOutbound('agent-1', 'TELEGRAM', 'chat-1', 'hello')).resolves.toEqual({
      status: 'unavailable',
      reason: 'channel_inactive',
    })
  })

  it('reports provider failures without pretending delivery succeeded', async () => {
    const cause = new Error('provider down')
    mocks.sendText.mockRejectedValue(cause)
    await expect(sendOutbound('agent-1', 'TELEGRAM', 'chat-1', 'hello')).resolves.toEqual({
      status: 'failed',
      reason: 'provider_error',
      cause,
    })
  })

  it('keeps historical WhatsApp messages readable without attempting delivery', async () => {
    await expect(sendOutbound('agent-1', 'WHATSAPP', 'legacy-thread', 'hello')).resolves.toEqual({
      status: 'unavailable',
      reason: 'channel_retired',
    })
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect(mocks.sendText).not.toHaveBeenCalled()
  })

  it('does not replace recipients for other channels', () => {
    expect(resolveConversationRecipient(
      '181316641398869',
    )).toBe('181316641398869')
  })
})
