import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(), agent: vi.fn(), message: vi.fn(), draft: vi.fn(), rateLimit: vi.fn(),
}))
vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/prisma', () => ({ prisma: { agent: { findFirst: mocks.agent }, message: { findFirst: mocks.message } } }))
vi.mock('@/lib/ai/learning', () => ({ draftAnswer: mocks.draft }))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: mocks.rateLimit }))

import { POST } from '@/app/api/agents/[agentId]/learning/suggest/route'
import { LEARNING_REVIEW_VERSION } from '@/lib/ai/learning-candidates'

const props = { params: Promise.resolve({ agentId: 'agent-1' }) }
const question = 'شرایط ارسال چیست؟'
function request(messageId: string | undefined = 'message-1') {
  return new Request('http://localhost/api/agents/agent-1/learning/suggest', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, question }),
  })
}

describe('learning suggestions require analysis', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.user.mockResolvedValue({ id: 'user-1', workspaceId: 'workspace-1' })
    mocks.agent.mockResolvedValue({ id: 'agent-1' })
    mocks.rateLimit.mockResolvedValue(true)
    mocks.message.mockResolvedValue({ metadata: { learningReview: { version: LEARNING_REVIEW_VERSION, eligible: true } } })
    mocks.draft.mockResolvedValue({ answer: 'پاسخ پیشنهادی' })
  })

  it.each([null, {}, { version: 'old', eligible: true }])('does not call AI for an unanalyzed source (%j)', async (learningReview) => {
    mocks.message.mockResolvedValue({ metadata: { learningReview } })
    const response = await POST(request(), props)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'LEARNING_ANALYSIS_REQUIRED' })
    expect(mocks.draft).not.toHaveBeenCalled()
  })

  it('rejects sources excluded by analysis', async () => {
    mocks.message.mockResolvedValue({ metadata: { learningReview: { version: LEARNING_REVIEW_VERSION, eligible: false } } })
    expect((await POST(request(), props)).status).toBe(422)
    expect(mocks.draft).not.toHaveBeenCalled()
  })

  it('requires a pending source scoped to this workspace and agent', async () => {
    mocks.message.mockResolvedValue(null)
    expect((await POST(request(), props)).status).toBe(409)
    expect(mocks.message).toHaveBeenCalledWith({
      where: { id: 'message-1', role: 'ASSISTANT', unanswered: true, conversation: { agentId: 'agent-1', workspaceId: 'workspace-1' } },
      select: { metadata: true },
    })
    expect(mocks.draft).not.toHaveBeenCalled()
  })

  it('allows an edited question for an analyzed, eligible source', async () => {
    const response = await POST(request(), props)
    expect(response.status).toBe(200)
    expect(mocks.draft).toHaveBeenCalledWith('workspace-1', { id: 'agent-1' }, question)
  })
})
