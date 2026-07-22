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
  isMessengerType: (channel: string) => ['TELEGRAM', 'BALE', 'RUBIKA', 'WHATSAPP', 'INSTAGRAM'].includes(channel),
  getAdapter: () => ({ sendText: mocks.sendText }),
}))

import { sendOutbound } from '@/lib/channels/outbound'

describe('structured outbound delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findFirst.mockResolvedValue({ config: {} })
    mocks.sendText.mockResolvedValue(undefined)
  })

  it('reports sent only after the provider accepts the message', async () => {
    await expect(sendOutbound('agent-1', 'TELEGRAM', 'chat-1', 'hello')).resolves.toEqual({ status: 'sent' })
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
})
