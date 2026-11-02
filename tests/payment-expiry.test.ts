import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { updateMany: mocks.updateMany } } }))

import {
  CLAIMABLE_PAYMENT_STATUSES,
  PAYMENT_PENDING_TTL_MS,
  expireCancelledPayment,
  sweepStalePayments,
} from '@/lib/billing/payment-expiry'

describe('stale checkout sweep', () => {
  beforeEach(() => {
    mocks.updateMany.mockReset()
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('expires each gateway after its own window, crypto after a day', async () => {
    const now = new Date('2026-11-03T12:00:00Z')
    const result = await sweepStalePayments(now)
    expect(result.expired).toBe(3)
    const calls = mocks.updateMany.mock.calls.map(([args]) => args)
    const crypto = calls.find((args) => args.where.gateway === 'NOWPAYMENTS')
    expect(crypto.where.status).toBe('PENDING')
    expect(crypto.data).toEqual({ status: 'EXPIRED' })
    expect(now.getTime() - crypto.where.createdAt.lt.getTime()).toBe(24 * 60 * 60_000)
    const rial = calls.find((args) => args.where.gateway === 'VIGENTPAY')
    expect(now.getTime() - rial.where.createdAt.lt.getTime()).toBe(PAYMENT_PENDING_TTL_MS.VIGENTPAY)
  })

  it('closes only the owner’s pending crypto checkout on cancel', async () => {
    await expireCancelledPayment('ws-1', 'pay-1')
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', workspaceId: 'ws-1', gateway: 'NOWPAYMENTS', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    })
  })

  it('lets a verified late payment still activate an expired row', () => {
    expect(CLAIMABLE_PAYMENT_STATUSES).toEqual(['PENDING', 'EXPIRED'])
    for (const file of ['lib/billing/entitlements.ts', 'lib/billing/credit-topups.ts']) {
      expect(readFileSync(file, 'utf8')).toContain('status: { in: CLAIMABLE_PAYMENT_STATUSES }')
    }
  })
})

describe('agent delete', () => {
  it('is one cascading delete outside the soft-delete batch transaction', () => {
    const route = readFileSync('app/api/agents/[agentId]/route.ts', 'utf8')
    const handler = route
      .slice(route.indexOf('export async function DELETE'))
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    expect(handler).toContain('prismaRaw.agent.delete')
    expect(handler).not.toContain('$transaction([')
  })
})
