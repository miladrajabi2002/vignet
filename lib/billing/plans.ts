import type { Plan } from '@prisma/client'

/**
 * Plan catalog — the subscription pays for platform/service capacity while AI
 * replies are prepaid and deducted from the workspace wallet. `monthlyMessages`
 * is an unadvertised abuse/safety ceiling, not a purchased message bundle.
 *
 * Env overrides (all optional):
 *   PLAN_PRICE_STARTER_IRR / PLAN_PRICE_PRO_IRR / PLAN_PRICE_BUSINESS_IRR
 *   PLAN_PRICE_STARTER_USD / PLAN_PRICE_PRO_USD / PLAN_PRICE_BUSINESS_USD
 *   PLAN_LIMIT_TRIAL_MSGS / PLAN_LIMIT_STARTER_MSGS / PLAN_LIMIT_PRO_MSGS / PLAN_LIMIT_BUSINESS_MSGS
 *   PLAN_LIMIT_TRIAL_AGENTS / PLAN_LIMIT_STARTER_AGENTS / PLAN_LIMIT_PRO_AGENTS / PLAN_LIMIT_BUSINESS_AGENTS
 */

export interface PlanDef {
  plan: Plan
  /** Monthly price in Iranian Rials (ZarinPay). 0 = free/trial. */
  priceIRR: number
  /** Monthly price in USD (NowPayments / crypto). 0 = free/trial. */
  priceUSD: number
  /** Assistant replies per calendar month across all agents/channels. */
  monthlyMessages: number
  maxAgents: number
  /** Discount applied to fixed per-reply wallet prices (1000 = 10%). */
  replyDiscountBps: number
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
      monthlyMessages: envInt('PLAN_LIMIT_TRIAL_MSGS', 100),
      maxAgents: envInt('PLAN_LIMIT_TRIAL_AGENTS', 1),
      replyDiscountBps: 0,
    },
    STARTER: {
      plan: 'STARTER',
      priceIRR: envInt('PLAN_PRICE_STARTER_IRR', 8_900_000),
      priceUSD: envInt('PLAN_PRICE_STARTER_USD', 9),
      monthlyMessages: envInt('PLAN_LIMIT_STARTER_MSGS', 25_000),
      maxAgents: envInt('PLAN_LIMIT_STARTER_AGENTS', 2),
      replyDiscountBps: envNonNegativeInt('PLAN_REPLY_DISCOUNT_STARTER_BPS', 0),
    },
    PRO: {
      plan: 'PRO',
      priceIRR: envInt('PLAN_PRICE_PRO_IRR', 24_900_000),
      priceUSD: envInt('PLAN_PRICE_PRO_USD', 25),
      monthlyMessages: envInt('PLAN_LIMIT_PRO_MSGS', 150_000),
      maxAgents: envInt('PLAN_LIMIT_PRO_AGENTS', 5),
      replyDiscountBps: envNonNegativeInt('PLAN_REPLY_DISCOUNT_PRO_BPS', 1_000),
    },
    BUSINESS: {
      plan: 'BUSINESS',
      priceIRR: envInt('PLAN_PRICE_BUSINESS_IRR', 59_000_000),
      priceUSD: envInt('PLAN_PRICE_BUSINESS_USD', 59),
      monthlyMessages: envInt('PLAN_LIMIT_BUSINESS_MSGS', 1_000_000),
      maxAgents: envInt('PLAN_LIMIT_BUSINESS_AGENTS', 20),
      replyDiscountBps: envNonNegativeInt('PLAN_REPLY_DISCOUNT_BUSINESS_BPS', 2_000),
    },
  }
}

export const PAID_PLANS = ['STARTER', 'PRO', 'BUSINESS'] as const satisfies readonly Plan[]
export type PaidPlan = (typeof PAID_PLANS)[number]

export function isPaidPlan(p: string): p is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(p)
}

/** Subscription period granted per successful payment. */
export const PERIOD_DAYS = 30
