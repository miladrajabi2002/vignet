import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  notifyAdminCommercialEvent: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminCommercialSmsOutbox: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}))

vi.mock('@/lib/billing/admin-commercial-notifications', () => ({
  notifyAdminCommercialEvent: mocks.notifyAdminCommercialEvent,
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))

import {
  enqueueAdminCommercialSms,
  processAdminCommercialSmsPayment,
  sweepAdminCommercialSmsOutbox,
} from '@/lib/billing/admin-commercial-outbox'

const row = {
  id: 'outbox-1',
  paymentId: 'payment-1',
  workspaceId: 'workspace-1',
  kind: 'SUBSCRIPTION_PURCHASED',
  attemptCount: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({})
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.findUnique.mockResolvedValue(row)
  mocks.findMany.mockResolvedValue([])
  mocks.notifyAdminCommercialEvent.mockResolvedValue(true)
})

describe('durable admin commercial SMS outbox', () => {
  it('creates one payment-keyed row inside the caller transaction', async () => {
    const tx = {
      adminCommercialSmsOutbox: { create: mocks.create },
    }

    await enqueueAdminCommercialSms(tx as never, {
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: 'payment-1',
      workspaceId: 'workspace-1',
    })

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        kind: 'SUBSCRIPTION_PURCHASED',
        paymentId: 'payment-1',
        workspaceId: 'workspace-1',
      },
    })
  })

  it('leases, sends and marks a due row as sent', async () => {
    await expect(processAdminCommercialSmsPayment('payment-1')).resolves.toBe(true)

    expect(mocks.notifyAdminCommercialEvent).toHaveBeenCalledWith({
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: 'payment-1',
      workspaceId: 'workspace-1',
    })
    expect(mocks.updateMany).toHaveBeenCalledTimes(2)
    expect(mocks.updateMany.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({ id: 'outbox-1', sentAt: null }),
      data: expect.objectContaining({ sentAt: expect.any(Date), claimedAt: null }),
    }))
  })

  it('does not send when another callback or worker owns the lease', async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(processAdminCommercialSmsPayment('payment-1')).resolves.toBe(false)

    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.notifyAdminCommercialEvent).not.toHaveBeenCalled()
  })

  it('releases a failed attempt with exponential retry metadata', async () => {
    mocks.notifyAdminCommercialEvent.mockResolvedValueOnce(false)

    await expect(processAdminCommercialSmsPayment('payment-1')).resolves.toBe(false)

    const retryUpdate = mocks.updateMany.mock.calls[1]?.[0]
    expect(retryUpdate).toEqual(expect.objectContaining({
      where: expect.objectContaining({ id: 'outbox-1', sentAt: null }),
      data: expect.objectContaining({
        claimedAt: null,
        lastError: 'SMS_DELIVERY_FAILED',
        nextAttemptAt: expect.any(Date),
      }),
    }))
    const claimedAt = retryUpdate.where.claimedAt as Date
    const nextAttemptAt = retryUpdate.data.nextAttemptAt as Date
    expect(nextAttemptAt.getTime() - claimedAt.getTime()).toBe(5 * 60_000)
  })

  it('sweeps due rows and reports only delivered alerts', async () => {
    mocks.findMany.mockResolvedValueOnce([
      { paymentId: 'payment-1' },
      { paymentId: 'payment-2' },
    ])
    mocks.findUnique
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({
        ...row,
        id: 'outbox-2',
        paymentId: 'payment-2',
        kind: 'AI_CREDIT_TOPPED_UP',
      })
    mocks.notifyAdminCommercialEvent
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    await expect(sweepAdminCommercialSmsOutbox()).resolves.toBe(1)
    expect(mocks.notifyAdminCommercialEvent).toHaveBeenCalledTimes(2)
  })
})
