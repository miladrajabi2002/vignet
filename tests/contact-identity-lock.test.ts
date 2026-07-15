import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  executeRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))

import { withContactIdentityLock } from '@/lib/crm/contact-identity-lock'

describe('withContactIdentityLock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.executeRaw.mockResolvedValue(1)
    mocks.transaction.mockImplementation(async (callback) => callback({ $executeRaw: mocks.executeRaw }))
  })

  it('executes the void advisory-lock statement without deserializing a raw result', async () => {
    const operation = vi.fn().mockResolvedValue('contact-1')

    const result = await withContactIdentityLock('workspace-1', 'WHATSAPP:sender-1', operation)

    expect(result).toBe('contact-1')
    expect(mocks.executeRaw).toHaveBeenCalledOnce()
    expect(mocks.executeRaw.mock.calls[0]?.[1]).toBe('contact:workspace-1:WHATSAPP:sender-1')
    expect(operation).toHaveBeenCalledOnce()
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0],
    )
  })
})
