import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  rateLimitCost: vi.fn(),
  checkWorkspaceActive: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(async () => ({
    id: 'user-1',
    workspaceId: 'workspace-1',
    platformRole: 'USER',
    phone: '+989123456789',
  })),
}))
vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: mocks.checkWorkspaceActive,
}))
vi.mock('@/lib/ratelimit', () => ({
  rateLimit: mocks.rateLimit,
  rateLimitCost: mocks.rateLimitCost,
}))

import { POST } from '@/app/api/uploads/instagram/route'

function uploadRequest(file: File): Request {
  const form = new FormData()
  form.append('files', file)
  return new Request('https://vigent.ir/api/uploads/instagram', { method: 'POST', body: form })
}

beforeEach(() => {
  mocks.rateLimit.mockReset().mockResolvedValue(true)
  mocks.rateLimitCost.mockReset().mockResolvedValue(true)
  mocks.checkWorkspaceActive.mockReset().mockResolvedValue({ allowed: true, plan: 'STARTER' })
})

describe('Instagram upload abuse boundaries', () => {
  it('requires an active trial or subscription before accepting automation media', async () => {
    mocks.checkWorkspaceActive.mockResolvedValue({ allowed: false, reason: 'SUBSCRIPTION_EXPIRED' })

    const response = await POST(uploadRequest(new File(['png'], 'x.png', { type: 'image/png' })))

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toEqual({ error: 'PLAN_BLOCKED' })
    expect(mocks.rateLimit).not.toHaveBeenCalled()
  })

  it('rejects broad MIME-prefix bypasses such as SVG', async () => {
    const response = await POST(
      uploadRequest(new File(['<svg/>'], 'payload.svg', { type: 'image/svg+xml' })),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('INVALID_TYPE') })
    expect(mocks.rateLimitCost).not.toHaveBeenCalled()
  })

  it('fails closed when the workspace byte budget is spent', async () => {
    mocks.rateLimitCost.mockResolvedValue(false)
    const response = await POST(uploadRequest(new File(['png'], 'x.png', { type: 'image/png' })))
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'UPLOAD_QUOTA_EXCEEDED' })
  })
})
