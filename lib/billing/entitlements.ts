import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { getPlanDefs, PERIOD_DAYS, type PaidPlan } from '@/lib/billing/plans'
import type { Plan } from '@prisma/client'

/**
 * Single place that answers "may this workspace do X?".
 * Used by the chat engine (every inbound message) and the agents API.
 */

export type BlockReason = 'TRIAL_EXPIRED' | 'SUBSCRIPTION_EXPIRED' | 'PLAN_LIMIT'
export type ChatGate = { allowed: true } | { allowed: false; reason: BlockReason }

function monthKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Count assistant replies this calendar month (one UsageLog CHAT row per
 * turn). DB is the source of truth; a short Redis cache keeps the hot chat
 * path from re-counting on every message.
 */
export async function getMonthlyMessageCount(workspaceId: string): Promise<number> {
  const cacheKey = `usage:msgs:${workspaceId}:${monthKey()}`
  try {
    const cached = await getRedis().get(cacheKey)
    if (cached !== null) return Number(cached)
  } catch {
    /* cache miss path below */
  }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const count = await prisma.usageLog.count({
    where: { workspaceId, type: 'CHAT', date: { gte: monthStart } },
  })

  try {
    await getRedis().set(cacheKey, String(count), 'EX', 60)
  } catch {
    /* best-effort cache */
  }
  return count
}

/**
 * Gate an inbound chat message. Blocks when:
 *  - TRIAL workspace past `trialEndsAt`
 *  - paid plan without an ACTIVE, unexpired subscription
 *  - monthly message quota exhausted
 */
export async function checkChatAllowed(workspaceId: string): Promise<ChatGate> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, trialEndsAt: true },
  })
  if (!ws) return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' }

  const now = new Date()
  if (ws.plan === 'TRIAL') {
    if (ws.trialEndsAt && ws.trialEndsAt < now) {
      return { allowed: false, reason: 'TRIAL_EXPIRED' }
    }
  } else {
    const sub = await prisma.subscription.findUnique({
      where: { workspaceId },
      select: { status: true, currentPeriodEnd: true },
    })
    if (!sub || sub.status !== 'ACTIVE' || sub.currentPeriodEnd < now) {
      return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' }
    }
  }

  const limit = getPlanDefs()[ws.plan].monthlyMessages
  const used = await getMonthlyMessageCount(workspaceId)
  if (used >= limit) return { allowed: false, reason: 'PLAN_LIMIT' }

  return { allowed: true }
}

/** May this workspace create one more agent? */
export async function checkAgentCreateAllowed(workspaceId: string): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  })
  if (!ws) return false
  const [limit, count] = [
    getPlanDefs()[ws.plan].maxAgents,
    await prisma.agent.count({ where: { workspaceId } }),
  ]
  return count < limit
}

/**
 * Activate (or extend) a subscription after a verified payment.
 * Extends from the current period end when still active, so early renewals
 * never lose paid days. Also flips `Workspace.plan`.
 */
export async function activateSubscription(params: {
  workspaceId: string
  plan: PaidPlan
  monthlyPrice: number
  currency: 'IRR' | 'USD'
}): Promise<void> {
  const { workspaceId, plan, monthlyPrice, currency } = params
  const now = new Date()

  const existing = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  })

  // Same-plan renewal while active → extend; upgrade/lapsed → fresh period.
  const base =
    existing &&
    existing.status === 'ACTIVE' &&
    existing.plan === plan &&
    existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now
  const currentPeriodEnd = new Date(base.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        plan: plan as Plan,
        status: 'ACTIVE',
        monthlyPrice,
        currency,
        currentPeriodEnd,
      },
      update: {
        plan: plan as Plan,
        status: 'ACTIVE',
        monthlyPrice,
        currency,
        currentPeriodEnd,
      },
    }),
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: plan as Plan },
    }),
  ])
}
