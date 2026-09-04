import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkWorkspaceActive: vi.fn(),
  contactCount: vi.fn(),
  contactFindMany: vi.fn(),
  contactDeleteMany: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: mocks.checkWorkspaceActive,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      count: mocks.contactCount,
      findMany: mocks.contactFindMany,
      deleteMany: mocks.contactDeleteMany,
    },
  },
}))

import { DELETE } from '@/app/api/contacts/bulk/route'

describe('DELETE /api/contacts/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ workspaceId: 'workspace-1' })
    mocks.checkWorkspaceActive.mockResolvedValue({ allowed: true })
    mocks.contactDeleteMany.mockResolvedValue({ count: 2 })
  })

  it('deletes only selected contacts in the authenticated workspace', async () => {
    const response = await DELETE(new Request('http://localhost/api/contacts/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['contact-1', 'contact-2'] }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, deleted: 2 })
    expect(mocks.contactDeleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        id: { in: ['contact-1', 'contact-2'] },
      },
    })
    expect(mocks.contactFindMany).not.toHaveBeenCalled()
  })

  it('rejects an empty selection instead of falling back to deleting all contacts', async () => {
    const response = await DELETE(new Request('http://localhost/api/contacts/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INVALID_INPUT' })
    expect(mocks.contactDeleteMany).not.toHaveBeenCalled()
    expect(mocks.contactFindMany).not.toHaveBeenCalled()
  })
})
