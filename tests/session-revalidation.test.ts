import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}))
vi.mock('next/headers', () => ({ headers: mocks.headers }))

import { getCurrentUser } from '@/lib/session'

const staleAdmin = {
  id: 'user-1',
  workspaceId: 'old-workspace',
  role: 'ADMIN',
  platformRole: 'USER',
  phone: '+989111111111',
  name: 'Old name',
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: staleAdmin })
  mocks.findUnique.mockReset()
  mocks.headers.mockReset().mockResolvedValue(new Headers())
})

describe('session claim revalidation', () => {
  it('revokes a JWT after its user is deleted', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('returns the current database workspace and role instead of stale claims', async () => {
    const current = { ...staleAdmin, workspaceId: 'new-workspace', role: 'MEMBER', name: 'Current' }
    mocks.findUnique.mockResolvedValue(current)
    await expect(getCurrentUser()).resolves.toEqual(current)
  })

  it('denies a protected mutation after an ADMIN to MEMBER downgrade', async () => {
    mocks.findUnique.mockResolvedValue({ ...staleAdmin, role: 'MEMBER' })
    mocks.headers.mockResolvedValue(new Headers({
      'x-pathname': '/api/agents/agent-1',
      'x-vigent-method': 'PATCH',
    }))
    await expect(getCurrentUser()).resolves.toBeNull()
  })
})

