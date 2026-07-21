import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isAdminAuthedRequest: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock('@/lib/admin/auth', () => ({
  isAdminAuthedRequest: mocks.isAdminAuthedRequest,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { errorLog: { deleteMany: mocks.deleteMany } },
}))

import { DELETE } from '@/app/api/admin/errors/route'

beforeEach(() => {
  mocks.isAdminAuthedRequest.mockReset()
  mocks.deleteMany.mockReset()
})

describe('admin error log reset', () => {
  it('rejects unauthenticated requests', async () => {
    mocks.isAdminAuthedRequest.mockResolvedValue(false)
    const response = await DELETE(new Request('https://vigent.ir/api/admin/errors', { method: 'DELETE' }))
    expect(response.status).toBe(401)
    expect(mocks.deleteMany).not.toHaveBeenCalled()
  })

  it('clears every persisted log and reports the affected count', async () => {
    mocks.isAdminAuthedRequest.mockResolvedValue(true)
    mocks.deleteMany.mockResolvedValue({ count: 12 })
    const response = await DELETE(new Request('https://vigent.ir/api/admin/errors', { method: 'DELETE' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, cleared: 12 })
    expect(mocks.deleteMany).toHaveBeenCalledWith()
  })
})
