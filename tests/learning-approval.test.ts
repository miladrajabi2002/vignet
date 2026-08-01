import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    knowledgeApproval: { findUnique: vi.fn(), create: vi.fn() },
    message: { findFirst: vi.fn(), updateMany: vi.fn() },
    knowledgeBase: { create: vi.fn() },
  }
  return {
    getCurrentUser: vi.fn(),
    agentFindFirst: vi.fn(),
    approvalFindFirst: vi.fn(),
    transaction: vi.fn(),
    dispatchIngestion: vi.fn(),
    tx,
  }
})

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findFirst: mocks.agentFindFirst },
    knowledgeApproval: { findFirst: mocks.approvalFindFirst },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/queue/jobs', () => ({ dispatchIngestion: mocks.dispatchIngestion }))

import { POST } from '@/app/api/agents/[agentId]/learning/approve/route'

const props = { params: Promise.resolve({ agentId: 'agent-1' }) }

function request(answer = 'ارسال استاندارد سه تا پنج روز کاری زمان می‌برد.') {
  return new Request('http://localhost/api/agents/agent-1/learning/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: 'message-1',
      question: 'ارسال چند روز طول می‌کشد؟',
      answer,
    }),
  })
}

describe('learning approval ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', workspaceId: 'workspace-1' })
    mocks.agentFindFirst.mockResolvedValue({ id: 'agent-1' })
    mocks.approvalFindFirst.mockResolvedValue(null)
    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx))
    mocks.tx.knowledgeApproval.findUnique.mockResolvedValue(null)
    mocks.tx.message.findFirst.mockResolvedValue({
      id: 'message-1',
      conversationId: 'conversation-1',
      metadata: {
        operator: true,
        question: 'ارسال چند روز طول می‌کشد؟',
        learningCandidate: { eligible: true },
      },
    })
    mocks.tx.knowledgeBase.create.mockResolvedValue({ id: 'kb-1' })
    mocks.tx.knowledgeApproval.create.mockResolvedValue({ id: 'approval-1' })
    mocks.tx.message.updateMany.mockResolvedValue({ count: 1 })
    mocks.dispatchIngestion.mockResolvedValue(undefined)
  })

  it('creates KB, provenance and source resolution in one transaction', async () => {
    const response = await POST(request(), props)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, kbId: 'kb-1', replayed: false })
    expect(mocks.tx.knowledgeApproval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        agentId: 'agent-1',
        knowledgeBaseId: 'kb-1',
        sourceMessageRef: 'message-1',
        sourceConversationId: 'conversation-1',
        source: 'OPERATOR_REPLY',
        verifiedByUserRef: 'user-1',
        knowledgeVersion: 1,
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    })
    expect(mocks.tx.message.updateMany).toHaveBeenCalledWith({
      where: { id: 'message-1', unanswered: true },
      data: { unanswered: false },
    })
    expect(mocks.dispatchIngestion).toHaveBeenCalledWith({
      kbId: 'kb-1',
      text: expect.stringContaining('ارسال استاندارد'),
    })
  })

  it('replays the existing KB instead of creating a duplicate on retry', async () => {
    mocks.approvalFindFirst.mockResolvedValue({
      knowledgeBaseId: 'kb-existing',
      question: 'ارسال چند روز طول می‌کشد؟',
      answer: 'سه تا پنج روز کاری.',
    })

    const response = await POST(request(), props)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      kbId: 'kb-existing',
      replayed: true,
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.dispatchIngestion).toHaveBeenCalledOnce()
  })

  it('rejects a final edit that introduces personal data', async () => {
    const response = await POST(
      request('برای پیگیری با شماره 09121234567 تماس می‌گیریم.'),
      props,
    )

    expect(response.status).toBe(422)
    expect(mocks.tx.knowledgeBase.create).not.toHaveBeenCalled()
    expect(mocks.dispatchIngestion).not.toHaveBeenCalled()
  })
})
