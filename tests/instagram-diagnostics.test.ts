import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  agentFindFirst: vi.fn(),
  channelFindFirst: vi.fn(),
  channelFindMany: vi.fn(),
  channelUpdate: vi.fn(),
  getInstagramProfile: vi.fn(),
  getScopedWebhookPayloads: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findFirst: mocks.agentFindFirst },
    agentChannel: {
      findFirst: mocks.channelFindFirst,
      findMany: mocks.channelFindMany,
      update: mocks.channelUpdate,
    },
  },
}))
vi.mock('@/lib/instagram/config', () => ({
  readPageToken: () => 'token-1',
  readIgUserId: () => '38072185465760663',
}))
vi.mock('@/lib/instagram/oauth', () => ({
  subscribeIgUserToWebhook: vi.fn(),
  getIgUserWebhookSubscription: vi.fn(),
  getInstagramProfile: mocks.getInstagramProfile,
}))
vi.mock('@/lib/channels/webhook-debug', () => ({
  getScopedWebhookPayloads: mocks.getScopedWebhookPayloads,
}))

import { PUT } from '@/app/api/agents/[agentId]/channels/instagram-diagnostics/route'

beforeEach(() => {
  mocks.getCurrentUser.mockReset().mockResolvedValue({ workspaceId: 'ws-1' })
  mocks.agentFindFirst.mockReset().mockResolvedValue({
    id: 'agent-1',
    channels: [
      {
        id: 'channel-1',
        config: {
          mode: 'OAUTH',
          igUserId: '38072185465760663',
          userTokenEnc: 'encrypted',
        },
      },
    ],
  })
  mocks.channelFindFirst.mockReset().mockResolvedValue(null)
  mocks.channelFindMany.mockReset().mockResolvedValue([])
  mocks.channelUpdate.mockReset().mockResolvedValue({})
  mocks.getInstagramProfile.mockReset().mockResolvedValue({
    igUserId: '38072185465760663',
    webhookIgId: '17841401976835496',
    username: 'example',
  })
  mocks.getScopedWebhookPayloads.mockReset().mockReturnValue({
    payloads: [],
    otherTenantPayloadCount: 0,
  })
})

describe('Instagram diagnostics webhook identity repair', () => {
  it('stores user_id as webhookIgId without overwriting the Graph igUserId', async () => {
    const response = await PUT(
      new Request('http://localhost/api/diagnostics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: '17841401976835496' }),
      }),
      { params: Promise.resolve({ agentId: 'agent-1' }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.channelUpdate).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: {
        config: expect.objectContaining({
          igUserId: '38072185465760663',
          webhookIgId: '17841401976835496',
        }),
      },
    })
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      webhookIgId: '17841401976835496',
    })
  })
})
