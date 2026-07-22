import {
  enqueueAdminCommercialSms,
  processAdminCommercialSmsPayment,
} from '@/lib/billing/admin-commercial-outbox'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

type AiCreditTopupCapture = {
  paymentId: string
  workspaceId: string
  amountIRR: number
  paymentUpdate: Prisma.PaymentUpdateManyMutationInput
}

/**
 * Atomically claim a verified AI-credit payment and apply its wallet credit.
 * Only the callback that changes PENDING to PAID returns true and emits the
 * commercial notification; retries observe a zero-row claim and do nothing.
 */
export async function captureAiCreditTopupPayment(
  params: AiCreditTopupCapture,
): Promise<boolean> {
  const captured = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: {
        id: params.paymentId,
        workspaceId: params.workspaceId,
        kind: 'AI_CREDIT',
        status: 'PENDING',
      },
      data: params.paymentUpdate,
    })
    if (claimed.count !== 1) return false

    const workspace = await tx.workspace.update({
      where: { id: params.workspaceId },
      data: { aiCreditBalanceIRR: { increment: params.amountIRR } },
      select: { aiCreditBalanceIRR: true },
    })
    await tx.walletLedger.create({
      data: {
        workspaceId: params.workspaceId,
        paymentId: params.paymentId,
        type: 'CREDIT_TOPUP',
        amountIRR: params.amountIRR,
        balanceAfterIRR: workspace.aiCreditBalanceIRR,
        note: 'ZarinPay AI credit top-up',
      },
    })
    await enqueueAdminCommercialSms(tx, {
      kind: 'AI_CREDIT_TOPPED_UP',
      paymentId: params.paymentId,
      workspaceId: params.workspaceId,
    })
    return true
  })

  if (captured) {
    await processAdminCommercialSmsPayment(params.paymentId)
  }
  return captured
}
