import { prisma } from '@/lib/prisma'

export type SttUsageCapture = {
  workspaceId: string
  agentId?: string
  conversationId?: string | null
  model: string
  audioSeconds: number
  pricePerMinuteIRR: number
  providerRequestId?: string | null
  providerCostUSD?: number | null
  promptTokens?: number
  completionTokens?: number
  idempotencyKey: string
}

/** Proportional STT charge, rounded only to the smallest wallet unit (one rial). */
export function calculateSttChargeIRR(audioSeconds: number, pricePerMinuteIRR: number): number {
  if (!Number.isFinite(audioSeconds) || audioSeconds <= 0) throw new Error('STT_DURATION_MISSING')
  if (!Number.isFinite(pricePerMinuteIRR) || pricePerMinuteIRR <= 0) throw new Error('STT_PRICE_INVALID')
  return Math.max(1, Math.ceil((audioSeconds * Math.round(pricePerMinuteIRR)) / 60))
}

/** Avoid a paid provider request when the wallet is already empty. */
export async function ensureSttCreditAvailable(workspaceId: string, idempotencyKey: string): Promise<void> {
  const [existing, workspace] = await Promise.all([
    prisma.usageLog.findUnique({ where: { idempotencyKey }, select: { workspaceId: true } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { aiCreditBalanceIRR: true } }),
  ])
  if (existing?.workspaceId === workspaceId) return
  if (!workspace || workspace.aiCreditBalanceIRR <= 0) throw new Error('NO_CREDIT')
}

/** Atomically debit the exact-duration charge and write usage + wallet audit rows. */
export async function captureSttCredit(params: SttUsageCapture): Promise<{
  chargeIRR: number
  balanceAfterIRR: number
}> {
  const chargeIRR = calculateSttChargeIRR(params.audioSeconds, params.pricePerMinuteIRR)

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.usageLog.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        select: { id: true, workspaceId: true, chargedIRR: true },
      })
      if (existing) {
        if (existing.workspaceId !== params.workspaceId) throw new Error('STT_IDEMPOTENCY_CONFLICT')
        const workspace = await tx.workspace.findUnique({
          where: { id: params.workspaceId },
          select: { aiCreditBalanceIRR: true },
        })
        return { chargeIRR: existing.chargedIRR, balanceAfterIRR: workspace?.aiCreditBalanceIRR ?? 0 }
      }

      const claimed = await tx.workspace.updateMany({
        where: { id: params.workspaceId, aiCreditBalanceIRR: { gte: chargeIRR } },
        data: { aiCreditBalanceIRR: { decrement: chargeIRR } },
      })
      if (claimed.count !== 1) throw new Error('NO_CREDIT')

      const balance = await tx.workspace.findUniqueOrThrow({
        where: { id: params.workspaceId },
        select: { aiCreditBalanceIRR: true },
      })
      const usage = await tx.usageLog.create({
        data: {
          workspaceId: params.workspaceId,
          agentId: params.agentId,
          conversationId: params.conversationId ?? null,
          type: 'STT',
          model: params.model,
          audioSeconds: params.audioSeconds,
          promptTokens: params.promptTokens ?? 0,
          completionTokens: params.completionTokens ?? 0,
          providerRequestId: params.providerRequestId ?? null,
          cost: params.providerCostUSD ?? null,
          chargedIRR: chargeIRR,
          status: 'CAPTURED',
          idempotencyKey: params.idempotencyKey,
        },
      })
      await tx.walletLedger.create({
        data: {
          workspaceId: params.workspaceId,
          usageLogId: usage.id,
          type: 'AI_CHARGE',
          amountIRR: -chargeIRR,
          balanceAfterIRR: balance.aiCreditBalanceIRR,
          note: `Voice transcription (${params.model}, ${params.audioSeconds.toFixed(2)}s)`,
        },
      })
      return { chargeIRR, balanceAfterIRR: balance.aiCreditBalanceIRR }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'NO_CREDIT' || message === 'STT_IDEMPOTENCY_CONFLICT') throw error

    // A concurrent retry may lose the unique-key race after the first debit commits.
    const existing = await prisma.usageLog.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { workspaceId: true, chargedIRR: true },
    })
    if (existing?.workspaceId === params.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: params.workspaceId },
        select: { aiCreditBalanceIRR: true },
      })
      return { chargeIRR: existing.chargedIRR, balanceAfterIRR: workspace?.aiCreditBalanceIRR ?? 0 }
    }
    throw error
  }
}
