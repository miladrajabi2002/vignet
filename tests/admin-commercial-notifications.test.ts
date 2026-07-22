import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  sendSms: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { payment: { findUnique: mocks.paymentFindUnique } },
}))

vi.mock('@/lib/sms/ippanel', () => ({ sendSms: mocks.sendSms }))
vi.mock('@/lib/errors/capture', () => ({ captureError: mocks.captureError }))
vi.mock('@/lib/admin/owner', () => ({ ADMIN_OWNER_PHONE: '+989128352271' }))

import { notifyAdminCommercialEvent } from '@/lib/billing/admin-commercial-notifications'

const paidSubscription = {
  id: 'payment-subscription-1',
  workspaceId: 'workspace-1',
  gateway: 'ZARINPAY',
  kind: 'SUBSCRIPTION',
  status: 'PAID',
  plan: 'PRO',
  amount: 24_900_000,
  currency: 'IRR',
  externalId: 'zarin-transaction-42',
  paidAt: new Date('2026-07-22T10:30:00.000Z'),
  workspace: {
    name: 'فروشگاه نمونه',
    slug: 'sample-shop',
    aiCreditBalanceIRR: 600_000,
    owner: { name: 'کاربر نمونه', phone: '+989121112233' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ADMIN_COMMERCIAL_SMS_PHONE
  process.env.DASHBOARD_TZ = 'Asia/Tehran'
  mocks.paymentFindUnique.mockResolvedValue(paidSubscription)
  mocks.sendSms.mockResolvedValue(true)
})

describe('admin commercial SMS notifications', () => {
  it('sends verified subscription details to the canonical platform owner', async () => {
    await expect(notifyAdminCommercialEvent({
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: paidSubscription.id,
      workspaceId: paidSubscription.workspaceId,
    })).resolves.toBe(true)

    expect(mocks.sendSms).toHaveBeenCalledTimes(1)
    const [mobile, message] = mocks.sendSms.mock.calls[0] as [string, string]
    expect(mobile).toBe('+989128352271')
    expect(message).toContain('خرید اشتراک')
    expect(message).toContain('فروشگاه نمونه (sample-shop)')
    expect(message).toContain('کاربر نمونه | +989121112233')
    expect(message).toContain('پلن: حرفه‌ای')
    expect(message).toContain(`${(2_490_000).toLocaleString('fa-IR')} تومان`)
    expect(message).toContain('درگاه: زرین‌پی')
    expect(message).toContain('شناسه تراکنش درگاه: zarin-transaction-42')
    expect(message).toContain('payment-subscription-1')
  })

  it('uses the optional commercial-recipient override', async () => {
    process.env.ADMIN_COMMERCIAL_SMS_PHONE = '09120000000'

    await notifyAdminCommercialEvent({
      kind: 'SUBSCRIPTION_RENEWED',
      paymentId: paidSubscription.id,
      workspaceId: paidSubscription.workspaceId,
    })

    expect(mocks.sendSms).toHaveBeenCalledWith(
      '+989120000000',
      expect.stringContaining('تمدید اشتراک'),
    )
  })

  it('includes the top-up amount and resulting wallet balance for AI credit', async () => {
    mocks.paymentFindUnique.mockResolvedValueOnce({
      ...paidSubscription,
      id: 'payment-credit-1',
      kind: 'AI_CREDIT',
      plan: null,
      amount: 500_000,
      workspace: {
        ...paidSubscription.workspace,
        aiCreditBalanceIRR: 1_100_000,
      },
    })

    await notifyAdminCommercialEvent({
      kind: 'AI_CREDIT_TOPPED_UP',
      paymentId: 'payment-credit-1',
      workspaceId: paidSubscription.workspaceId,
    })

    const message = mocks.sendSms.mock.calls[0]?.[1] as string
    expect(message).toContain('شارژ اعتبار')
    expect(message).toContain('مبلغ شارژ:')
    expect(message).toContain('موجودی جدید:')
    expect(message).toContain('payment-credit-1')
  })

  it('formats a NowPayments subscription in USD with gateway reconciliation details', async () => {
    mocks.paymentFindUnique.mockResolvedValueOnce({
      ...paidSubscription,
      id: 'payment-usd-1',
      gateway: 'NOWPAYMENTS',
      amount: 49,
      currency: 'USD',
      externalId: 'nowpayments-transaction-9',
    })

    await notifyAdminCommercialEvent({
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: 'payment-usd-1',
      workspaceId: paidSubscription.workspaceId,
    })

    const message = mocks.sendSms.mock.calls[0]?.[1] as string
    expect(message).toContain(`${(49).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} دلار`)
    expect(message).toContain('درگاه: NOWPayments')
    expect(message).toContain('شناسه تراکنش درگاه: nowpayments-transaction-9')
  })

  it('never sends for a pending payment or a mismatched payment kind', async () => {
    mocks.paymentFindUnique.mockResolvedValueOnce({
      ...paidSubscription,
      status: 'PENDING',
      paidAt: null,
    })

    await expect(notifyAdminCommercialEvent({
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: paidSubscription.id,
      workspaceId: paidSubscription.workspaceId,
    })).resolves.toBe(false)

    mocks.paymentFindUnique.mockResolvedValueOnce(paidSubscription)
    await expect(notifyAdminCommercialEvent({
      kind: 'AI_CREDIT_TOPPED_UP',
      paymentId: paidSubscription.id,
      workspaceId: paidSubscription.workspaceId,
    })).resolves.toBe(false)
    expect(mocks.sendSms).not.toHaveBeenCalled()
  })

  it('captures SMS failures without throwing into the payment flow', async () => {
    mocks.sendSms.mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(notifyAdminCommercialEvent({
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: paidSubscription.id,
      workspaceId: paidSubscription.workspaceId,
    })).resolves.toBe(false)

    expect(mocks.captureError).toHaveBeenCalledWith(
      'billing:admin-commercial-sms',
      expect.any(Error),
      expect.objectContaining({ workspaceId: paidSubscription.workspaceId }),
    )
  })

  it('captures a false provider outcome without logging customer details', async () => {
    mocks.sendSms.mockResolvedValueOnce(false)

    await expect(notifyAdminCommercialEvent({
      kind: 'SUBSCRIPTION_PURCHASED',
      paymentId: paidSubscription.id,
      workspaceId: paidSubscription.workspaceId,
    })).resolves.toBe(false)

    expect(mocks.captureError).toHaveBeenCalledWith(
      'billing:admin-commercial-sms',
      expect.objectContaining({ message: 'SMS_DELIVERY_FAILED' }),
      {
        workspaceId: paidSubscription.workspaceId,
        metadata: {
          paymentId: paidSubscription.id,
          eventKind: 'SUBSCRIPTION_PURCHASED',
        },
      },
    )
  })
})
