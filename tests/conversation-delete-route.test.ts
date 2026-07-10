import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    usageLog: { updateMany: vi.fn() },
    message: { deleteMany: vi.fn() },
    handoffAlert: { deleteMany: vi.fn() },
    conversation: { deleteMany: vi.fn() },
  }
  return {
    getCurrentUser: vi.fn(),
    findFirst: vi.fn(),
    transaction: vi.fn(),
    tx,
  }
})

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
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
    mocks.tx.usageLog.updateMany.mockResolvedValue({ count: 2 })
    mocks.tx.message.deleteMany.mockResolvedValue({ count: 3 })
    mocks.tx.handoffAlert.deleteMany.mockResolvedValue({ count: 1 })
    mocks.tx.conversation.deleteMany.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx))
  })

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(401)
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('does not expose or delete a conversation outside the workspace', async () => {
    mocks.findFirst.mockResolvedValue(null)

    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(404)
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', workspaceId: 'workspace-1' },
      select: { id: true },
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('clears references and deletes dependants transactionally before the conversation', async () => {
    const response = await DELETE(new Request('http://localhost'), props)

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(mocks.tx.usageLog.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1' },
      data: { conversationId: null },
    })
    expect(mocks.tx.message.deleteMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1' },
    })
    expect(mocks.tx.handoffAlert.deleteMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1' },
    })
    expect(mocks.tx.conversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'conversation-1', workspaceId: 'workspace-1' },
    })

    expect(mocks.tx.usageLog.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.message.deleteMany.mock.invocationCallOrder[0],
    )
    expect(mocks.tx.message.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.handoffAlert.deleteMany.mock.invocationCallOrder[0],
    )
    expect(mocks.tx.handoffAlert.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.conversation.deleteMany.mock.invocationCallOrder[0],
    )
  })
})
