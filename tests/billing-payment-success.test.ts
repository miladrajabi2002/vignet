import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  paymentUpdateMany: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
  workspaceUpdate: vi.fn(),
  walletLedgerCreate: vi.fn(),
  userFindFirst: vi.fn(),
  getEffectivePlanDefs: vi.fn(),
  sendSubscriptionPurchasedSms: vi.fn(),
  enqueueAdminCommercialSms: vi.fn(),
  processAdminCommercialSmsPayment: vi.fn(),
}))

const tx = {
  payment: { updateMany: mocks.paymentUpdateMany },
  subscription: {
    findUnique: mocks.subscriptionFindUnique,
    upsert: mocks.subscriptionUpsert,
  },
  workspace: { update: mocks.workspaceUpdate },
  walletLedger: { create: mocks.walletLedgerCreate },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    user: { findFirst: mocks.userFindFirst },
  },
}))

vi.mock('@/lib/redis', () => ({ getRedis: vi.fn() }))
vi.mock('@/lib/billing/plans', () => ({
  PERIOD_DAYS: 30,
  getEffectivePlanDefs: mocks.getEffectivePlanDefs,
}))
vi.mock('@/lib/sms/ippanel', () => ({
  sendSubscriptionPurchasedSms: mocks.sendSubscriptionPurchasedSms,
}))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/billing/admin-commercial-outbox', () => ({
  enqueueAdminCommercialSms: mocks.enqueueAdminCommercialSms,
  processAdminCommercialSmsPayment: mocks.processAdminCommercialSmsPayment,
}))

import { captureAiCreditTopupPayment } from '@/lib/billing/credit-topups'
import { activateSubscriptionPayment } from '@/lib/billing/entitlements'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (callback) => callback(tx))
  mocks.subscriptionFindUnique.mockResolvedValue(null)
  mocks.subscriptionUpsert.mockResolvedValue({})
  mocks.workspaceUpdate.mockResolvedValue({ aiCreditBalanceIRR: 900_000 })
  mocks.walletLedgerCreate.mockResolvedValue({})
  mocks.userFindFirst.mockResolvedValue({ phone: '+989121112233' })
  mocks.getEffectivePlanDefs.mockResolvedValue({
    STARTER: { maxChannels: 2 },
    PRO: { maxChannels: 5 },
    BUSINESS: { maxChannels: 20 },
  })
  mocks.sendSubscriptionPurchasedSms.mockResolvedValue(true)
  mocks.enqueueAdminCommercialSms.mockResolvedValue(undefined)
  mocks.processAdminCommercialSmsPayment.mockResolvedValue(true)
})

describe('commercial payment success hooks', () => {
  it('notifies once for a newly claimed subscription purchase and skips a retry', async () => {
    mocks.paymentUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    const params = {
      paymentId: 'payment-sub-1',
      workspaceId: 'workspace-1',
      plan: 'PRO' as const,
      monthlyPrice: 24_900_000,
      currency: 'IRR' as const,
      paymentUpdate: { status: 'PAID' as const, paidAt: new Date() },
    }

    await expect(activateSubscriptionPayment(params)).resolves.toBe(true)
    await expect(activateSubscriptionPayment(params)).resolves.toBe(false)

    expect(mocks.subscriptionUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledWith(
      tx,
      {
        kind: 'SUBSCRIPTION_PURCHASED',
        paymentId: 'payment-sub-1',
        workspaceId: 'workspace-1',
      },
    )
    expect(mocks.processAdminCommercialSmsPayment).toHaveBeenCalledTimes(1)
    expect(mocks.processAdminCommercialSmsPayment).toHaveBeenCalledWith('payment-sub-1')
  })

  it('classifies an active same-plan payment as a renewal', async () => {
    mocks.paymentUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      plan: 'STARTER',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 7 * 86_400_000),
    })

    await activateSubscriptionPayment({
      paymentId: 'payment-renewal-1',
      workspaceId: 'workspace-1',
      plan: 'STARTER',
      monthlyPrice: 8_900_000,
      currency: 'IRR',
      paymentUpdate: { status: 'PAID', paidAt: new Date() },
    })

    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledWith(
      tx,
      {
        kind: 'SUBSCRIPTION_RENEWED',
        paymentId: 'payment-renewal-1',
        workspaceId: 'workspace-1',
      },
    )
  })

  it.each([
    {
      label: 'lapsed',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() - 7 * 86_400_000),
    },
    {
      label: 'cancelled',
      status: 'CANCELLED',
      currentPeriodEnd: new Date(Date.now() + 7 * 86_400_000),
    },
  ])('classifies a $label same-plan repurchase as a renewal', async (existing) => {
    mocks.paymentUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      plan: 'PRO',
      status: existing.status,
      currentPeriodEnd: existing.currentPeriodEnd,
    })

    await activateSubscriptionPayment({
      paymentId: `payment-${existing.label}-renewal`,
      workspaceId: 'workspace-1',
      plan: 'PRO',
      monthlyPrice: 24_900_000,
      currency: 'IRR',
      paymentUpdate: { status: 'PAID', paidAt: new Date() },
    })

    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ kind: 'SUBSCRIPTION_RENEWED' }),
    )
  })

  it('classifies an active plan change as a new subscription purchase', async () => {
    mocks.paymentUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.subscriptionFindUnique.mockResolvedValueOnce({
      plan: 'STARTER',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 7 * 86_400_000),
    })

    await activateSubscriptionPayment({
      paymentId: 'payment-upgrade-1',
      workspaceId: 'workspace-1',
      plan: 'PRO',
      monthlyPrice: 24_900_000,
      currency: 'IRR',
      paymentUpdate: { status: 'PAID', paidAt: new Date() },
    })

    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ kind: 'SUBSCRIPTION_PURCHASED' }),
    )
  })

  it('adds what is left of the old plan, re-priced, on top of the 30 upgraded days', async () => {
    const now = new Date('2026-11-03T10:00:00Z')
    vi.useFakeTimers({ now })
    try {
      mocks.paymentUpdateMany.mockResolvedValueOnce({ count: 1 })
      mocks.subscriptionFindUnique.mockResolvedValueOnce({
        plan: 'STARTER',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(now.getTime() + 20 * 86_400_000),
        monthlyPrice: 8_900_000,
        currency: 'IRR',
      })
      mocks.getEffectivePlanDefs.mockResolvedValue({
        STARTER: { priceIRR: 8_900_000 },
        PRO: { priceIRR: 24_900_000 },
        BUSINESS: { priceIRR: 59_000_000 },
      })

      await activateSubscriptionPayment({
        paymentId: 'payment-upgrade-carry',
        workspaceId: 'workspace-1',
        plan: 'PRO',
        monthlyPrice: 24_900_000,
        currency: 'IRR',
        paymentUpdate: { status: 'PAID', paidAt: now },
      })

      const end = mocks.subscriptionUpsert.mock.calls[0][0].update.currentPeriodEnd as Date
      // 30 days of Pro + 20 days × 890k / 2.49M ≈ 7.15 days
      expect((end.getTime() - now.getTime()) / 86_400_000).toBeCloseTo(37.149, 2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('credits and notifies only the callback that claims an AI-credit payment', async () => {
    mocks.paymentUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    const params = {
      paymentId: 'payment-credit-1',
      workspaceId: 'workspace-1',
      amountIRR: 500_000,
      paymentUpdate: { status: 'PAID' as const, paidAt: new Date() },
    }

    await expect(captureAiCreditTopupPayment(params)).resolves.toBe(true)
    await expect(captureAiCreditTopupPayment(params)).resolves.toBe(false)

    expect(mocks.workspaceUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.walletLedgerCreate).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueAdminCommercialSms).toHaveBeenCalledWith(
      tx,
      {
        kind: 'AI_CREDIT_TOPPED_UP',
        paymentId: 'payment-credit-1',
        workspaceId: 'workspace-1',
      },
    )
    expect(mocks.processAdminCommercialSmsPayment).toHaveBeenCalledTimes(1)
    expect(mocks.processAdminCommercialSmsPayment).toHaveBeenCalledWith('payment-credit-1')
  })
})
