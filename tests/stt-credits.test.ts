import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rootUsageFind: vi.fn(), rootWorkspaceFind: vi.fn(),
  txUsageFind: vi.fn(), txUsageCreate: vi.fn(),
  txWorkspaceFind: vi.fn(), txWorkspaceFindOrThrow: vi.fn(), txWorkspaceUpdateMany: vi.fn(),
  txLedgerCreate: vi.fn(),
}))

const tx = {
  usageLog: { findUnique: mocks.txUsageFind, create: mocks.txUsageCreate },
  workspace: {
    findUnique: mocks.txWorkspaceFind,
    findUniqueOrThrow: mocks.txWorkspaceFindOrThrow,
    updateMany: mocks.txWorkspaceUpdateMany,
  },
  walletLedger: { create: mocks.txLedgerCreate },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usageLog: { findUnique: mocks.rootUsageFind },
    workspace: { findUnique: mocks.rootWorkspaceFind },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}))

import { calculateSttChargeIRR, captureSttCredit, ensureSttCreditAvailable } from '@/lib/billing/stt-credits'

describe('STT wallet charging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.txUsageFind.mockResolvedValue(null)
    mocks.txWorkspaceUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txWorkspaceFindOrThrow.mockResolvedValue({ aiCreditBalanceIRR: 9_000 })
    mocks.txUsageCreate.mockResolvedValue({ id: 'usage-1' })
    mocks.txLedgerCreate.mockResolvedValue({ id: 'ledger-1' })
  })

  it('prices one minute at 10 toman and ten minutes at 100 toman', () => {
    expect(calculateSttChargeIRR(60, 100)).toBe(100)
    expect(calculateSttChargeIRR(600, 100)).toBe(1_000)
    expect(calculateSttChargeIRR(30, 100)).toBe(50)
  })

  it('atomically debits the proportional charge and records duration', async () => {
    const result = await captureSttCredit({
      workspaceId: 'workspace-1', agentId: 'agent-1',
      model: 'openai/whisper-large-v3-turbo', audioSeconds: 600,
      pricePerMinuteIRR: 100, providerRequestId: 'generation-1',
      providerCostUSD: 0.03, idempotencyKey: 'stt:event-1',
    })

    expect(result).toEqual({ chargeIRR: 1_000, balanceAfterIRR: 9_000 })
    expect(mocks.txWorkspaceUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ aiCreditBalanceIRR: { gte: 1_000 } }),
      data: { aiCreditBalanceIRR: { decrement: 1_000 } },
    }))
    expect(mocks.txUsageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      audioSeconds: 600, chargedIRR: 1_000, status: 'CAPTURED', type: 'STT',
    }) })
    expect(mocks.txLedgerCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      amountIRR: -1_000, balanceAfterIRR: 9_000,
    }) })
  })

  it('does not debit again for the same idempotency key', async () => {
    mocks.txUsageFind.mockResolvedValue({ id: 'usage-1', workspaceId: 'workspace-1', chargedIRR: 50 })
    mocks.txWorkspaceFind.mockResolvedValue({ aiCreditBalanceIRR: 950 })

    const result = await captureSttCredit({
      workspaceId: 'workspace-1', model: 'openai/whisper-large-v3-turbo',
      audioSeconds: 30, pricePerMinuteIRR: 100, idempotencyKey: 'stt:event-1',
    })

    expect(result).toEqual({ chargeIRR: 50, balanceAfterIRR: 950 })
    expect(mocks.txWorkspaceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txUsageCreate).not.toHaveBeenCalled()
  })

  it('blocks an empty wallet before calling the provider', async () => {
    mocks.rootUsageFind.mockResolvedValue(null)
    mocks.rootWorkspaceFind.mockResolvedValue({ aiCreditBalanceIRR: 0 })
    await expect(ensureSttCreditAvailable('workspace-1', 'stt:event-1')).rejects.toThrow('NO_CREDIT')
  })
})
