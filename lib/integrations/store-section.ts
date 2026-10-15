/**
 * Everything the WooCommerce tab shows about the connected store: the
 * connections with their recent sync log, the plan limits that block a sync
 * and the pending store-access choice.
 */
import { prisma } from '@/lib/prisma'
import type { StoreIntegrationItem } from '@/components/integrations/store-integrations-section'
import type { PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { loadStoreAccessChoice } from '@/lib/agents/store-access-choice'
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'
import { getEffectivePlanDefs, planResourceLimit, recommendedUpgradePlan, type LimitedPlanResource } from '@/lib/billing/plans'

export async function loadStoreSection(workspaceId: string) {
  const storeIntegrationsRaw = await prisma.storeIntegration.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      syncLogs: {
        // All events from the last 3 days (capped at 100).
        orderBy: { createdAt: 'desc' },
        where: { createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
        take: 100,
        select: { id: true, direction: true, entity: true, outcome: true, count: true, message: true, createdAt: true },
      },
      _count: { select: { orders: { where: { deletedAt: null } }, syncLogs: true, products: true } },
    },
  })

  const [storeAccessChoice, productCapacity, orderCapacity, customerCapacity, planDefs] = await Promise.all([
    loadStoreAccessChoice(workspaceId),
    checkWorkspaceResourceCreateAllowed(workspaceId, 'products'),
    checkWorkspaceResourceCreateAllowed(workspaceId, 'orders'),
    checkWorkspaceResourceCreateAllowed(workspaceId, 'customers'),
    getEffectivePlanDefs(),
  ])
  const capacities = [
    ['products', productCapacity],
    ['orders', orderCapacity],
    ['customers', customerCapacity],
  ] as const
  const planLimits: PlanLimitInfo[] = capacities.flatMap(([resource, capacity]) => {
    if (capacity.allowed) return []
    const recommendedPlan = recommendedUpgradePlan(planDefs, capacity.plan, resource as LimitedPlanResource, capacity.used)
    return [{
      resource,
      plan: capacity.plan,
      used: capacity.used,
      limit: capacity.limit,
      recommendedPlan,
      recommendedLimit: recommendedPlan ? planResourceLimit(planDefs[recommendedPlan], resource) : null,
    }]
  })

  // Strip encrypted credential ciphertext — only non-sensitive fields are visible.
  const integrations: StoreIntegrationItem[] = storeIntegrationsRaw.map((row) => ({
    id: row.id,
    type: row.type,
    storeUrl: row.storeUrl,
    webhookSecret: row.webhookSecret,
    pollIntervalMinutes: row.pollIntervalMinutes,
    active: row.active,
    connectedAt: row.connectedAt ? row.connectedAt.toISOString() : null,
    lastWebhookAt: row.lastWebhookAt ? row.lastWebhookAt.toISOString() : null,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncError: row.lastSyncError,
    _count: { orders: row._count.orders, syncLogs: row._count.syncLogs, products: row._count.products },
    syncLogs: row.syncLogs.map((log) => ({
      id: log.id,
      direction: log.direction,
      entity: log.entity,
      outcome: log.outcome,
      count: log.count,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  }))

  return { integrations, planLimits, storeAccessChoice }
}
