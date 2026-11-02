import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: { cardPayment: { findUnique: db.findUnique, updateMany: db.updateMany } } }))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: vi.fn(async () => true) }))
vi.mock('@/lib/payments/card/sites', () => ({ siteFromRequest: vi.fn(async () => ({ id: 'site-1' })) }))

import { POST as verify } from '@/app/api/pay/v1/verify/route'
import { PAYMENT_BULK_SCOPES, parseBulkScope, paymentBulkWhere } from '@/lib/bulk-delete/scopes'
import { awaitingHandlingWhere, deletablePaymentsWhere } from '@/lib/payments/card/fulfilment'

const paid = { id: 'pay-1', siteId: 'site-1', status: 'PAID', purpose: 'ORDER', baseAmount: 250000, payAmount: 250123, reference: 'ORD-1', authority: 'P123456789', confirmedBy: 'AUTO', paidAt: new Date('2026-10-24T05:42:26Z') }
const ask = () => verify(new Request('http://x/api/pay/v1/verify', { method: 'POST', body: JSON.stringify({ authority: paid.authority }) }))

describe('a connected site’s paid order', () => {
  beforeEach(() => {
    db.findUnique.mockReset().mockResolvedValue(paid)
    db.updateMany.mockReset()
  })

  it('is handled when the site first verifies it, so it never waits in «خرید موفق»', async () => {
    db.updateMany.mockResolvedValue({ count: 1 })
    const response = await ask()
    expect((await response.json()).data.code).toBe(100)
    expect(db.updateMany).toHaveBeenCalledTimes(2)
    expect(db.updateMany.mock.calls[1][0]).toMatchObject({ where: { id: 'pay-1', handledAt: null }, data: { handledAt: expect.any(Date) } })
  })

  it('is not touched again on a later verify (the owner may have taken it back)', async () => {
    db.updateMany.mockResolvedValue({ count: 0 })
    const response = await ask()
    expect((await response.json()).data.code).toBe(101)
    expect(db.updateMany).toHaveBeenCalledTimes(1)
  })

  it('leaves a booking or course payment alone', async () => {
    db.findUnique.mockResolvedValue({ ...paid, purpose: 'BOOKING' })
    db.updateMany.mockResolvedValue({ count: 1 })
    await ask()
    expect(db.updateMany).toHaveBeenCalledTimes(1)
  })

  it('still counts as waiting until it is handled', () => {
    expect(awaitingHandlingWhere('ws')).toMatchObject({ workspaceId: 'ws', status: 'PAID', purpose: 'ORDER', handledAt: null })
  })
})

describe('deleting payments', () => {
  it('never reaches an open payment or a setup test transfer', () => {
    expect(deletablePaymentsWhere('ws')).toEqual({ workspaceId: 'ws', status: { notIn: ['PENDING', 'CLAIMED'] }, NOT: { reference: { startsWith: 'TEST-' } } })
  })

  it('defaults a bare bulk delete to the failed ones', () => {
    expect(parseBulkScope(new Request('http://x/api/payments/bulk'), PAYMENT_BULK_SCOPES)).toBe('closed')
    expect(parseBulkScope(new Request('http://x/api/payments/bulk?scope=everything'), PAYMENT_BULK_SCOPES)).toBeNull()
    expect(paymentBulkWhere('closed')).toEqual({ status: { in: ['EXPIRED', 'CANCELLED', 'FAILED'] } })
    expect(paymentBulkWhere('all')).toEqual({})
    const now = new Date('2026-10-24T12:00:00Z')
    expect(paymentBulkWhere('older_90d', now)).toEqual({ createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } })
  })
})

describe('why a payment was not made', () => {
  it('names the minimum (and the ceiling) instead of a generic failure', async () => {
    const { paymentCreateErrorText } = await import('@/lib/payments/card/create-errors')
    expect(paymentCreateErrorText('AMOUNT_TOO_LOW', true)).toContain('۱٬۰۰۰')
    expect(paymentCreateErrorText('AMOUNT_TOO_LOW', false)).toContain('1,000 Toman')
    expect(paymentCreateErrorText('AMOUNT_TOO_HIGH', false, 50_000_000)).toContain('50,000,000')
    expect(paymentCreateErrorText('AMOUNT_INVALID', true)).toBeTruthy()
    expect(paymentCreateErrorText('SOMETHING_ELSE', true)).toBeNull()
  })
})

describe('chat pre-orders on «درخواست‌ها»', () => {
  it('only lets closed ones be deleted, and a bare bulk delete takes the cancelled ones', async () => {
    const { isDeletableRequest } = await import('@/lib/commerce/request-states')
    const { REQUEST_BULK_SCOPES, requestBulkWhere } = await import('@/lib/bulk-delete/scopes')
    for (const open of ['SUBMITTED', 'AWAITING_TRANSFER', 'PAYMENT_REVIEW', 'LINK_SENT', 'PAYMENT_PENDING', 'ON_HOLD', 'PAID', 'COLLECTING']) expect(isDeletableRequest(open)).toBe(false)
    for (const closed of ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED', 'REFUNDED']) expect(isDeletableRequest(closed)).toBe(true)
    expect(parseBulkScope(new Request('http://x/api/products/requests/bulk'), REQUEST_BULK_SCOPES)).toBe('closed')
    expect(requestBulkWhere('done')).toEqual({ status: 'CONFIRMED' })
  })
})
