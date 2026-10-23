import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentUpdateMany: vi.fn(),
  verifyVigentPayPayment: vi.fn(),
  verifyNowPaymentsIpn: vi.fn(),
  activateSubscriptionPayment: vi.fn(),
  captureAiCreditTopupPayment: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: mocks.paymentFindUnique,
      updateMany: mocks.paymentUpdateMany,
    },
  },
}))
vi.mock('@/lib/billing/vigentpay', () => ({
  verifyVigentPayPayment: mocks.verifyVigentPayPayment,
  vigentPayCallbackIsGenuine: vi.fn(() => true),
}))
vi.mock('@/lib/billing/nowpayments', () => ({
  verifyNowPaymentsIpn: mocks.verifyNowPaymentsIpn,
  NOWPAYMENTS_PAID_STATUSES: ['finished', 'confirmed'],
}))
vi.mock('@/lib/billing/entitlements', () => ({
  activateSubscriptionPayment: mocks.activateSubscriptionPayment,
}))
vi.mock('@/lib/billing/credit-topups', () => ({
  captureAiCreditTopupPayment: mocks.captureAiCreditTopupPayment,
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))

import { GET as vigentPayGet } from '@/app/api/billing/callback/vigentpay/route'
import { POST as nowPaymentsPost } from '@/app/api/billing/callback/nowpayments/route'

const cardSubscription = {
  id: 'payment-card-1',
  workspaceId: 'workspace-1',
  gateway: 'VIGENTPAY',
  plan: 'PRO',
  kind: 'SUBSCRIPTION',
  amount: 24_900_000,
  status: 'PENDING',
  authority: 'authority-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://vigent.test'
  mocks.paymentFindUnique.mockResolvedValue(cardSubscription)
  mocks.paymentUpdateMany.mockResolvedValue({ count: 1 })
  mocks.verifyVigentPayPayment.mockResolvedValue({
    success: true,
    pending: false,
    code: 100,
    amount: cardSubscription.amount,
    orderId: cardSubscription.id,
    paymentId: 'card-transaction-1',
    raw: { success: true },
  })
  mocks.verifyNowPaymentsIpn.mockReturnValue(true)
  mocks.activateSubscriptionPayment.mockResolvedValue(true)
  mocks.captureAiCreditTopupPayment.mockResolvedValue(true)
})

describe('billing callback hardening', () => {
  it('keeps a card-gateway payment pending after a transport failure', async () => {
    mocks.verifyVigentPayPayment.mockRejectedValueOnce(new Error('gateway unavailable'))

    const response = await vigentPayGet(
      new Request(`https://vigent.test/api/billing/callback/vigentpay?pid=${cardSubscription.id}`),
    )

    expect(response.headers.get('location')).toContain('payment=pending')
    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled()
    expect(mocks.activateSubscriptionPayment).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith(
      'billing:vigentpay-verify',
      expect.any(Error),
      expect.objectContaining({ workspaceId: 'workspace-1' }),
    )
  })

  it('keeps a card-gateway payment pending after an unverified response', async () => {
    mocks.verifyVigentPayPayment.mockResolvedValueOnce({
      success: false,
      pending: false,
      raw: { message: 'temporarily unavailable' },
    })

    await vigentPayGet(
      new Request(`https://vigent.test/api/billing/callback/vigentpay?pid=${cardSubscription.id}`),
    )

    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled()
    expect(mocks.activateSubscriptionPayment).not.toHaveBeenCalled()
  })

  it('uses a PENDING compare-and-set for a verified amount mismatch', async () => {
    mocks.verifyVigentPayPayment.mockResolvedValueOnce({
      success: true,
      pending: false,
      amount: cardSubscription.amount - 10,
      orderId: cardSubscription.id,
      raw: { success: true },
    })

    await vigentPayGet(
      new Request(`https://vigent.test/api/billing/callback/vigentpay?pid=${cardSubscription.id}`),
    )

    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith({
      where: { id: cardSubscription.id, status: 'PENDING' },
      data: { status: 'FAILED', callbackPayload: { success: true } },
    })
  })

  it('captures a verified card-gateway credit top-up through the shared idempotent helper', async () => {
    mocks.paymentFindUnique.mockResolvedValueOnce({
      ...cardSubscription,
      plan: null,
      kind: 'AI_CREDIT',
      amount: 500_000,
    })
    mocks.verifyVigentPayPayment.mockResolvedValueOnce({
      success: true,
      pending: false,
      amount: 500_000,
      orderId: cardSubscription.id,
      paymentId: 'card-credit-transaction-1',
      raw: { success: true },
    })

    await vigentPayGet(
      new Request(`https://vigent.test/api/billing/callback/vigentpay?pid=${cardSubscription.id}`),
    )

    expect(mocks.captureAiCreditTopupPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: cardSubscription.id,
      workspaceId: 'workspace-1',
      amountIRR: 500_000,
      paymentUpdate: expect.objectContaining({
        status: 'PAID',
        externalId: 'card-credit-transaction-1',
      }),
    }))
  })

  it('activates a signed NowPayments subscription in USD', async () => {
    mocks.paymentFindUnique.mockResolvedValueOnce({
      id: 'payment-now-1',
      workspaceId: 'workspace-1',
      gateway: 'NOWPAYMENTS',
      kind: 'SUBSCRIPTION',
      plan: 'BUSINESS',
      amount: 49,
      status: 'PENDING',
    })
    const body = JSON.stringify({
      order_id: 'payment-now-1',
      payment_id: 'now-transaction-1',
      payment_status: 'finished',
      price_amount: 49,
      price_currency: 'usd',
    })

    const response = await nowPaymentsPost(new Request(
      'https://vigent.test/api/billing/callback/nowpayments',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-nowpayments-sig': 'valid-signature',
        },
        body,
      },
    ))

    expect(response.status).toBe(200)
    expect(mocks.verifyNowPaymentsIpn).toHaveBeenCalledWith(body, 'valid-signature')
    expect(mocks.activateSubscriptionPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'payment-now-1',
      workspaceId: 'workspace-1',
      plan: 'BUSINESS',
      monthlyPrice: 49,
      currency: 'USD',
      paymentUpdate: expect.objectContaining({
        status: 'PAID',
        externalId: 'now-transaction-1',
      }),
    }))
  })
})
