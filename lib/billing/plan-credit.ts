import type { Prisma } from '@prisma/client'
import { getPlanDefs, type PaidPlan } from '@/lib/billing/plans'

export type PlanCreditGrantResult = {
  granted: boolean
  grantKey: string
  amountIRR: number
  balanceAfterIRR: number
}

/** Stable key shared by every delivery/retry of the same paid checkout. */
export function planCreditGrantKey(paymentId: string): string {
  return `subscription-payment:${paymentId}`
}

/**
 * Grant the plan's included wallet credit exactly once. Call this inside the
 * same transaction that claims the subscription payment.
 */
export async function grantIncludedPlanCredit(
  tx: Prisma.TransactionClient,
  params: { paymentId: string; workspaceId: string; plan: PaidPlan },
): Promise<PlanCreditGrantResult> {
  const grantKey = planCreditGrantKey(params.paymentId)
  const existing = await tx.walletLedger.findUnique({
    where: { grantKey },
    select: { amountIRR: true, balanceAfterIRR: true },
  })
  if (existing) {
    return {
      granted: false,
      grantKey,
      amountIRR: existing.amountIRR,
      balanceAfterIRR: existing.balanceAfterIRR,
    }
  }

  const amountIRR = getPlanDefs()[params.plan].includedCreditIRR
  const workspace = await tx.workspace.update({
    where: { id: params.workspaceId },
    data: { aiCreditBalanceIRR: { increment: amountIRR } },
    select: { aiCreditBalanceIRR: true },
  })
  await tx.walletLedger.create({
    data: {
      workspaceId: params.workspaceId,
      paymentId: params.paymentId,
      grantKey,
      type: 'PLAN_CREDIT_GRANT',
      amountIRR,
      balanceAfterIRR: workspace.aiCreditBalanceIRR,
      note: `${params.plan} subscription included credit`,
    },
  })

  return {
    granted: true,
    grantKey,
    amountIRR,
    balanceAfterIRR: workspace.aiCreditBalanceIRR,
  }
}
