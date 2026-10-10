import type { ReactNode } from 'react'
import { PLAN_COLOR } from '@/components/admin/chart-palette'
import type { PlanStanding } from '@/lib/billing/plan-standing'
import { cn } from '@/lib/utils'

const EXPIRED_COLOR = '#ef4444' // red 500

const PLAN_NAME = {
  TRIAL: { fa: 'دوره آزمایشی', en: 'Trial' },
  STARTER: { fa: 'پلن استارتر', en: 'Starter plan' },
  PRO: { fa: 'پلن حرفه‌ای', en: 'Professional plan' },
  BUSINESS: { fa: 'پلن بیزینس', en: 'Business plan' },
} as const

/** What a ring says, in words: for its tooltip, screen readers and the legend. */
export function planStandingLabel(standing: PlanStanding, fa = true): string {
  const name = PLAN_NAME[standing.plan][fa ? 'fa' : 'en']
  if (standing.active) return standing.plan === 'TRIAL' ? name : `${name}، ${fa ? 'فعال' : 'active'}`
  return `${name}، ${fa ? 'پایان‌یافته' : 'expired'}`
}

/** The ring alone. A live subscription is a solid line; everything else is dashed. */
function RingStroke({ standing }: { standing: PlanStanding | null }) {
  if (!standing) return <circle cx="22" cy="22" r="20.5" fill="none" strokeWidth="1.5" className="stroke-black/[0.09]" />
  const subscribed = standing.active && standing.plan !== 'TRIAL'
  return (
    <circle
      cx="22"
      cy="22"
      r="20.5"
      pathLength={96}
      fill="none"
      strokeWidth="2.5"
      stroke={standing.active ? PLAN_COLOR[standing.plan] : EXPIRED_COLOR}
      strokeDasharray={subscribed ? undefined : '5 3'}
    />
  )
}

/**
 * An account's avatar inside a ring that tells its plan at a glance: the
 * colour is the plan, a solid line is a live subscription, a dashed grey one a
 * trial and a dashed red one a plan that has run out. Size it with `className`
 * (a square); the avatar fills the space the ring leaves.
 */
export function PlanRing({
  standing,
  fa = true,
  className,
  innerClassName,
  children,
}: {
  /** `null` when the account has no workspace: a faint hairline, no meaning. */
  standing: PlanStanding | null
  fa?: boolean
  className?: string
  innerClassName?: string
  children: ReactNode
}) {
  const label = standing ? planStandingLabel(standing, fa) : undefined
  return (
    <span title={label} className={cn('relative block shrink-0', className)}>
      <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0 h-full w-full">
        <RingStroke standing={standing} />
      </svg>
      <span aria-hidden="true" className={cn('absolute inset-[13%] grid place-items-center rounded-full', innerClassName)}>
        {children}
      </span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

const LEGEND: { standing: PlanStanding; fa: string; en: string }[] = [
  { standing: { plan: 'BUSINESS', active: true }, fa: 'بیزینس', en: 'Business' },
  { standing: { plan: 'PRO', active: true }, fa: 'حرفه‌ای', en: 'Professional' },
  { standing: { plan: 'STARTER', active: true }, fa: 'استارتر', en: 'Starter' },
  { standing: { plan: 'TRIAL', active: true }, fa: 'آزمایشی', en: 'Trial' },
  { standing: { plan: 'TRIAL', active: false }, fa: 'پایان‌یافته', en: 'Expired' },
]

/** The key to the rings, as one quiet wrapping row. */
export function PlanRingLegend({ fa = true, className }: { fa?: boolean; className?: string }) {
  return (
    <ul
      aria-label={fa ? 'راهنمای حلقهٔ دور پروفایل' : 'Avatar ring key'}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 text-[var(--text-muted)]', className)}
    >
      {LEGEND.map((item) => (
        <li key={item.en} className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 44 44" className="h-3.5 w-3.5 shrink-0">
            <RingStroke standing={item.standing} />
          </svg>
          {fa ? item.fa : item.en}
        </li>
      ))}
    </ul>
  )
}
