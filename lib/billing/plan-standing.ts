import type { Plan } from '@prisma/client'

const DAY_MS = 86_400_000

/** Subscription period granted per successful payment; the trial runs as long. */
export const PERIOD_DAYS = 30

/** Seven days out a plan is ending soon; in its last two days, critically so. */
export const SOON_DAYS = 7
export const CRITICAL_DAYS = 2

/** How close a plan is to its end: drives the day badge and the renew prompt. */
export type PlanUrgency = 'ok' | 'soon' | 'critical' | 'expired'

/**
 * Which plan an account is on, whether that plan still grants access, and how
 * many days of its period are left.
 */
export type PlanStanding = {
  plan: Plan
  active: boolean
  /**
   * Whole days until the period ends, rounded up while it runs (the last
   * partial day counts as 1) and negative once it has ended (-3 = ended three
   * days ago). `null` when there is no end date at all.
   */
  daysLeft: number | null
}

/** Signed whole days from `now` to `end`, rounded away from zero. */
export function daysUntil(end: Date, now: Date = new Date()): number {
  const diff = end.getTime() - now.getTime()
  return diff >= 0 ? Math.ceil(diff / DAY_MS) : -Math.ceil(-diff / DAY_MS)
}

/**
 * The entitlement gate's rule (checkEntitlement) as a pure function, for
 * listings that already hold the dates: a trial runs until `trialEndsAt`, a
 * paid plan until the end of its ACTIVE subscription period.
 */
export function planStanding(
  input: {
    plan: Plan
    trialEndsAt: Date | null
    /** `currentPeriodEnd` of the workspace's ACTIVE subscription, if any. */
    periodEnd: Date | null
  },
  now: Date = new Date(),
): PlanStanding {
  const end = input.plan === 'TRIAL' ? input.trialEndsAt : input.periodEnd
  return {
    plan: input.plan,
    active: end !== null && end >= now,
    daysLeft: end === null ? null : daysUntil(end, now),
  }
}

export function planUrgency(standing: Pick<PlanStanding, 'active' | 'daysLeft'>): PlanUrgency {
  if (!standing.active || standing.daysLeft === null) return 'expired'
  if (standing.daysLeft <= CRITICAL_DAYS) return 'critical'
  if (standing.daysLeft <= SOON_DAYS) return 'soon'
  return 'ok'
}
