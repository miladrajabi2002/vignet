import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}))

import { getCurrentUser } from '@/lib/session'

const staleAdmin = {
  id: 'user-1',
  workspaceId: 'old-workspace',
  platformRole: 'USER',
  phone: '+989111111111',
  name: 'Old name',
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: staleAdmin })
  mocks.findUnique.mockReset()
})

describe('session claim revalidation', () => {
  it('revokes a JWT after its user is deleted', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('returns the current database workspace and platform role instead of stale claims', async () => {
    const current = { ...staleAdmin, workspaceId: 'new-workspace', platformRole: 'ADMIN', name: 'Current' }
    mocks.findUnique.mockResolvedValue(current)
    await expect(getCurrentUser()).resolves.toEqual(current)
  })
})
