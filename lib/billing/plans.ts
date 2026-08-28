import type { Plan } from '@prisma/client'
import { MODEL_ALIASES, type ModelAlias } from '@/lib/ai/models'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'

/**
 * Plan catalog — the subscription pays for platform/service capacity while AI
 * replies are prepaid and deducted from the workspace wallet. There is no
 * plan-level message quota; availability is governed by subscription state and
 * the workspace's reply-credit balance.
 *
 * Env overrides (all optional):
 *   PLAN_PRICE_STARTER_IRR / PLAN_PRICE_PRO_IRR / PLAN_PRICE_BUSINESS_IRR
 *   PLAN_PRICE_STARTER_USD / PLAN_PRICE_PRO_USD / PLAN_PRICE_BUSINESS_USD
 *   PLAN_INCLUDED_CREDIT_STARTER_IRR / PLAN_INCLUDED_CREDIT_PRO_IRR / PLAN_INCLUDED_CREDIT_BUSINESS_IRR
 *   PLAN_LIMIT_TRIAL_CHANNELS / PLAN_LIMIT_STARTER_CHANNELS / PLAN_LIMIT_PRO_CHANNELS / PLAN_LIMIT_BUSINESS_CHANNELS
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

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback
}

function envNonNegativeInt(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback
}

export function getPlanDefs(): Record<Plan, PlanDef> {
  return {
    TRIAL: {
      plan: 'TRIAL',
      priceIRR: 0,
      priceUSD: 0,
      maxChannels: envInt('PLAN_LIMIT_TRIAL_CHANNELS', envInt('PLAN_LIMIT_TRIAL_AGENTS', 1)),
      maxProducts: envInt('PLAN_LIMIT_TRIAL_PRODUCTS', 50),
      maxOrders: envInt('PLAN_LIMIT_TRIAL_ORDERS', 100),
      maxCustomers: envInt('PLAN_LIMIT_TRIAL_CUSTOMERS', 100),
      replyDiscountBps: 0,
      includedCreditIRR: 0,
    },
    STARTER: {
      plan: 'STARTER',
      priceIRR: envInt('PLAN_PRICE_STARTER_IRR', 8_900_000),
      priceUSD: envInt('PLAN_PRICE_STARTER_USD', 9),
      maxChannels: envInt('PLAN_LIMIT_STARTER_CHANNELS', envInt('PLAN_LIMIT_STARTER_AGENTS', 2)),
      maxProducts: envInt('PLAN_LIMIT_STARTER_PRODUCTS', 500),
      maxOrders: envInt('PLAN_LIMIT_STARTER_ORDERS', 2_000),
      maxCustomers: envInt('PLAN_LIMIT_STARTER_CUSTOMERS', 2_000),
      replyDiscountBps: 0,
      includedCreditIRR: envNonNegativeInt('PLAN_INCLUDED_CREDIT_STARTER_IRR', 2_000_000),
    },
    PRO: {
      plan: 'PRO',
      priceIRR: envInt('PLAN_PRICE_PRO_IRR', 24_900_000),
      priceUSD: envInt('PLAN_PRICE_PRO_USD', 25),
      maxChannels: envInt('PLAN_LIMIT_PRO_CHANNELS', envInt('PLAN_LIMIT_PRO_AGENTS', 5)),
      maxProducts: envInt('PLAN_LIMIT_PRO_PRODUCTS', 2_500),
      maxOrders: envInt('PLAN_LIMIT_PRO_ORDERS', 10_000),
      maxCustomers: envInt('PLAN_LIMIT_PRO_CUSTOMERS', 10_000),
      replyDiscountBps: 0,
      includedCreditIRR: envNonNegativeInt('PLAN_INCLUDED_CREDIT_PRO_IRR', 6_000_000),
    },
    BUSINESS: {
      plan: 'BUSINESS',
      priceIRR: envInt('PLAN_PRICE_BUSINESS_IRR', 59_000_000),
      priceUSD: envInt('PLAN_PRICE_BUSINESS_USD', 59),
      maxChannels: envInt('PLAN_LIMIT_BUSINESS_CHANNELS', envInt('PLAN_LIMIT_BUSINESS_AGENTS', 20)),
      maxProducts: envInt('PLAN_LIMIT_BUSINESS_PRODUCTS', 10_000),
      maxOrders: envInt('PLAN_LIMIT_BUSINESS_ORDERS', 50_000),
      maxCustomers: envInt('PLAN_LIMIT_BUSINESS_CUSTOMERS', 50_000),
      replyDiscountBps: 0,
      includedCreditIRR: envNonNegativeInt('PLAN_INCLUDED_CREDIT_BUSINESS_IRR', 15_000_000),
    },
  }
}

/** DB-backed runtime catalog. Environment values remain first-deploy fallbacks. */
export async function getEffectivePlanDefs(): Promise<Record<Plan, PlanDef>> {
  const config = await getPlatformCommercialConfig()
  return Object.fromEntries(
    (Object.keys(config.plans) as Plan[]).map((plan) => [plan, { plan, ...config.plans[plan] }]),
  ) as Record<Plan, PlanDef>
}

export const PAID_PLANS = ['STARTER', 'PRO', 'BUSINESS'] as const satisfies readonly Plan[]
export type PaidPlan = (typeof PAID_PLANS)[number]

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
