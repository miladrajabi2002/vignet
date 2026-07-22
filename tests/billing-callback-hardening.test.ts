import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentUpdateMany: vi.fn(),
  verifyZarinPayPayment: vi.fn(),
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
vi.mock('@/lib/billing/zarinpay', () => ({
  verifyZarinPayPayment: mocks.verifyZarinPayPayment,
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

import { GET as zarinPayGet } from '@/app/api/billing/callback/zarinpay/route'
import { POST as nowPaymentsPost } from '@/app/api/billing/callback/nowpayments/route'

const zarinSubscription = {
  id: 'payment-zarin-1',
  workspaceId: 'workspace-1',
  gateway: 'ZARINPAY',
  plan: 'PRO',
  kind: 'SUBSCRIPTION',
  amount: 24_900_000,
  status: 'PENDING',
  authority: 'authority-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://vigent.test'
  mocks.paymentFindUnique.mockResolvedValue(zarinSubscription)
  mocks.paymentUpdateMany.mockResolvedValue({ count: 1 })
  mocks.verifyZarinPayPayment.mockResolvedValue({
    success: true,
    amount: zarinSubscription.amount,
    orderId: zarinSubscription.id,
    paymentId: 'zarin-transaction-1',
    raw: { success: true },
  })
  mocks.verifyNowPaymentsIpn.mockReturnValue(true)
  mocks.activateSubscriptionPayment.mockResolvedValue(true)
  mocks.captureAiCreditTopupPayment.mockResolvedValue(true)
})

describe('billing callback hardening', () => {
  it('keeps a ZarinPay payment pending after a transport failure', async () => {
    mocks.verifyZarinPayPayment.mockRejectedValueOnce(new Error('gateway unavailable'))

    const response = await zarinPayGet(
      new Request(`https://vigent.test/api/billing/callback/zarinpay?pid=${zarinSubscription.id}`),
    )

    expect(response.headers.get('location')).toContain('payment=failed')
    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled()
    expect(mocks.activateSubscriptionPayment).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith(
      'billing:zarinpay-verify',
      expect.any(Error),
      expect.objectContaining({ workspaceId: 'workspace-1' }),
    )
  })

  it('keeps a ZarinPay payment pending after an unverified response', async () => {
    mocks.verifyZarinPayPayment.mockResolvedValueOnce({
      success: false,
      raw: { message: 'temporarily unavailable' },
    })

    await zarinPayGet(
      new Request(`https://vigent.test/api/billing/callback/zarinpay?pid=${zarinSubscription.id}`),
    )

    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled()
    expect(mocks.activateSubscriptionPayment).not.toHaveBeenCalled()
  })

  it('uses a PENDING compare-and-set for a verified amount mismatch', async () => {
    mocks.verifyZarinPayPayment.mockResolvedValueOnce({
      success: true,
      amount: zarinSubscription.amount - 10,
      orderId: zarinSubscription.id,
      raw: { success: true },
    })

    await zarinPayGet(
      new Request(`https://vigent.test/api/billing/callback/zarinpay?pid=${zarinSubscription.id}`),
    )

    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith({
      where: { id: zarinSubscription.id, status: 'PENDING' },
      data: { status: 'FAILED', callbackPayload: { success: true } },
    })
  })

  it('captures a verified ZarinPay credit top-up through the shared idempotent helper', async () => {
    mocks.paymentFindUnique.mockResolvedValueOnce({
      ...zarinSubscription,
      plan: null,
      kind: 'AI_CREDIT',
      amount: 500_000,
    })
    mocks.verifyZarinPayPayment.mockResolvedValueOnce({
      success: true,
      amount: 500_000,
      orderId: zarinSubscription.id,
      paymentId: 'zarin-credit-transaction-1',
      raw: { success: true },
    })

    await zarinPayGet(
      new Request(`https://vigent.test/api/billing/callback/zarinpay?pid=${zarinSubscription.id}`),
    )

    expect(mocks.captureAiCreditTopupPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: zarinSubscription.id,
      workspaceId: 'workspace-1',
      amountIRR: 500_000,
      paymentUpdate: expect.objectContaining({
        status: 'PAID',
        externalId: 'zarin-credit-transaction-1',
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
