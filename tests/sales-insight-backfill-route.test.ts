import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  backfill: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/ai/sales-intelligence', () => ({
  backfillWorkspaceSalesInsights: mocks.backfill,
}))

import { POST } from '@/app/api/conversations/sales-insights/backfill/route'

describe('sales insight historical backfill route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.backfill.mockResolvedValue({ processed: 3, failed: 0, hasMore: true })
  })

  it('requires an authenticated workspace', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await POST(new Request('https://vigent.test/api/conversations/sales-insights/backfill', {
      method: 'POST',
      body: '{}',
    }))

    expect(response.status).toBe(401)
    expect(mocks.backfill).not.toHaveBeenCalled()
  })

  it('passes only the authenticated workspace id to the bounded backfill', async () => {
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-owned' })

    const response = await POST(new Request('https://vigent.test/api/conversations/sales-insights/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 12, workspaceId: 'workspace-attacker' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.backfill).toHaveBeenCalledWith('workspace-owned', 12)
    await expect(response.json()).resolves.toEqual({ processed: 3, failed: 0, hasMore: true })
  })
})
