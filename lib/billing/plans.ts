import type { Plan } from '@prisma/client'
import { MODEL_ALIASES, type ModelAlias } from '@/lib/ai/models'
import { DEFAULT_COMMERCIAL_CONFIG, getPlatformCommercialConfig } from '@/lib/platform/commercial-config'

/**
 * Plan catalog — the subscription pays for platform/service capacity while AI
 * replies are prepaid and deducted from the workspace wallet. There is no
 * plan-level message quota; availability is governed by subscription state and
 * the workspace's reply-credit balance.
 *
 * Prices, limits and included credit are edited in the admin panel
 * (PlatformAiSettings.planConfig); DEFAULT_COMMERCIAL_CONFIG is the fallback
 * until the panel is saved.
 */

export interface PlanDef {
  plan: Plan
  /** Monthly price in Iranian Rials (ZarinPay). 0 = free/trial. */
  priceIRR: number
  /** Monthly price in USD (NowPayments / crypto). 0 = free/trial. */
  priceUSD: number
  /** Maximum active channel connections across the workspace. */
  maxChannels: number
  /** Maximum stored catalog products, store orders, and CRM customers. */
  maxProducts: number
  maxOrders: number
  maxCustomers: number
  /** Legacy compatibility field. Reply prices are global across every plan. */
  replyDiscountBps: number
  /** Wallet credit granted once for each successful subscription payment. */
  includedCreditIRR: number
}

/** Built-in plan catalog (no DB). Runtime code should use getEffectivePlanDefs. */
export function getPlanDefs(): Record<Plan, PlanDef> {
  return Object.fromEntries(
    (Object.keys(DEFAULT_COMMERCIAL_CONFIG.plans) as Plan[]).map((plan) => [plan, { plan, ...DEFAULT_COMMERCIAL_CONFIG.plans[plan] }]),
  ) as Record<Plan, PlanDef>
}

/** DB-backed runtime catalog, edited in the admin panel. */
export async function getEffectivePlanDefs(): Promise<Record<Plan, PlanDef>> {
  const config = await getPlatformCommercialConfig()
  return Object.fromEntries(
    (Object.keys(config.plans) as Plan[]).map((plan) => [plan, { plan, ...config.plans[plan] }]),
  ) as Record<Plan, PlanDef>
}

export const PAID_PLANS = ['STARTER', 'PRO', 'BUSINESS'] as const satisfies readonly Plan[]
export type PaidPlan = (typeof PAID_PLANS)[number]

export type LimitedPlanResource = 'products' | 'orders' | 'customers' | 'channels'

const PLAN_RESOURCE_LIMIT_FIELD: Record<LimitedPlanResource, keyof Pick<PlanDef,
  'maxProducts' | 'maxOrders' | 'maxCustomers' | 'maxChannels'
>> = {
  products: 'maxProducts',
  orders: 'maxOrders',
  customers: 'maxCustomers',
  channels: 'maxChannels',
}

export function planResourceLimit(def: PlanDef, resource: LimitedPlanResource): number {
  return def[PLAN_RESOURCE_LIMIT_FIELD[resource]]
}

/**
 * Pick the smallest real upgrade that can hold the workspace's next item.
 * Plans at or below the current tier are intentionally excluded, even when
 * their runtime limits were customized to unusual values by an admin.
 */
export function recommendedUpgradePlan(
  defs: Record<Plan, PlanDef>,
  currentPlan: Plan,
  resource: LimitedPlanResource,
  used: number,
): PaidPlan | null {
  const currentIndex = currentPlan === 'TRIAL'
    ? -1
    : PAID_PLANS.indexOf(currentPlan as PaidPlan)
  const field = PLAN_RESOURCE_LIMIT_FIELD[resource]
  return PAID_PLANS.find((plan, index) => index > currentIndex && defs[plan][field] > used) ?? null
}

export function isPaidPlan(p: string): p is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(p)
}

export async function getEffectivePlanReplyPricesIRR(plan: Plan): Promise<Record<ModelAlias, number>> {
  void plan // Kept in the public signature for backwards-compatible callers.
  const commercial = await getPlatformCommercialConfig()
  return Object.fromEntries(
    MODEL_ALIASES.map((alias) => [
      alias,
      commercial.replyPricesIRR[alias],
    ]),
  ) as Record<ModelAlias, number>
}

/** Subscription period granted per successful payment. */
export const PERIOD_DAYS = 30
