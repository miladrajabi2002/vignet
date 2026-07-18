import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findFirst: mocks.findFirst },
    message: { updateMany: mocks.updateMany },
  },
}))

import { DELETE } from '@/app/api/agents/[agentId]/learning/route'

const props = { params: Promise.resolve({ agentId: 'agent-1' }) }

function dismissRequest(messageId = 'message-1') {
  return new Request('http://localhost/api/agents/agent-1/learning', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  })
}

describe('DELETE /api/agents/:agentId/learning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.findFirst.mockResolvedValue({ id: 'agent-1' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('requires an authenticated workspace user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await DELETE(dismissRequest(), props)

    expect(response.status).toBe(401)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('does not dismiss learning items belonging to another workspace', async () => {
    mocks.findFirst.mockResolvedValue(null)

    const response = await DELETE(dismissRequest(), props)

    expect(response.status).toBe(404)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('resolves only the selected pending item for the owned agent', async () => {
    const response = await DELETE(dismissRequest(), props)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'message-1',
        unanswered: true,
        conversation: { agentId: 'agent-1', workspaceId: 'workspace-1' },
      },
      data: { unanswered: false },
    })
  })
})
