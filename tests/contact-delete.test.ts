import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  contactFindFirst: vi.fn(),
  transaction: vi.fn(),
  conversationUpdateMany: vi.fn(),
  contactDeleteMany: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: { findFirst: mocks.contactFindFirst },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET } from '@/app/api/contacts/[contactId]/route'

const params = { params: Promise.resolve({ contactId: 'contact-1' }) }

describe('GET /api/contacts/:contactId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
  })

  it('requires authentication before returning mobile-sheet details', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await GET(
      new Request('http://localhost/api/contacts/contact-1'),
      params,
    )

    expect(response.status).toBe(401)
    expect(mocks.contactFindFirst).not.toHaveBeenCalled()
  })

  it('returns a workspace-scoped profile with channel identities and recent conversations', async () => {
    mocks.contactFindFirst.mockResolvedValue({
      id: 'contact-1',
      name: 'Customer',
      phone: '09120000000',
      stage: 'lead',
      tags: [],
      notes: null,
      marketingOptIn: false,
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      updatedAt: new Date('2026-08-02T10:00:00.000Z'),
      lastActivityAt: new Date('2026-08-02T10:00:00.000Z'),
      telegramId: null,
      telegramUsername: null,
      telegramAvatarUrl: null,
      whatsappId: null,
      whatsappName: null,
      whatsappAvatarUrl: null,
      instagramId: 'instagram-1',
      instagramUsername: 'customer',
      instagramAvatarUrl: null,
      rubikaId: null,
      rubikaUsername: null,
      rubikaAvatarUrl: null,
      baleId: null,
      baleUsername: null,
      baleAvatarUrl: null,
      conversations: [],
    })

    const response = await GET(
      new Request('http://localhost/api/contacts/contact-1'),
      params,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(mocks.contactFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact-1', workspaceId: 'workspace-1' },
        select: expect.objectContaining({
          instagramUsername: true,
          conversations: expect.objectContaining({
            take: 50,
            orderBy: { lastMessageAt: 'desc' },
          }),
        }),
      }),
    )
    expect(await response.json()).toEqual({
      contact: expect.objectContaining({
        id: 'contact-1',
        instagramUsername: 'customer',
        conversations: [],
      }),
    })
  })
})

describe('DELETE /api/contacts/:contactId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.contactFindFirst.mockResolvedValue({
      id: 'contact-1',
      marketingOptIn: false,
    })
    mocks.conversationUpdateMany.mockResolvedValue({ count: 2 })
    mocks.contactDeleteMany.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        conversation: { updateMany: mocks.conversationUpdateMany },
        contact: { deleteMany: mocks.contactDeleteMany },
      }),
    )
  })

  it('requires authentication before looking up the contact', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const response = await DELETE(
      new Request('http://localhost/api/contacts/contact-1', { method: 'DELETE' }),
      params,
    )

    expect(response.status).toBe(401)
    expect(mocks.contactFindFirst).not.toHaveBeenCalled()
  })

  it('detaches workspace conversations and preserves their messages transactionally', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/contacts/contact-1', { method: 'DELETE' }),
      params,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      preservedConversations: 2,
    })
    expect(mocks.conversationUpdateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-1', workspaceId: 'workspace-1' },
      data: { contactId: null },
    })
    expect(mocks.contactDeleteMany).toHaveBeenCalledWith({
      where: { id: 'contact-1', workspaceId: 'workspace-1' },
    })
  })

  it('returns a controlled failure when a concurrent delete wins', async () => {
    mocks.contactDeleteMany.mockResolvedValue({ count: 0 })

    const response = await DELETE(
      new Request('http://localhost/api/contacts/contact-1', { method: 'DELETE' }),
      params,
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'DELETE_FAILED' })
  })
})
