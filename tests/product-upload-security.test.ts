import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rateLimitCost: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(async () => ({
    id: 'user-1',
    workspaceId: 'workspace-1',
  })),
}))

vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceActive: vi.fn(async () => ({ allowed: true })),
}))

vi.mock('@/lib/ratelimit', () => ({
  rateLimitCost: mocks.rateLimitCost,
}))

import { POST } from '@/app/api/uploads/products/route'

function uploadRequest(file: File): Request {
  const form = new FormData()
  form.append('file', file)
  return new Request('https://vigent.ir/api/uploads/products', { method: 'POST', body: form })
}

beforeEach(() => {
  mocks.rateLimitCost.mockReset().mockResolvedValue(true)
})

describe('product image upload boundaries', () => {
  it('rejects SVG and other MIME types outside the image allow-list', async () => {
    const response = await POST(
      uploadRequest(new File(['<svg/>'], 'payload.svg', { type: 'image/svg+xml' })),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'INVALID_IMAGE_TYPE' })
    expect(mocks.rateLimitCost).not.toHaveBeenCalled()
  })

  it('fails closed when the workspace daily byte budget is exhausted', async () => {
    mocks.rateLimitCost.mockResolvedValue(false)

    const response = await POST(
      uploadRequest(new File(['image'], 'product.webp', { type: 'image/webp' })),
    )

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'UPLOAD_QUOTA_EXCEEDED' })
  })
})
