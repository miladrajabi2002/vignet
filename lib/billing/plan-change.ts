/**
 * Moving between paid plans mid-period.
 *
 * Upgrading always buys a full PERIOD_DAYS of the new plan, and the unused
 * part of the current plan is not lost: its value is re-priced as days on the
 * new plan and added on top. Example: Starter (۸۹۰ هزار تومان) with 20 of 30
 * days left is worth ۵۹۳ هزار; at Pro's ۲٫۴۹ میلیون that buys ≈ 7 days of
 * Pro, so paying for Pro today runs until today + 30 + 7 days.
 *
 * Downgrading is closed while the current plan runs: a smaller plan can be
 * bought once the current period has ended.
 */
import type { Plan } from '@prisma/client'
import { PAID_PLANS, PERIOD_DAYS, type PaidPlan } from '@/lib/billing/plans'

const DAY_MS = 86_400_000

export interface CurrentSubscription {
  plan: Plan
  status: string
  currentPeriodEnd: Date
  /** What the current period was paid, in `currency`. */
  monthlyPrice: number
  currency: string
}

export type PlanChange = 'new' | 'renew' | 'upgrade' | 'downgrade'

function live(sub: CurrentSubscription | null, now: Date): sub is CurrentSubscription {
  return !!sub && sub.status === 'ACTIVE' && sub.currentPeriodEnd > now
}

/** What buying `target` does to this subscription. */
export function planChange(sub: CurrentSubscription | null, target: PaidPlan, now: Date = new Date()): PlanChange {
  if (!live(sub, now)) return 'new'
  const from = PAID_PLANS.indexOf(sub.plan as PaidPlan)
  if (from < 0) return 'new'
  const to = PAID_PLANS.indexOf(target)
  return to === from ? 'renew' : to > from ? 'upgrade' : 'downgrade'
}

/**
 * The unused part of a live plan, as time on another plan:
 * remaining time × (what the current plan cost ÷ what the new one costs).
 * The paid prices are compared when both are in one currency; otherwise
 * `listRatio` (current list price ÷ new list price) stands in. 0 when the
 * plan is not changing or nothing is left.
 */
export function carryOverMs(
  sub: CurrentSubscription | null,
  target: { plan: PaidPlan; monthlyPrice: number; currency: string },
  listRatio: number,
  now: Date = new Date(),
): number {
  if (!live(sub, now) || sub.plan === target.plan) return 0
  const ratio = sub.currency === target.currency && sub.monthlyPrice > 0 && target.monthlyPrice > 0
    ? sub.monthlyPrice / target.monthlyPrice
    : listRatio
  if (!Number.isFinite(ratio) || ratio <= 0) return 0
  return Math.floor((sub.currentPeriodEnd.getTime() - now.getTime()) * ratio)
}

/** Whole days the carry-over adds (rounded down, so the promise is never short). */
export function carryOverDays(ms: number): number {
  return Math.floor(ms / DAY_MS)
}

/** Where a paid period on a new plan ends, carry-over included. */
export function upgradedPeriodEnd(carryMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + PERIOD_DAYS * DAY_MS + carryMs)
}
