import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  findFirst: vi.fn(),
  auditCreate: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/auth', () => ({ auth: mocks.auth, signIn: mocks.signIn }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: mocks.findFirst },
    adminAuditLog: { create: mocks.auditCreate },
  },
}))
vi.mock('@/lib/admin/owner', () => ({
  ADMIN_OWNER_PHONE: '+989120000000',
  isPlatformOwnerPhone: (phone: string) => phone === '+989120000000',
}))
vi.mock('@/lib/admin/impersonation', () => ({
  createAdminImpersonationGrant: () => ({ token: 'owner-grant', sessionExpiresAt: 0 }),
}))
vi.mock('@/lib/errors/capture', () => ({ captureWarning: vi.fn() }))

import { GET } from '@/app/api/auth/support-return/route'

const owner = { id: 'owner-1', workspaceId: 'owner-ws', phone: '+989120000000' }
const endedSupportSession = {
  id: 'customer-1',
  workspaceId: 'customer-ws',
  impersonatedByAdmin: true,
  impersonationExpiresAt: Date.now() - 1,
  impersonatorId: owner.id,
}

function request(headers: Record<string, string> = {}) {
  return new Request('https://vigent.ir/api/auth/support-return', { headers })
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: endedSupportSession })
  mocks.signIn.mockReset()
  mocks.findFirst.mockReset().mockResolvedValue(owner)
  mocks.auditCreate.mockReset().mockResolvedValue({})
  mocks.redirect.mockClear()
})

describe('support session return', () => {
  it('restores the owner session when the support window has ended', async () => {
    await GET(request())

    expect(mocks.signIn).toHaveBeenCalledWith('admin-impersonation', {
      grant: 'owner-grant',
      redirectTo: '/overview',
    })
  })

  it('keeps an already restored owner signed in on a repeated hit', async () => {
    mocks.auth.mockResolvedValue({ user: { id: owner.id, workspaceId: owner.workspaceId } })

    await expect(GET(request())).rejects.toThrow('REDIRECT:/overview')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it('answers an in-app navigation with a non-flight response so the router reloads', async () => {
    const response = await GET(request({ rsc: '1' }))

    expect(response?.status).toBe(204)
    expect(response?.headers.get('content-type')).toBeNull()
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it('still signs out a support session whose owner cannot be verified', async () => {
    mocks.findFirst.mockResolvedValue(null)

    await expect(GET(request())).rejects.toThrow('REDIRECT:/api/auth/force-logout')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
})
