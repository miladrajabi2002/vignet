import type { Prisma } from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { grantIncludedPlanCredit } from '@/lib/billing/plan-credit'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('included plan credit grant', () => {
  it('grants once per payment id and only for the workspace’s first subscription payment', async () => {
    vi.stubEnv('PLAN_INCLUDED_CREDIT_STARTER_IRR', '2000000')
    let balanceIRR = 100_000
    const entries = new Map<string, { amountIRR: number; balanceAfterIRR: number }>()
    // Workspace → list of PAID SUBSCRIPTION payment ids (first-purchase marker #2).
    const paidSubscriptionPayments = new Map<string, string[]>()
    // Track which workspaces already hold a PLAN_CREDIT_GRANT (first-purchase
    // marker #1) — populated by walletLedger.create below.
    const ledgerWorkspaces = new Set<string>()

    const tx = {
      walletLedger: {
        findUnique: vi.fn(async ({ where }: { where: { grantKey: string } }) =>
          entries.get(where.grantKey) ?? null),
        findFirst: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
          ledgerWorkspaces.has(where.workspaceId) ? { id: 'ledger_1' } : null),
        create: vi.fn(async ({ data }: {
          data: { grantKey: string; workspaceId: string; amountIRR: number; balanceAfterIRR: number }
        }) => {
          entries.set(data.grantKey, {
            amountIRR: data.amountIRR,
            balanceAfterIRR: data.balanceAfterIRR,
          })
          ledgerWorkspaces.add(data.workspaceId)
          return data
        }),
      },
      payment: {
        findFirst: vi.fn(async ({ where }: { where: { workspaceId: string; id: { not: string } } }) =>
          (paidSubscriptionPayments.get(where.workspaceId) ?? []).some((id) => id !== where.id.not)
            ? { id: 'prior_payment' }
            : null),
      },
      workspace: {
        update: vi.fn(async ({ data }: {
          data: { aiCreditBalanceIRR: { increment: number } }
        }) => {
          balanceIRR += data.aiCreditBalanceIRR.increment
          return { aiCreditBalanceIRR: balanceIRR }
        }),
        findUnique: vi.fn(async () => ({ aiCreditBalanceIRR: balanceIRR })),
      },
    } as unknown as import('@/lib/prisma').Tx

    // 1) The workspace's first subscription payment grants the credit.
    const params = { paymentId: 'pay_1', workspaceId: 'ws_1', plan: 'STARTER' as const }
    const first = await grantIncludedPlanCredit(tx, params)
    // 2) A gateway retry of the same payment must not double-grant.
    const retry = await grantIncludedPlanCredit(tx, params)
    // 3) A later renewal (different payment id, same workspace) must NOT
    //    re-grant the one-time acquisition bonus.
    paidSubscriptionPayments.set('ws_1', ['pay_1'])
    const renewal = await grantIncludedPlanCredit(tx, { ...params, paymentId: 'pay_2' })
    // 4) A different workspace's first purchase still grants.
    const otherWorkspace = await grantIncludedPlanCredit(tx, {
      paymentId: 'pay_3',
      workspaceId: 'ws_2',
      plan: 'STARTER' as const,
    })

    expect(first).toMatchObject({ granted: true, amountIRR: 2_000_000 })
    expect(retry).toMatchObject({ granted: false, amountIRR: 2_000_000 })
    expect(renewal).toMatchObject({ granted: false, amountIRR: 0 })
    expect(otherWorkspace).toMatchObject({ granted: true })
    expect(balanceIRR).toBe(4_100_000) // ws_1: 100k + 2m gift; ws_2: + 2m (STARTER env default)
    expect(tx.workspace.update).toHaveBeenCalledTimes(2) // first purchase per workspace
    expect(tx.walletLedger.create).toHaveBeenCalledTimes(2)
  })
})
