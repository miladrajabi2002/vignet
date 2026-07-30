import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    conversation: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    handoffAlert: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
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

import { POST } from '@/app/api/conversations/[conversationId]/reset/route'

const props = { params: Promise.resolve({ conversationId: 'conversation-1' }) }
const existing = {
  id: 'conversation-1',
  metadata: { campaign: 'summer' },
  status: 'OPEN',
  handedOff: false,
  workspaceId: 'workspace-1',
  agentId: 'agent-1',
  channel: 'TELEGRAM',
  summary: 'Conversation summary',
  contact: { name: 'Customer', phone: '+989120000000' },
  agent: { name: 'Support agent', language: 'en' },
}

function request(mode: 'AI' | 'OPERATOR') {
  return new Request('http://localhost/api/conversations/conversation-1/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
}

describe('conversation operator control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      workspaceId: 'workspace-1',
    })
    mocks.findFirst.mockResolvedValue(existing)
    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx))
    mocks.tx.conversation.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.conversation.findUniqueOrThrow.mockResolvedValue({
      id: existing.id,
      status: 'HANDED_OFF',
      handedOff: true,
      metadata: {},
    })
    mocks.tx.conversation.update.mockResolvedValue({
      id: existing.id,
      status: 'OPEN',
      handedOff: false,
      metadata: {},
    })
    mocks.tx.handoffAlert.create.mockResolvedValue({ id: 'alert-1' })
    mocks.tx.handoffAlert.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.notification.create.mockResolvedValue({ id: 'notification-1' })
  })

  it('atomically enables operator-only ownership and records one claimed alert', async () => {
    const response = await POST(request('OPERATOR'), props)

    expect(response.status).toBe(200)
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: existing.id,
        OR: [{ status: { not: 'HANDED_OFF' } }, { handedOff: false }],
      },
      data: expect.objectContaining({
        status: 'HANDED_OFF',
        handedOff: true,
        metadata: expect.objectContaining({
          campaign: 'summer',
          aiPaused: true,
          pausedBy: 'user-1',
          controlMode: 'OPERATOR',
        }),
      }),
    })
    expect(mocks.tx.handoffAlert.create).toHaveBeenCalledOnce()
    expect(mocks.tx.notification.create).toHaveBeenCalledOnce()
  })

  it('does not duplicate the handoff alert or notification on retry', async () => {
    mocks.tx.conversation.updateMany.mockResolvedValueOnce({ count: 0 })

    const response = await POST(request('OPERATOR'), props)

    expect(response.status).toBe(200)
    expect(mocks.tx.handoffAlert.create).not.toHaveBeenCalled()
    expect(mocks.tx.notification.create).not.toHaveBeenCalled()
  })

  it('resumes AI and resolves active alerts in the same transaction', async () => {
    const response = await POST(request('AI'), props)

    expect(response.status).toBe(200)
    expect(mocks.tx.conversation.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        status: 'OPEN',
        handedOff: false,
        metadata: expect.objectContaining({
          campaign: 'summer',
          controlMode: 'AI',
        }),
      }),
      select: { id: true, status: true, handedOff: true, metadata: true },
    })
    expect(mocks.tx.handoffAlert.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: existing.id,
        state: { in: ['open', 'claimed'] },
      },
      data: {
        state: 'resolved',
        resolvedAt: expect.any(Date),
      },
    })
  })
})
