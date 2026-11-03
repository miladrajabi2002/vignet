/**
 * How many products the connected store really has.
 *
 * The plan limit refuses products past its cap, so Vigent alone only ever
 * sees "full" — a Starter workspace with a 10,000-product store looked the
 * same as one with 501, and the warning suggested the next plan up even when
 * that one could not hold the store either. The plugin (after 5.2.2) reports its
 * catalog size with each push; the warning uses it to say how many products
 * are missing and which plan brings all of them in.
 */
import type { PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { prisma } from '@/lib/prisma'
import { planResourceLimit, recommendedUpgradePlan, type PlanDef } from '@/lib/billing/plans'
import type { Plan } from '@prisma/client'

const MAX_CATALOG_SIZE = 10_000_000

/** The plugin's `X-Vigent-Catalog-Size` header; undefined when absent or garbled. */
export function catalogSizeFromHeaders(req: Request): number | undefined {
  const raw = req.headers.get('x-vigent-catalog-size')?.trim()
  if (!raw || !/^\d{1,8}$/.test(raw)) return undefined
  const size = Number(raw)
  return size <= MAX_CATALOG_SIZE ? size : undefined
}

/** Remember the reported size; a no-op when it has not changed. */
export async function recordCatalogSize(integrationId: string, size: number): Promise<void> {
  await prisma.storeIntegration.updateMany({
    where: { id: integrationId, OR: [{ catalogProductCount: null }, { catalogProductCount: { not: size } }] },
    data: { catalogProductCount: size },
  })
}

/** The biggest catalog among the workspace's live stores; null when none reported. */
export async function storeCatalogTotal(workspaceId: string): Promise<number | null> {
  const row = await prisma.storeIntegration.aggregate({
    where: { workspaceId, active: true, catalogProductCount: { not: null } },
    _max: { catalogProductCount: true },
  })
  return row._max.catalogProductCount ?? null
}

/**
 * The product-allowance notice. With a reported store size above what is
 * stored, the recommendation is the smallest plan that holds the whole store;
 * null when even the biggest plan cannot (the notice then points at support).
 */
export function productPlanLimit(
  defs: Record<Plan, PlanDef>,
  capacity: { plan: Plan; used: number; limit: number },
  storeTotal: number | null,
): PlanLimitInfo {
  const needed = storeTotal != null && storeTotal > capacity.used ? storeTotal : null
  // recommendedUpgradePlan looks for room for one more item past `used`.
  const recommendedPlan = recommendedUpgradePlan(defs, capacity.plan, 'products', needed != null ? needed - 1 : capacity.used)
  return {
    resource: 'products',
    plan: capacity.plan,
    used: capacity.used,
    limit: capacity.limit,
    recommendedPlan,
    recommendedLimit: recommendedPlan ? planResourceLimit(defs[recommendedPlan], 'products') : null,
    storeTotal: needed,
  }
}
