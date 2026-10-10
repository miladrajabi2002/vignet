import type { Plan } from '@prisma/client'

/** Which plan an account is on, and whether that plan still grants access. */
export type PlanStanding = { plan: Plan; active: boolean }

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
  return { plan: input.plan, active: end !== null && end >= now }
}
