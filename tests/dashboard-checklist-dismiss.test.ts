import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: { workspace: { update: mocks.update } },
}))

import { DELETE } from '@/app/api/dashboard/checklist/route'

describe('DELETE /api/dashboard/checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.update.mockResolvedValue({ id: 'workspace-1' })
  })

  it('requires an authenticated workspace user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await DELETE()

    expect(response.status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('persists the dismissal on the current workspace', async () => {
    const response = await DELETE()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'workspace-1' },
      data: { dashboardChecklistDismissedAt: expect.any(Date) },
    })
  })
})
