import { type Tx } from '@/lib/prisma'
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
 * Grant the plan's included wallet credit exactly once — and only for the
 * workspace's FIRST successful subscription payment. The included credit is a
 * one-time acquisition bonus: renewals and plan switches extend the
 * subscription but must not re-grant it. Call this inside the same transaction
 * that claims the subscription payment.
 */
export async function grantIncludedPlanCredit(
  tx: Tx,
  params: { paymentId: string; workspaceId: string; plan: PaidPlan; amountIRR?: number },
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

  // First-purchase-only rule. Two belt-and-suspenders checks, both inside the
  // claiming transaction:
  //   1. any prior PLAN_CREDIT_GRANT ledger entry for this workspace — this is
  //      the authoritative "already received the one-time bonus" marker and
  //      stays correct even if plan prices change between purchases;
  //   2. any earlier PAID SUBSCRIPTION payment (excluding the one being
  //      claimed right now, which has already been flipped to PAID inside this
  //      transaction) — covers legacy workspaces whose first purchase predates
  //      the ledger, and covers plans whose included credit is configured as 0.
  const [priorGrant, priorSubscriptionPayment] = await Promise.all([
    tx.walletLedger.findFirst({
      where: { workspaceId: params.workspaceId, type: 'PLAN_CREDIT_GRANT' },
      select: { grantKey: true },
    }),
    tx.payment.findFirst({
      where: {
        workspaceId: params.workspaceId,
        kind: 'SUBSCRIPTION',
        status: 'PAID',
        id: { not: params.paymentId },
      },
      select: { id: true },
    }),
  ])
  if (priorGrant || priorSubscriptionPayment) {
    const balance = (await tx.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { aiCreditBalanceIRR: true },
    }))?.aiCreditBalanceIRR ?? 0
    return {
      granted: false,
      grantKey,
      amountIRR: 0,
      balanceAfterIRR: balance,
    }
  }

  const amountIRR = params.amountIRR ?? getPlanDefs()[params.plan].includedCreditIRR
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
      note: `${params.plan} subscription included credit (first purchase)`,
    },
  })

  return {
    granted: true,
    grantKey,
    amountIRR,
    balanceAfterIRR: workspace.aiCreditBalanceIRR,
  }
}
