import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_IMPERSONATION_SESSION_TTL_MS,
  createAdminImpersonationGrant,
  verifyAdminImpersonationGrant,
} from '@/lib/admin/impersonation'

describe('admin user impersonation grants', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'test-admin-session-secret-with-enough-entropy')
    vi.stubEnv('ADMIN_PASS', 'test-admin-password')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('issues a signed, one-minute exchange grant for a bounded support session', () => {
    const now = 1_800_000_000_000
    const issued = createAdminImpersonationGrant('user-1', 'workspace-1', now)
    const payload = verifyAdminImpersonationGrant(issued.token, now)

    expect(payload).toMatchObject({
      version: 1,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      grantExpiresAt: now + 60_000,
      sessionExpiresAt: now + ADMIN_IMPERSONATION_SESSION_TTL_MS,
    })
    expect(issued.sessionExpiresAt).toBe(now + ADMIN_IMPERSONATION_SESSION_TTL_MS)
  })

  it('rejects tampered and expired grants', () => {
    const now = 1_800_000_000_000
    const { token } = createAdminImpersonationGrant('user-1', 'workspace-1', now)

    expect(verifyAdminImpersonationGrant(`${token.slice(0, -1)}x`, now)).toBeNull()
    expect(verifyAdminImpersonationGrant(token, now + 60_001)).toBeNull()
    expect(verifyAdminImpersonationGrant('x'.repeat(4_097), now)).toBeNull()
  })

  it('binds grants to admin credential rotation', () => {
    const now = 1_800_000_000_000
    const { token } = createAdminImpersonationGrant('user-1', 'workspace-1', now)
    vi.stubEnv('ADMIN_PASS', 'rotated-admin-password')

    expect(verifyAdminImpersonationGrant(token, now)).toBeNull()
  })
})
