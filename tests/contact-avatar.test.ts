import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  contactFindFirst: vi.fn(),
  contactUpdateMany: vi.fn(),
  agentChannelFindMany: vi.fn(),
  fetchInstagramSenderProfile: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      findFirst: mocks.contactFindFirst,
      updateMany: mocks.contactUpdateMany,
    },
    agentChannel: { findMany: mocks.agentChannelFindMany },
  },
}))
vi.mock('@/lib/instagram/sender-profile', () => ({
  fetchInstagramSenderProfile: mocks.fetchInstagramSenderProfile,
}))

import { GET } from '@/app/api/contacts/[contactId]/avatar/route'
import { isTrustedInstagramAvatarUrl } from '@/lib/crm/avatar-proxy'
import { contactAvatarSrc } from '@/lib/crm/avatar'

const params = { params: Promise.resolve({ contactId: 'contact-1' }) }

function imageResponse() {
  return new Response(Uint8Array.from([137, 80, 78, 71]), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Content-Length': '4' },
  })
}

describe('Instagram CRM avatar proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.contactUpdateMany.mockResolvedValue({ count: 1 })
    mocks.agentChannelFindMany.mockResolvedValue([])
  })

  it('accepts only HTTPS URLs on Meta-controlled image hosts', () => {
    expect(
      isTrustedInstagramAvatarUrl(
        'https://scontent.cdninstagram.com/v/avatar.jpg?sig=short-lived',
      ),
    ).toBe(true)
    expect(
      isTrustedInstagramAvatarUrl(
        'https://instagram.fsin1-1.fna.fbcdn.net/v/avatar.jpg',
      ),
    ).toBe(true)
    expect(isTrustedInstagramAvatarUrl('http://127.0.0.1/avatar.jpg')).toBe(false)
    expect(
      isTrustedInstagramAvatarUrl('https://fbcdn.net.attacker.example/avatar.jpg'),
    ).toBe(false)
  })

  it('routes an Instagram identity through refresh even before an avatar URL is stored', () => {
    expect(
      contactAvatarSrc({
        contactId: 'contact-1',
        channel: 'INSTAGRAM',
        rawUrl: null,
      }),
    ).toBe('/api/contacts/contact-1/avatar?channel=INSTAGRAM')
  })

  it('is authenticated and never reads another workspace contact', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(
      new Request(
        'http://localhost/api/contacts/contact-1/avatar?channel=INSTAGRAM',
      ),
      params,
    )

    expect(response.status).toBe(401)
    expect(mocks.contactFindFirst).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('proxies a valid stored image without exposing its signed URL', async () => {
    const signedUrl = 'https://scontent.cdninstagram.com/v/current.jpg?sig=abc'
    mocks.contactFindFirst.mockResolvedValue({
      id: 'contact-1',
      instagramId: 'ig-scoped-1',
      instagramAvatarUrl: signedUrl,
      conversations: [],
    })
    const fetchMock = vi.fn().mockResolvedValue(imageResponse())
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(
      new Request(
        'http://localhost/api/contacts/contact-1/avatar?channel=INSTAGRAM',
      ),
      params,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toContain('private')
    expect(mocks.contactFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact-1', workspaceId: 'workspace-1' },
      }),
    )
    expect(mocks.agentChannelFindMany).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(signedUrl),
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('refreshes and stores a verified profile URL after the old signature expires', async () => {
    const staleUrl = 'https://scontent.cdninstagram.com/v/stale.jpg?sig=old'
    const freshUrl = 'https://scontent.cdninstagram.com/v/fresh.jpg?sig=new'
    mocks.contactFindFirst.mockResolvedValue({
      id: 'contact-1',
      instagramId: 'ig-scoped-1',
      instagramAvatarUrl: staleUrl,
      conversations: [{ agentId: 'agent-related' }],
    })
    mocks.agentChannelFindMany.mockResolvedValue([
      { agentId: 'agent-fallback', config: { token: 'encrypted-a' } },
      { agentId: 'agent-related', config: { token: 'encrypted-b' } },
    ])
    mocks.fetchInstagramSenderProfile.mockResolvedValue({
      username: 'customer',
      avatarUrl: freshUrl,
    })
    const fetchMock = vi.fn().mockImplementation((input: URL) =>
      Promise.resolve(
        input.toString() === staleUrl
          ? new Response('', { status: 403 })
          : imageResponse(),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(
      new Request(
        'http://localhost/api/contacts/contact-1/avatar?channel=INSTAGRAM',
      ),
      params,
    )

    expect(response.status).toBe(200)
    expect(mocks.fetchInstagramSenderProfile).toHaveBeenCalledWith(
      { token: 'encrypted-b' },
      'ig-scoped-1',
    )
    expect(mocks.contactUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'contact-1',
        workspaceId: 'workspace-1',
        instagramId: 'ig-scoped-1',
      },
      data: {
        instagramAvatarUrl: freshUrl,
        instagramUsername: 'customer',
      },
    })
  })

  it('backfills an Instagram avatar when the contact only has a scoped user ID', async () => {
    const freshUrl = 'https://scontent.cdninstagram.com/v/backfilled.jpg?sig=new'
    mocks.contactFindFirst.mockResolvedValue({
      id: 'contact-1',
      instagramId: 'ig-scoped-1',
      instagramAvatarUrl: null,
      conversations: [{ agentId: 'agent-related' }],
    })
    mocks.agentChannelFindMany.mockResolvedValue([
      { agentId: 'agent-related', config: { token: 'encrypted-b' } },
    ])
    mocks.fetchInstagramSenderProfile.mockResolvedValue({ avatarUrl: freshUrl })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(imageResponse()))

    const response = await GET(
      new Request(
        'http://localhost/api/contacts/contact-1/avatar?channel=INSTAGRAM',
      ),
      params,
    )

    expect(response.status).toBe(200)
    expect(mocks.fetchInstagramSenderProfile).toHaveBeenCalledWith(
      { token: 'encrypted-b' },
      'ig-scoped-1',
    )
    expect(mocks.contactUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { instagramAvatarUrl: freshUrl },
      }),
    )
  })

  it('never fetches an untrusted stored URL', async () => {
    mocks.contactFindFirst.mockResolvedValue({
      id: 'contact-1',
      instagramId: null,
      instagramAvatarUrl: 'http://127.0.0.1/internal',
      conversations: [],
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(
      new Request(
        'http://localhost/api/contacts/contact-1/avatar?channel=INSTAGRAM',
      ),
      params,
    )

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
