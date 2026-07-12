import { prisma } from '@/lib/prisma'
import { getPlanDefs } from '@/lib/billing/plans'
import { getReplyPriceIRR, resolveModelAlias, type ModelAlias } from '@/lib/ai/models'
import type { ChatUsage } from '@/lib/ai/openrouter'
import { discountedReplyPriceIRR } from '@/lib/billing/credit-estimates'
import { processLowCreditAlert } from '@/lib/billing/low-credit-alert'

export type CreditReservation = {
  usageLogId: string
  chargeIRR: number
  balanceAfterIRR: number
  modelAlias: ModelAlias
}

export type ReserveCreditResult =
  | { ok: true; reservation: CreditReservation }
  | { ok: false; reason: 'NO_CREDIT' | 'WORKSPACE_NOT_FOUND' }

export async function getReplyChargeIRR(
  workspaceId: string,
  model: string | null | undefined,
): Promise<number | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  })
  if (!workspace) return null
  const def = getPlanDefs()[workspace.plan]
  return discountedReplyPriceIRR(getReplyPriceIRR(model), def.replyDiscountBps)
}

/**
 * Atomically reserve the fixed price of one successful AI reply.
 * The available balance is reduced before the provider call, preventing
 * concurrent requests from overspending the same wallet credit.
 */
export async function reserveChatCredit(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  model: string | null | undefined
  providerModel: string
  idempotencyKey: string
}): Promise<ReserveCreditResult> {
  const alias = resolveModelAlias(params.model)

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const existing = await tx.usageLog.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      })
      if (existing) {
        const ws = await tx.workspace.findUnique({
          where: { id: params.workspaceId },
          select: { aiCreditBalanceIRR: true },
        })
        return {
          usageLogId: existing.id,
          chargeIRR: existing.chargedIRR,
          balanceAfterIRR: ws?.aiCreditBalanceIRR ?? 0,
          modelAlias: alias,
        }
      }

      const workspace = await tx.workspace.findUnique({
        where: { id: params.workspaceId },
        select: { plan: true },
      })
      if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')

      const def = getPlanDefs()[workspace.plan]
      const chargeIRR = discountedReplyPriceIRR(
        getReplyPriceIRR(alias),
        def.replyDiscountBps,
      )

      const claimed = await tx.workspace.updateMany({
        where: {
          id: params.workspaceId,
          aiCreditBalanceIRR: { gte: chargeIRR },
        },
        data: {
          aiCreditBalanceIRR: { decrement: chargeIRR },
          aiCreditReservedIRR: { increment: chargeIRR },
        },
      })
      if (claimed.count !== 1) throw new Error('NO_CREDIT')

      const [balance, usageLog] = await Promise.all([
        tx.workspace.findUniqueOrThrow({
          where: { id: params.workspaceId },
          select: { aiCreditBalanceIRR: true },
        }),
        tx.usageLog.create({
          data: {
            workspaceId: params.workspaceId,
            agentId: params.agentId,
            conversationId: params.conversationId,
            model: params.providerModel,
            type: 'CHAT',
            status: 'RESERVED',
            chargedIRR: chargeIRR,
            idempotencyKey: params.idempotencyKey,
          },
        }),
      ])

      await tx.walletLedger.create({
        data: {
          workspaceId: params.workspaceId,
          usageLogId: usageLog.id,
          type: 'AI_CHARGE',
          amountIRR: -chargeIRR,
          balanceAfterIRR: balance.aiCreditBalanceIRR,
          note: `AI reply (${alias}) reserved`,
        },
      })

      return {
        usageLogId: usageLog.id,
        chargeIRR,
        balanceAfterIRR: balance.aiCreditBalanceIRR,
        modelAlias: alias,
      }
    })

    return { ok: true, reservation }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'WORKSPACE_NOT_FOUND') {
      return { ok: false, reason: 'WORKSPACE_NOT_FOUND' }
    }
    if (message === 'NO_CREDIT') return { ok: false, reason: 'NO_CREDIT' }

    // A concurrent retry can hit the idempotency unique constraint after the
    // first transaction commits. Resolve it as the same reservation.
    const existing = await prisma.usageLog.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    })
    if (existing) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: params.workspaceId },
        select: { aiCreditBalanceIRR: true },
      })
      return {
        ok: true,
        reservation: {
          usageLogId: existing.id,
          chargeIRR: existing.chargedIRR,
          balanceAfterIRR: workspace?.aiCreditBalanceIRR ?? 0,
          modelAlias: alias,
        },
      }
    }
    throw error
  }
}

/** Finalize a reservation with provider tokens and exact USD cost. */
export async function captureChatCredit(
  reservation: CreditReservation,
  usage: ChatUsage | null,
): Promise<void> {
  const workspaceId = await prisma.$transaction(async (tx) => {
    const row = await tx.usageLog.findUnique({
      where: { id: reservation.usageLogId },
      select: { status: true, workspaceId: true, chargedIRR: true },
    })
    if (!row || row.status !== 'RESERVED') return null

    const updated = await tx.usageLog.updateMany({
      where: { id: reservation.usageLogId, status: 'RESERVED' },
      data: {
        status: 'CAPTURED',
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        reasoningTokens: usage?.reasoningTokens ?? 0,
        cachedTokens: usage?.cachedTokens ?? 0,
        providerRequestId: usage?.providerRequestId ?? null,
        cost: usage?.costUSD ?? null,
      },
    })
    if (updated.count !== 1) return null

    await tx.workspace.update({
      where: { id: row.workspaceId },
      data: { aiCreditReservedIRR: { decrement: row.chargedIRR } },
    })
    return row.workspaceId
  })

  if (workspaceId) {
    // Only a successful capture can warn. The durable alert + SMS fanout run
    // outside the chat path, so notification/provider failures cannot delay or
    // break the reply the customer already received.
    void processLowCreditAlert({
      workspaceId,
      modelAlias: reservation.modelAlias,
      replyPriceIRR: reservation.chargeIRR,
    })
  }
}

/** Refund a failed/aborted reply exactly once. */
export async function releaseChatCredit(
  reservation: CreditReservation,
  note = 'AI reply failed',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await tx.usageLog.findUnique({
      where: { id: reservation.usageLogId },
      select: { status: true, workspaceId: true, chargedIRR: true },
    })
    if (!row || row.status !== 'RESERVED') return

    const released = await tx.usageLog.updateMany({
      where: { id: reservation.usageLogId, status: 'RESERVED' },
      data: { status: 'RELEASED', chargedIRR: 0 },
    })
    if (released.count !== 1) return

    const workspace = await tx.workspace.update({
      where: { id: row.workspaceId },
      data: {
        aiCreditBalanceIRR: { increment: row.chargedIRR },
        aiCreditReservedIRR: { decrement: row.chargedIRR },
      },
      select: { aiCreditBalanceIRR: true },
    })
    await tx.walletLedger.create({
      data: {
        workspaceId: row.workspaceId,
        usageLogId: reservation.usageLogId,
        type: 'AI_REFUND',
        amountIRR: row.chargedIRR,
        balanceAfterIRR: workspace.aiCreditBalanceIRR,
        note,
      },
    })
  })
}
