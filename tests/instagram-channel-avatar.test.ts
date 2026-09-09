import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  channelFindFirst: vi.fn(),
  fetchTrustedInstagramAvatar: vi.fn(),
  readUserToken: vi.fn(),
  getInstagramProfile: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentChannel: {
      findFirst: mocks.channelFindFirst,
    },
  },
}))
vi.mock('@/lib/crm/avatar-proxy', () => ({
  fetchTrustedInstagramAvatar: mocks.fetchTrustedInstagramAvatar,
}))
vi.mock('@/lib/instagram/config', () => ({
  readUserToken: mocks.readUserToken,
}))
vi.mock('@/lib/instagram/oauth', () => ({
  getInstagramProfile: mocks.getInstagramProfile,
}))

import { GET } from '@/app/api/agents/[agentId]/channels/[channelId]/avatar/route'

const params = {
  params: Promise.resolve({ agentId: 'agent-1', channelId: 'channel-1' }),
}

describe('connected Instagram account avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
  })

  it('requires an authenticated user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/avatar'), params)

    expect(response.status).toBe(401)
    expect(mocks.channelFindFirst).not.toHaveBeenCalled()
  })

  it('serves a valid stored CDN image without a Graph request', async () => {
    mocks.channelFindFirst.mockResolvedValue({
      id: 'channel-1',
      config: { igProfilePictureUrl: 'https://cdninstagram.com/current.jpg' },
    })
    mocks.fetchTrustedInstagramAvatar.mockResolvedValue({
      bytes: Uint8Array.from([1, 2, 3]),
      contentType: 'image/jpeg',
    })

    const response = await GET(new Request('http://localhost/avatar'), params)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(mocks.getInstagramProfile).not.toHaveBeenCalled()
    expect(mocks.channelFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'channel-1',
          agentId: 'agent-1',
          agent: { workspaceId: 'workspace-1' },
        }),
      }),
    )
  })

  it('refreshes an expired Instagram CDN URL through the Graph API', async () => {
    mocks.channelFindFirst.mockResolvedValue({
      id: 'channel-1',
      config: {
        mode: 'OAUTH',
        userTokenEnc: 'encrypted-token',
        igProfilePictureUrl: 'https://cdninstagram.com/expired.jpg',
      },
    })
    mocks.fetchTrustedInstagramAvatar
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        bytes: Uint8Array.from([4, 5, 6]),
        contentType: 'image/webp',
      })
    mocks.readUserToken.mockReturnValue('instagram-token')
    mocks.getInstagramProfile.mockResolvedValue({
      igUserId: 'ig-1',
      webhookIgId: 'native-ig-1',
      username: 'fresh_username',
      profilePictureUrl: 'https://cdninstagram.com/fresh.jpg',
    })

    const response = await GET(new Request('http://localhost/avatar'), params)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(mocks.getInstagramProfile).toHaveBeenCalledWith('instagram-token')
    expect(mocks.fetchTrustedInstagramAvatar).toHaveBeenLastCalledWith(
      'https://cdninstagram.com/fresh.jpg',
    )
  })
})
