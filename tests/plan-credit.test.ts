import type { Prisma } from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { grantIncludedPlanCredit } from '@/lib/billing/plan-credit'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('included plan credit grant', () => {
  it('increments the wallet and writes one separate ledger row per payment id', async () => {
    vi.stubEnv('PLAN_INCLUDED_CREDIT_STARTER_IRR', '2000000')
    let balanceIRR = 100_000
    const entries = new Map<string, { amountIRR: number; balanceAfterIRR: number }>()

    const tx = {
      walletLedger: {
        findUnique: vi.fn(async ({ where }: { where: { grantKey: string } }) =>
          entries.get(where.grantKey) ?? null),
        create: vi.fn(async ({ data }: {
          data: { grantKey: string; amountIRR: number; balanceAfterIRR: number }
        }) => {
          entries.set(data.grantKey, {
            amountIRR: data.amountIRR,
            balanceAfterIRR: data.balanceAfterIRR,
          })
          return data
        }),
      },
      workspace: {
        update: vi.fn(async ({ data }: {
          data: { aiCreditBalanceIRR: { increment: number } }
        }) => {
          balanceIRR += data.aiCreditBalanceIRR.increment
          return { aiCreditBalanceIRR: balanceIRR }
        }),
      },
    } as unknown as Prisma.TransactionClient

    const params = { paymentId: 'pay_1', workspaceId: 'ws_1', plan: 'STARTER' as const }
    const first = await grantIncludedPlanCredit(tx, params)
    const retry = await grantIncludedPlanCredit(tx, params)

    expect(first).toMatchObject({ granted: true, amountIRR: 2_000_000 })
    expect(retry).toMatchObject({ granted: false, amountIRR: 2_000_000 })
    expect(balanceIRR).toBe(2_100_000)
    expect(tx.workspace.update).toHaveBeenCalledTimes(1)
    expect(tx.walletLedger.create).toHaveBeenCalledTimes(1)
  })
})
