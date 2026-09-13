import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    getCurrentUser: vi.fn(),
    findFirst: vi.fn(),
    // The DELETE handler soft-deletes via prisma.conversation.updateMany —
    // no transaction, no raw SQL: messages/history must survive so the undo
    // snackbar can restore the whole thread.
    updateMany: vi.fn(),
  }
})

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/queue/jobs', () => ({ dispatchSummary: vi.fn() }))
vi.mock('@/lib/instagram/automation', () => ({ resumeAiForConversation: vi.fn() }))

import { DELETE } from '@/app/api/conversations/[conversationId]/route'

const props = { params: Promise.resolve({ conversationId: 'conversation-1' }) }

describe('DELETE /api/conversations/:conversationId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.findFirst.mockResolvedValue({ id: 'conversation-1' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(401)
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('does not expose or delete a conversation outside the workspace', async () => {
    mocks.findFirst.mockResolvedValue(null)

    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(404)
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', workspaceId: 'workspace-1' },
      select: { id: true },
    })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('soft-deletes with a deletedAt stamp (history survives for undo) and returns the id', async () => {
    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledTimes(1)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conversation-1',
        workspaceId: 'workspace-1',
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    })

    const body = await response.json()
    expect(body).toEqual({ ok: true, deleted: 1, ids: ['conversation-1'] })
  })

  it('fails loudly when the row was already trashed by a concurrent delete', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(500)
  })
})
