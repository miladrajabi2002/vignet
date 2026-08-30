import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { getEffectivePlanDefs, PERIOD_DAYS, type PaidPlan } from '@/lib/billing/plans'
import {
  enqueueAdminCommercialSms,
  processAdminCommercialSmsPayment,
} from '@/lib/billing/admin-commercial-outbox'
import { sendSubscriptionPurchasedSms } from '@/lib/sms/ippanel'
import { captureError } from '@/lib/errors/capture'
import { grantIncludedPlanCredit } from '@/lib/billing/plan-credit'
import type { ChannelType, Plan, Prisma } from '@prisma/client'

/**
 * Single place that answers "may this workspace do X?".
 * Used by chat, agent-management, and channel-connection APIs.
 */

export type BlockReason = 'TRIAL_EXPIRED' | 'SUBSCRIPTION_EXPIRED' | 'CHANNEL_LIMIT'
export type ResourceLimitReason = 'PRODUCT_LIMIT' | 'ORDER_LIMIT' | 'CUSTOMER_LIMIT'
export type WorkspaceResource = 'products' | 'orders' | 'customers'
export type ChatGate = { allowed: true; plan: Plan } | { allowed: false; reason: BlockReason }
export type WorkspaceAccessGate = ChatGate
export type ChannelConnectionTarget =
  | { kind: 'AGENT_CHANNEL'; agentId: string; type: ChannelType }
  | { kind: 'CHAT_LINK'; agentId: string }

const RESOURCE_LIMIT_FIELD = {
  products: 'maxProducts',
  orders: 'maxOrders',
  customers: 'maxCustomers',
} as const

const RESOURCE_LIMIT_REASON: Record<WorkspaceResource, ResourceLimitReason> = {
  products: 'PRODUCT_LIMIT',
  orders: 'ORDER_LIMIT',
  customers: 'CUSTOMER_LIMIT',
}

export class WorkspaceResourceLimitError extends Error {
  constructor(
    public readonly resource: WorkspaceResource,
    public readonly limit: number,
  ) {
    super(RESOURCE_LIMIT_REASON[resource])
    this.name = 'WorkspaceResourceLimitError'
  }
}

async function resourceCount(
  client: Pick<Prisma.TransactionClient, 'product' | 'storeOrder' | 'contact'>,
  workspaceId: string,
  resource: WorkspaceResource,
): Promise<number> {
  if (resource === 'products') return client.product.count({ where: { workspaceId } })
  if (resource === 'orders') return client.storeOrder.count({ where: { workspaceId } })
  return client.contact.count({ where: { workspaceId } })
}

export async function getWorkspaceResourceLimit(
  workspaceId: string,
  resource: WorkspaceResource,
): Promise<{ plan: Plan; limit: number }> {
  const [workspace, defs] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } }),
    getEffectivePlanDefs(),
  ])
  const plan = workspace?.plan ?? 'TRIAL'
  return { plan, limit: defs[plan][RESOURCE_LIMIT_FIELD[resource]] }
}

/** Current usage gate used by both dashboard creates and store/CRM imports. */
export async function checkWorkspaceResourceCreateAllowed(
  workspaceId: string,
  resource: WorkspaceResource,
  additional = 1,
): Promise<{
  allowed: boolean
  plan: Plan
  limit: number
  used: number
  reason?: ResourceLimitReason
}> {
  const [{ plan, limit }, used] = await Promise.all([
    getWorkspaceResourceLimit(workspaceId, resource),
    resourceCount(prisma, workspaceId, resource),
  ])
  const allowed = used + Math.max(1, additional) <= limit
  return {
    allowed,
    plan,
    limit,
    used,
    ...(allowed ? {} : { reason: RESOURCE_LIMIT_REASON[resource] }),
  }
}

/** Re-check under the caller's transaction/lock before inserting a new row. */
export async function assertWorkspaceResourceCapacity(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  resource: WorkspaceResource,
  limit: number,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`resource-limit:${workspaceId}:${resource}`}))`
  const used = await resourceCount(tx, workspaceId, resource)
  if (used >= limit) throw new WorkspaceResourceLimitError(resource, limit)
}

/**
 * The workspace's plan label regardless of trial/subscription expiry. Used by
 * the Instagram free-tier exemptions below so plan-aware logic (model policy,
 * quota defs) keeps a usable plan key even when the gate is bypassed.
 */
export async function getNominalWorkspacePlan(workspaceId: string): Promise<Plan> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  })
  return ws?.plan ?? 'TRIAL'
}

/** Canonical workspace usage shared by enforcement and reporting surfaces. */
export async function getActiveChannelConnectionCount(workspaceId: string): Promise<number> {
  const [agentChannels, chatLinks] = await Promise.all([
    prisma.agentChannel.count({
      // CHAT_LINK uses the canonical ChatLink model below. Excluding any
      // historical AgentChannel rows prevents one public link counting twice.
      // INSTAGRAM is free — IG connections never consume the paid channel quota.
      where: {
        active: true,
        type: { notIn: ['CHAT_LINK', 'INSTAGRAM'] },
        agent: { workspaceId },
      },
    }),
    prisma.chatLink.count({ where: { workspaceId, enabled: true } }),
  ])
  return agentChannels + chatLinks
}

function monthKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Count captured assistant replies this calendar month (one UsageLog CHAT row per
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
    where: { workspaceId, type: 'CHAT', status: 'CAPTURED', date: { gte: monthStart } },
  })

  try {
    await getRedis().set(cacheKey, String(count), 'EX', 60)
  } catch {
    /* best-effort cache */
  }
  return count
}

/**
 * Gate an inbound chat message by workspace access only. Successful AI replies
 * are already protected by the atomic reply-credit reservation flow; there is
 * intentionally no separate monthly message quota.
 *
 * Instagram automation is free: conversations arriving on an INSTAGRAM channel
 * are never blocked by trial/subscription expiry.
 */
export async function checkChatAllowed(
  workspaceId: string,
  channel?: ChannelType,
): Promise<ChatGate> {
  if (channel === 'INSTAGRAM') {
    return { allowed: true, plan: await getNominalWorkspacePlan(workspaceId) }
  }
  return checkWorkspaceActive(workspaceId)
}

/** Shared trial/subscription gate for every state-changing paid feature. */
export async function checkWorkspaceActive(workspaceId: string): Promise<WorkspaceAccessGate> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, trialEndsAt: true },
  })
  if (!ws) return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' }

  const now = new Date()
  if (ws.plan === 'TRIAL') {
    if (!ws.trialEndsAt || ws.trialEndsAt < now) {
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

  return { allowed: true, plan: ws.plan }
}

/**
 * May this workspace activate one more customer-facing channel connection?
 * Existing active connections may always be reconfigured. Both AgentChannel
 * rows and enabled ChatLink rows consume the same workspace-level allowance.
 */
export async function checkChannelConnectAllowed(
  workspaceId: string,
  target: ChannelConnectionTarget,
): Promise<WorkspaceAccessGate> {
  // Instagram automation is free: IG connections bypass trial/subscription
  // gates entirely and never consume the paid channel quota.
  if (target.kind === 'AGENT_CHANNEL' && target.type === 'INSTAGRAM') {
    return { allowed: true, plan: await getNominalWorkspacePlan(workspaceId) }
  }

  const access = await checkWorkspaceActive(workspaceId)
  if (!access.allowed) return access

  const existingActive = target.kind === 'CHAT_LINK'
    ? await prisma.chatLink.findUnique({
        where: { agentId: target.agentId },
        select: { enabled: true },
      }).then((link) => link?.enabled === true)
    : await prisma.agentChannel.findUnique({
        where: { agentId_type: { agentId: target.agentId, type: target.type } },
        select: { active: true },
      }).then((channel) => channel?.active === true)

  if (existingActive) return access

  const [defs, count] = await Promise.all([
    getEffectivePlanDefs(),
    getActiveChannelConnectionCount(workspaceId),
  ])
  return count < defs[access.plan].maxChannels
    ? access
    : { allowed: false, reason: 'CHANNEL_LIMIT' }
}

type SubscriptionActivation = {
  workspaceId: string
  plan: PaidPlan
  monthlyPrice: number
  currency: 'IRR' | 'USD'
}

async function persistSubscription(
  tx: Prisma.TransactionClient,
  params: SubscriptionActivation,
): Promise<{ currentPeriodEnd: Date; renewed: boolean }> {
  const { workspaceId, plan, monthlyPrice, currency } = params
  const now = new Date()

  const existing = await tx.subscription.findUnique({
    where: { workspaceId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  })

  const extendsCurrentPeriod = Boolean(
    existing &&
    existing.status === 'ACTIVE' &&
    existing.plan === plan &&
    existing.currentPeriodEnd > now,
  )
  // A returning customer buying the same plan is a renewal even after lapse or
  // cancellation. Period arithmetic is stricter: only an active, unexpired
  // same-plan subscription extends from its existing end date.
  const renewed = Boolean(existing && existing.plan === plan)
  const base = extendsCurrentPeriod && existing ? existing.currentPeriodEnd : now
  const currentPeriodEnd = new Date(base.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000)

  await tx.subscription.upsert({
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
    })
  await tx.workspace.update({
      where: { id: workspaceId },
      data: { plan: plan as Plan },
    })
  return { currentPeriodEnd, renewed }
}

async function sendPurchaseConfirmation(
  workspaceId: string,
  plan: PaidPlan,
  currentPeriodEnd: Date,
): Promise<void> {

  // Fire-and-forget purchase-confirmation SMS to the workspace owner. Never
  // throws — a failed SMS must not break the activation that already succeeded.
  try {
    const owner = await prisma.user.findFirst({
      where: { workspaceId },
      select: { phone: true },
    })
    if (owner?.phone) {
      await sendSubscriptionPurchasedSms(owner.phone, {
        plan,
        currentPeriodEnd,
      })
    }
  } catch (e) {
    captureError('billing:purchase-sms', e, { workspaceId })
  }
}

/**
 * Atomically claims a verified subscription payment and activates/extends the
 * subscription in the same database transaction. Duplicate gateway callbacks
 * therefore cannot extend the plan twice, and a crash cannot leave a PAID row
 * without the corresponding subscription update.
 */
export async function activateSubscriptionPayment(params: SubscriptionActivation & {
  paymentId: string
  paymentUpdate: Prisma.PaymentUpdateManyMutationInput
}): Promise<boolean> {
  const includedCreditIRR = (await getEffectivePlanDefs())[params.plan].includedCreditIRR
  const activation = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: {
        id: params.paymentId,
        workspaceId: params.workspaceId,
        kind: 'SUBSCRIPTION',
        plan: params.plan,
        status: 'PENDING',
      },
      data: params.paymentUpdate,
    })
    if (claimed.count !== 1) return null
    const subscription = await persistSubscription(tx, params)
    await grantIncludedPlanCredit(tx, {
      paymentId: params.paymentId,
      workspaceId: params.workspaceId,
      plan: params.plan,
      amountIRR: includedCreditIRR,
    })
    await enqueueAdminCommercialSms(tx, {
      kind: subscription.renewed ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_PURCHASED',
      paymentId: params.paymentId,
      workspaceId: params.workspaceId,
    })
    return subscription
  })

  if (activation) {
    await Promise.all([
      sendPurchaseConfirmation(
        params.workspaceId,
        params.plan,
        activation.currentPeriodEnd,
      ),
      processAdminCommercialSmsPayment(params.paymentId),
    ])
  }
  return activation !== null
}
