import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  conversationFindFirst: vi.fn(),
  contactFindFirst: vi.fn(),
  messageFindFirst: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: { findFirst: mocks.conversationFindFirst },
    contact: { findFirst: mocks.contactFindFirst },
    message: { findFirst: mocks.messageFindFirst },
  },
}))
vi.mock('@/lib/widget/config', () => ({
  stripProductTokens: (value: string) => value,
}))

import { GET as getLiveVersion } from '@/app/api/crm/live/route'
import { GET as getConversationMessages } from '@/app/api/conversations/[conversationId]/messages/route'

describe('GET /api/crm/live', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
  })

  it('keeps the change detector authenticated and workspace-scoped', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await getLiveVersion(
      new Request('http://localhost/api/crm/live?resource=conversations'),
    )

    expect(response.status).toBe(401)
    expect(mocks.conversationFindFirst).not.toHaveBeenCalled()
  })

  it('returns a stable latest-conversation version without list data', async () => {
    const createdAt = new Date('2026-07-18T10:00:00.000Z')
    mocks.conversationFindFirst.mockResolvedValue({
      id: 'conversation-2',
      createdAt,
    })

    const response = await getLiveVersion(
      new Request('http://localhost/api/crm/live?resource=conversations'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      version: '2026-07-18T10:00:00.000Z:conversation-2',
    })
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(mocks.conversationFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true },
    })
  })

  it('uses the same workspace boundary for customer arrivals', async () => {
    mocks.contactFindFirst.mockResolvedValue(null)

    const response = await getLiveVersion(
      new Request('http://localhost/api/crm/live?resource=contacts'),
    )

    expect(await response.json()).toEqual({ version: 'empty' })
    expect(mocks.contactFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true },
    })
  })
})

describe('GET /api/conversations/:id/messages live cursor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
  })

  it('uses createdAt and id together so same-timestamp messages are not skipped', async () => {
    const cursorTime = new Date('2026-07-18T10:00:00.000Z')
    mocks.messageFindFirst.mockResolvedValue({
      id: 'message-a',
      createdAt: cursorTime,
    })
    mocks.conversationFindFirst.mockResolvedValue({
      id: 'conversation-1',
      messages: [
        {
          id: 'message-b',
          role: 'USER',
          content: 'new message',
          createdAt: cursorTime,
          contentType: 'TEXT',
          metadata: null,
        },
      ],
    })

    const response = await getConversationMessages(
      new Request(
        'http://localhost/api/conversations/conversation-1/messages?since=message-a',
      ),
      { params: Promise.resolve({ conversationId: 'conversation-1' }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.messageFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'message-a',
        conversationId: 'conversation-1',
        conversation: { workspaceId: 'workspace-1' },
      },
      select: { id: true, createdAt: true },
    })
    expect(mocks.conversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conversation-1', workspaceId: 'workspace-1' },
        select: expect.objectContaining({
          messages: expect.objectContaining({
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            where: {
              OR: [
                { createdAt: { gt: cursorTime } },
                { createdAt: cursorTime, id: { gt: 'message-a' } },
              ],
            },
          }),
        }),
      }),
    )
    expect(await response.json()).toEqual({
      messages: [
        expect.objectContaining({
          id: 'message-b',
          createdAt: '2026-07-18T10:00:00.000Z',
        }),
      ],
    })
  })
})
