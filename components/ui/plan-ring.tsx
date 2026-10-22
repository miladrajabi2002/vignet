import type { Plan } from '@prisma/client'
import { Crown, Gem, Hourglass, Rocket, UserRound, type LucideIcon } from 'lucide-react'
import { PLAN_COLOR } from '@/components/admin/chart-palette'
import { PERIOD_DAYS, planUrgency, type PlanStanding, type PlanUrgency } from '@/lib/billing/plan-standing'
import { cn } from '@/lib/utils'

const EXPIRED_COLOR = '#ef4444' // red 500
const TRACK_COLOR = '#e9e7e3'

/** One icon per plan, wherever a plan is drawn. */
export const PLAN_ICON: Record<Plan, LucideIcon> = {
  TRIAL: Hourglass,
  STARTER: Rocket,
  PRO: Gem,
  BUSINESS: Crown,
}

export const PLAN_SHORT_NAME: Record<Plan, { fa: string; en: string }> = {
  TRIAL: { fa: 'آزمایشی', en: 'Trial' },
  STARTER: { fa: 'استارتر', en: 'Starter' },
  PRO: { fa: 'حرفه‌ای', en: 'Professional' },
  BUSINESS: { fa: 'سازمانی', en: 'Business' },
}

const PLAN_NAME: Record<Plan, { fa: string; en: string }> = {
  TRIAL: { fa: 'دوره آزمایشی', en: 'Trial' },
  STARTER: { fa: 'پلن استارتر', en: 'Starter plan' },
  PRO: { fa: 'پلن حرفه‌ای', en: 'Professional plan' },
  BUSINESS: { fa: 'پلن سازمانی', en: 'Business plan' },
}

/** The avatar's fill and the icon's colour: a quiet tint of the plan's ring colour. */
const PLAN_TONE: Record<Plan, { tint: string; ink: string }> = {
  TRIAL: { tint: '#f3f2ef', ink: '#55524c' },
  STARTER: { tint: '#f3f0ff', ink: '#6d5ae0' },
  PRO: { tint: '#ece8ff', ink: '#4a2fd0' },
  BUSINESS: { tint: '#ecebe8', ink: '#111111' },
}
const EXPIRED_TONE = { tint: '#fef2f2', ink: '#b91c1c' }

/** Text colour for a days-left phrase, by urgency. */
export const URGENCY_TEXT: Record<PlanUrgency, string> = {
  ok: 'text-[var(--text-muted)]',
  soon: 'text-amber-700',
  critical: 'text-red-700',
  expired: 'text-red-700',
}

function digits(value: number, fa: boolean) {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

/** "12 days left", "ends today", "ended 3 days ago". */
export function planDaysLabel(standing: PlanStanding, fa = true): string {
  const { daysLeft } = standing
  if (!standing.active || daysLeft === null) {
    if (daysLeft === null || daysLeft >= 0) return fa ? 'پایان‌یافته' : 'Expired'
    const ago = digits(-daysLeft, fa)
    return fa ? `${ago} روز پیش تمام شد` : `Ended ${ago} day${daysLeft === -1 ? '' : 's'} ago`
  }
  if (daysLeft === 0) return fa ? 'امروز تمام می‌شود' : 'Ends today'
  const left = digits(daysLeft, fa)
  return fa ? `${left} روز مانده` : `${left} day${daysLeft === 1 ? '' : 's'} left`
}

/** What a ring says, in words: for its tooltip, screen readers and the legend. */
export function planStandingLabel(standing: PlanStanding, fa = true): string {
  return `${PLAN_NAME[standing.plan][fa ? 'fa' : 'en']} · ${planDaysLabel(standing, fa)}`
}

/** The ring alone: a track, and an arc as long as the days left in the period. */
function RingStroke({ standing }: { standing: PlanStanding | null }) {
  if (!standing) return <circle cx="22" cy="22" r="20.5" fill="none" strokeWidth="1.5" className="stroke-black/[0.09]" />
  if (planUrgency(standing) === 'expired') {
    return <circle cx="22" cy="22" r="20.5" pathLength={96} fill="none" strokeWidth="2.5" stroke={EXPIRED_COLOR} strokeDasharray="5 3" />
  }
  const share = Math.max(2, Math.min(100, ((standing.daysLeft ?? 0) / PERIOD_DAYS) * 100))
  return (
    <>
      <circle cx="22" cy="22" r="20.5" fill="none" strokeWidth="2.5" stroke={TRACK_COLOR} />
      <circle
        cx="22"
        cy="22"
        r="20.5"
        pathLength={100}
        fill="none"
        strokeWidth="2.75"
        strokeLinecap="round"
        stroke={PLAN_COLOR[standing.plan]}
        strokeDasharray={`${share} 100`}
        transform="rotate(-90 22 22)"
      />
    </>
  )
}

const BADGE_TONE: Record<PlanUrgency, string> = {
  ok: 'bg-white text-black shadow-[0_0_0_1px_rgba(0,0,0,0.1)]',
  soon: 'bg-amber-600 text-white',
  critical: 'bg-red-600 text-white',
  expired: 'bg-red-600 text-white',
}

/**
 * An account's plan at a glance: the plan's icon inside a ring whose colour is
 * the plan and whose arc is the share of the 30-day period still left. With
 * `showDays`, a small badge under it counts the days and turns amber in the
 * last week and red in the last two days. A plan that has run out gets a
 * dashed red ring. Size it with `className` (a square).
 */
export function PlanRing({
  standing,
  fa = true,
  showDays = false,
  className,
  badgeClassName,
}: {
  /** `null` when the account has no workspace: a faint hairline and a person icon. */
  standing: PlanStanding | null
  fa?: boolean
  showDays?: boolean
  className?: string
  /** Match the badge's cut-out border to the surface behind it (white by default). */
  badgeClassName?: string
}) {
  const label = standing ? planStandingLabel(standing, fa) : fa ? 'بدون فضای کاری' : 'No workspace'
  const urgency = standing ? planUrgency(standing) : null
  const tone = !standing ? null : urgency === 'expired' ? EXPIRED_TONE : PLAN_TONE[standing.plan]
  const Icon = standing ? PLAN_ICON[standing.plan] : UserRound
  const badgeTone = urgency === 'ok' && standing?.plan === 'TRIAL'
    ? 'bg-[#f3f2ef] text-[#55524c] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]'
    : urgency ? BADGE_TONE[urgency] : ''
  return (
    <span title={label} className={cn('relative block shrink-0', className)}>
      <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0 h-full w-full overflow-visible">
        <RingStroke standing={standing} />
      </svg>
      <span
        aria-hidden="true"
        className={cn('absolute inset-[14%] grid place-items-center rounded-full', !tone && 'bg-[var(--bg-muted)] text-[var(--text-muted)]')}
        style={tone ? { background: tone.tint, color: tone.ink } : undefined}
      >
        <Icon className="h-[48%] w-[48%] stroke-[2]" />
      </span>
      {showDays && standing && urgency && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-1.5 left-1/2 grid h-[1.0625rem] min-w-[1.375rem] -translate-x-1/2 place-items-center whitespace-nowrap rounded-full border-2 border-white px-1 text-[10.5px] font-extrabold leading-none tabular-nums',
            badgeTone,
            badgeClassName,
          )}
        >
          {urgency === 'expired' ? (fa ? 'تمام' : 'End') : digits(Math.max(0, standing.daysLeft ?? 0), fa)}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}

const LEGEND_PLANS: Plan[] = ['TRIAL', 'STARTER', 'PRO', 'BUSINESS']

/** The key to the rings, as one quiet wrapping row: the plan icons, then what the badge means. */
export function PlanRingLegend({ fa = true, showDays = false, className }: { fa?: boolean; showDays?: boolean; className?: string }) {
  return (
    <ul
      aria-label={fa ? 'راهنمای حلقهٔ دور پروفایل' : 'Avatar ring key'}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 text-[var(--text-muted)]', className)}
    >
      {LEGEND_PLANS.map((plan) => {
        const Icon = PLAN_ICON[plan]
        return (
          <li key={plan} className="inline-flex items-center gap-1.5">
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 stroke-[2]" style={{ color: PLAN_TONE[plan].ink }} />
            {PLAN_SHORT_NAME[plan][fa ? 'fa' : 'en']}
          </li>
        )
      })}
      <li className="inline-flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 44 44" className="h-3.5 w-3.5 shrink-0">
          <circle cx="22" cy="22" r="19" pathLength={96} fill="none" strokeWidth="4" stroke={EXPIRED_COLOR} strokeDasharray="5 3" />
        </svg>
        {fa ? 'پایان‌یافته' : 'Expired'}
      </li>
      {showDays && <li>{fa ? 'عدد زیر حلقه = روز مانده' : 'Number under the ring = days left'}</li>}
    </ul>
  )
}
