import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentChannel: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      update: mocks.update,
      count: mocks.count,
    },
  },
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))
// Channel tokens are stored encrypted; identity-decrypt keeps fixtures readable.
vi.mock('@/lib/crypto', () => ({
  decrypt: (s: string) => s,
  encrypt: (s: string) => s,
}))

import { handleInstagramGlobalInbound } from '@/lib/channels/handler'

const payload = {
  entry: [
    {
      id: '17841473935194423',
      messaging: [{ recipient: { id: '17841473935194423' } }],
    },
  ],
}

function channelRow(id: string, igUserId: string, workspaceId: string) {
  return {
    id,
    config: { mode: 'OAUTH', userTokenEnc: `token-${id}`, igUserId },
    agent: {
      id: `agent-${id}`,
      active: true,
      workspaceId,
      systemPrompt: 'x',
      language: 'fa',
      model: null,
      temperature: null,
      maxTokens: null,
      fallbackMessage: null,
      handoffEnabled: false,
      handoffMessage: null,
      handoffKeywords: [],
      voiceEnabled: false,
      ttsVoice: null,
      promptConfig: null,
      roleTemplate: null,
      requireCustomerInfo: false,
      customerInfoPrompt: null,
      productAccessEnabled: false,
      orderTrackingEnabled: false,
    },
  }
}

beforeEach(() => {
  mocks.findFirst.mockReset().mockResolvedValue(null)
  mocks.findMany.mockReset().mockResolvedValue([])
  mocks.update.mockReset().mockResolvedValue({})
  mocks.count.mockReset().mockResolvedValue(0)
  mocks.captureError.mockReset()
})

describe('Instagram global webhook routing', () => {
  it('silently ignores signed stale webhooks when no routable Instagram channel exists', async () => {
    mocks.count.mockResolvedValue(0)
    mocks.findMany.mockResolvedValue([])

    await handleInstagramGlobalInbound(payload)

    expect(mocks.findFirst).toHaveBeenCalled()
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('keeps an actionable error when multiple live channels exist but none matches', async () => {
    mocks.count.mockResolvedValue(2)

    await handleInstagramGlobalInbound(payload)

    expect(mocks.captureError).toHaveBeenCalledWith(
      'webhook:INSTAGRAM:no-channel',
      expect.any(Error),
      expect.objectContaining({
        metadata: { triedIds: ['17841473935194423'] },
      }),
    )
  })

  it('refuses the single-channel fallback when an inactive/unroutable channel also exists', async () => {
    // Tenant B paused their agent (or their token stopped decrypting), so only
    // tenant A resolves. B's customer DMs must NOT land in A's workspace.
    const onlyActive = channelRow('ch-a', '111', 'ws-a')
    mocks.count.mockResolvedValue(2) // two IG channels exist in total
    mocks.findMany.mockResolvedValue([onlyActive])

    await handleInstagramGlobalInbound(payload)

    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith(
      'webhook:INSTAGRAM:no-channel',
      expect.any(Error),
      expect.objectContaining({ metadata: { triedIds: ['17841473935194423'] } }),
    )
  })

  it('routes each entry of a multi-account batch to its own tenant channel', async () => {
    const channelA = channelRow('ch-a', '111', 'ws-a')
    const channelB = channelRow('ch-b', '222', 'ws-b')
    // Indexed lookup resolves by the id in the OR clause.
    mocks.findFirst.mockImplementation(async ({ where }: { where: { OR: Array<{ config: { equals: string } }> } }) => {
      const id = where.OR[0]?.config?.equals
      if (id === '111') return channelA
      if (id === '222') return channelB
      return null
    })

    await handleInstagramGlobalInbound({
      entry: [
        { id: '111', messaging: [] },
        { id: '222', messaging: [] },
      ],
    })

    // Both tenants must process their own slice (lastInboundAt stamped per channel).
    const stampedIds = mocks.update.mock.calls.map((c) => c[0]?.where?.id).sort()
    expect(stampedIds).toEqual(['ch-a', 'ch-b'])
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('never routes by the commenter id (changes[].value.from.id) of another tenant', async () => {
    const channelA = channelRow('ch-a', '111', 'ws-a')
    const channelB = channelRow('ch-b', '222', 'ws-b')
    mocks.findFirst.mockImplementation(async ({ where }: { where: { OR: Array<{ config: { equals: string } }> } }) => {
      const id = where.OR[0]?.config?.equals
      if (id === '111') return channelA
      if (id === '222') return channelB
      return null
    })
    mocks.count.mockResolvedValue(2)
    mocks.findMany.mockResolvedValue([channelA, channelB])

    // Comment event for an UNKNOWN account ('333') where the commenter ('111')
    // happens to be tenant A's connected account id.
    await handleInstagramGlobalInbound({
      entry: [
        {
          id: '333',
          changes: [{ value: { from: { id: '111' }, media_id: 'm1' } }],
        },
      ],
    })

    // Must NOT be delivered to tenant A (or anyone) — and the error must not
    // even consider the commenter id as a routing candidate.
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith(
      'webhook:INSTAGRAM:no-channel',
      expect.any(Error),
      expect.objectContaining({ metadata: { triedIds: ['333'] } }),
    )
  })
})
