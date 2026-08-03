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

import { withContactIdentityLock, withContactIdentityLocks } from '@/lib/crm/contact-identity-lock'

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

  it('sorts and deduplicates multiple identity locks before the operation', async () => {
    const operation = vi.fn().mockResolvedValue('contact-1')

    await withContactIdentityLocks(
      'workspace-1',
      ['phone:09128352271', 'TELEGRAM:42', 'phone:09128352271'],
      operation,
    )

    expect(mocks.executeRaw).toHaveBeenCalledTimes(2)
    expect(mocks.executeRaw.mock.calls.map((call) => call[1])).toEqual([
      'contact:workspace-1:TELEGRAM:42',
      'contact:workspace-1:phone:09128352271',
    ])
    expect(operation).toHaveBeenCalledOnce()
  })
})
