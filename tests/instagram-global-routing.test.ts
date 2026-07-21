import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentChannel: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))

import { handleInstagramGlobalInbound } from '@/lib/channels/handler'

const payload = {
  entry: [
    {
      id: '17841473935194423',
      messaging: [{ recipient: { id: '17841473935194423' } }],
    },
  ],
}

beforeEach(() => {
  mocks.findFirst.mockReset().mockResolvedValue(null)
  mocks.findMany.mockReset()
  mocks.captureError.mockReset()
})

describe('Instagram global webhook routing', () => {
  it('silently ignores signed stale webhooks when no routable Instagram channel exists', async () => {
    mocks.findMany.mockResolvedValue([])

    await handleInstagramGlobalInbound(payload)

    expect(mocks.findFirst).toHaveBeenCalled()
    expect(mocks.findMany).toHaveBeenCalled()
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('keeps an actionable error when multiple live channels exist but none matches', async () => {
    const channels = [
      { id: 'channel-1', config: { igUserId: 'other-1' }, agent: { active: true } },
      { id: 'channel-2', config: { igUserId: 'other-2' }, agent: { active: true } },
    ]
    mocks.findMany.mockResolvedValue(channels)

    await handleInstagramGlobalInbound(payload)

    expect(mocks.captureError).toHaveBeenCalledWith(
      'webhook:INSTAGRAM:no-channel',
      expect.any(Error),
      expect.objectContaining({
        metadata: { triedIds: ['17841473935194423'] },
      }),
    )
  })
})
