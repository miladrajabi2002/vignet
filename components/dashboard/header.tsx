import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { Building2, ChevronRight, Gem, Hourglass, LogOut, Rocket, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import { getVerticalPack, type BusinessTypeValue, type CapabilityKey } from '@/lib/verticals/registry'
import { AdminPanelButton, UserSwitcher } from '@/components/dashboard/user-switcher'
import { cn } from '@/lib/utils'
import { PERIOD_DAYS } from '@/lib/billing/plans'
import { ImprovementActivityIndicator } from '@/components/dashboard/improvement-activity-indicator'
import { AnimatedNumber } from '@/components/dashboard/animated-number'
import { SupportButton } from '@/components/dashboard/support-button'

const PLAN_PRESENTATION = {
  TRIAL: { fa: 'دوره آزمایشی', en: 'Trial', icon: Hourglass },
  STARTER: { fa: 'پلن استارتر', en: 'Starter plan', icon: Rocket },
  PRO: { fa: 'پلن حرفه‌ای', en: 'Professional plan', icon: Gem },
  BUSINESS: { fa: 'پلن بیزینس', en: 'Business plan', icon: Building2 },
} as const satisfies Record<Plan, {
  fa: string
  en: string
  icon: LucideIcon
}>

type PlanState = {
  PlanIcon: LucideIcon
  periodProgress: number | null
  expired: boolean
  isTrial: boolean
}

/** Plan icon inside its billing-period progress ring. */
function PlanBadge({
  compact = false,
  PlanIcon,
  periodProgress,
  expired,
  isTrial,
}: PlanState & { compact?: boolean }) {
  return (
    <span className={cn(
      'relative grid shrink-0 place-items-center',
      compact ? 'h-9 w-9' : 'h-10 w-10 xl:h-12 xl:w-12',
    )}>
      <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="22" cy="22" r="19" fill="none" strokeWidth="2" className="stroke-black/[0.09]" />
        {periodProgress !== null && (
          <circle
            cx="22"
            cy="22"
            r="19"
            pathLength={100}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ strokeDasharray: `${periodProgress} 100` }}
            className={cn(
              'transition-[stroke-dasharray] duration-300 motion-reduce:transition-none',
              expired
                ? 'stroke-red-500'
                : isTrial || periodProgress <= 20
                  ? 'stroke-amber-500'
                  : 'stroke-black',
            )}
          />
        )}
      </svg>
      <span className={cn(
        'grid place-items-center rounded-full border shadow-[var(--shadow-xs)]',
        compact ? 'h-7 w-7' : 'h-8 w-8 xl:h-9 xl:w-9',
        expired
          ? 'border-red-200 bg-red-50 text-red-700'
          : isTrial
            ? 'border-amber-200/80 bg-amber-50 text-amber-700'
            : 'border-black/[0.06] bg-[var(--bg-surface)] text-black',
      )}>
        <PlanIcon aria-hidden="true" className={cn('stroke-[1.9]', compact ? 'h-3.5 w-3.5' : 'h-4 w-4 xl:h-[1.05rem] xl:w-[1.05rem]')} />
      </span>
    </span>
  )
}

/** "<credit> toman - <n> days" line under the plan or account name. */
function PlanCredit({
  compact = false,
  fa,
  creditToman,
  active,
  daysLeft,
  nf,
}: {
  compact?: boolean
  fa: boolean
  creditToman: number
  active: boolean
  daysLeft: number | null
  nf: Intl.NumberFormat
}) {
  return (
    <span className={cn(
      'block min-w-0 truncate whitespace-nowrap text-[12px] leading-4 text-[var(--text-muted)]',
      compact ? 'mt-0.5' : 'mt-1 xl:text-[12px]',
    )}>
      <span className="font-bold tabular-nums text-[var(--text-secondary)]"><AnimatedNumber value={creditToman} locale={fa ? 'fa-IR' : 'en-US'} /></span>
      <span className="ms-1">{fa ? 'تومان' : 'toman'}</span>
      {active && daysLeft !== null && (
        <>
          <span aria-hidden="true" className="mx-1 text-[var(--text-muted)]">-</span>
          <span className="tabular-nums">{fa ? `${nf.format(daysLeft)} روز` : `${nf.format(daysLeft)} days`}</span>
        </>
      )}
    </span>
  )
}

function HeaderPlan({
  compact = false,
  fa,
  PlanIcon,
  planTitle,
  billingLabel,
  creditToman,
  periodProgress,
  daysLeft,
  active,
  expired,
  isTrial,
  statusLabel,
  nf,
}: {
  compact?: boolean
  fa: boolean
  PlanIcon: LucideIcon
  planTitle: string
  billingLabel: string
  creditToman: number
  periodProgress: number | null
  daysLeft: number | null
  active: boolean
  expired: boolean
  isTrial: boolean
  statusLabel: string
  nf: Intl.NumberFormat
}) {
  return (
    <Link
      href="/billing"
      dir={fa ? 'rtl' : 'ltr'}
      aria-label={billingLabel}
      className={cn(
        'spatial-press group flex min-w-0 items-center border border-black/[0.08] bg-white/90 text-[var(--text-primary)] shadow-[var(--elev-1)] outline-none transition-[border-color,box-shadow,transform] duration-200 hover:border-black/[0.15] hover:shadow-[var(--elev-1)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none',
        compact
          ? 'h-12 w-full max-w-[16rem] gap-2 rounded-control px-1.5 pe-2.5'
          : 'h-14 w-[14rem] gap-2.5 rounded-card px-3 lg:w-[14.5rem] xl:h-[4.25rem] xl:w-[16rem] xl:rounded-card xl:px-3.5',
      )}
    >
      <PlanBadge compact={compact} PlanIcon={PlanIcon} periodProgress={periodProgress} expired={expired} isTrial={isTrial} />

      <span className="min-w-0 flex-1">
        <span className={cn(
          'flex min-w-0 items-center font-bold text-[var(--text-primary)]',
          compact ? 'text-[12px] leading-4' : 'text-[13px] leading-4 xl:text-[15px] xl:leading-5',
        )}>
          <span className="truncate">{planTitle}</span>
          <span className="ms-1.5 inline-flex shrink-0 items-center gap-1" aria-label={statusLabel}>
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                active
                  ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.09)]'
                  : expired
                    ? 'bg-red-500'
                    : 'bg-zinc-400',
              )}
            />
            <span className={cn(
              'text-[12px] font-medium',
              active ? 'text-emerald-700' : expired ? 'text-red-600' : 'text-[var(--text-muted)]',
            )}>
              {statusLabel}
            </span>
          </span>
        </span>

        <PlanCredit compact={compact} fa={fa} creditToman={creditToman} active={active} daysLeft={daysLeft} nf={nf} />
      </span>

      {!compact && (
        <span className="flex shrink-0 items-center text-[var(--text-secondary)]">
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5 xl:h-[1.1rem] xl:w-[1.1rem]" />
        </span>
      )}
    </Link>
  )
}

export async function Header({
  name,
  businessType,
  capabilities,
  plan,
  creditIRR,
  daysLeft,
  handedOffCount = 0,
  instagramConnected = false,
  userSwitcher,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
  capabilities?: readonly CapabilityKey[]
  plan: Plan
  creditIRR: number
  daysLeft: number | null
  handedOffCount?: number
  instagramConnected?: boolean
  /** Platform owner only: replaces the plan card with the account switcher. */
  userSwitcher?: { currentUserId: string; currentName: string; impersonating: boolean }
}) {
  const [t, locale] = await Promise.all([
    getTranslations('dashboard'),
    getLocale(),
  ])

  const fa = locale === 'fa'
  const isTrial = plan === 'TRIAL'
  const planPresentation = PLAN_PRESENTATION[plan]
  const PlanIcon = planPresentation.icon
  const planTitle = fa ? planPresentation.fa : planPresentation.en
  const periodProgress = daysLeft === null
    ? null
    : Math.max(0, Math.min(100, Math.round((daysLeft / PERIOD_DAYS) * 100)))
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const creditToman = Math.max(0, Math.round(creditIRR / 10))
  const active = daysLeft !== null && daysLeft > 0
  const expired = daysLeft !== null && daysLeft <= 0
  const statusLabel = active
    ? (fa ? 'فعال' : 'Active')
    : expired
      ? (fa ? 'پایان‌یافته' : 'Expired')
      : (fa ? 'غیرفعال' : 'Inactive')
  const billingLabel = fa
    ? `مشاهده جزئیات پلن و اعتبار؛ ${planTitle}، ${statusLabel}، ${nf.format(creditToman)} تومان اعتبار پاسخ${daysLeft !== null ? `، ${nf.format(daysLeft)} روز باقی‌مانده` : ''}`
    : `View plan and credit details; ${planTitle}, ${statusLabel}, ${nf.format(creditToman)} toman reply credit${daysLeft !== null ? `, ${nf.format(daysLeft)} days remaining` : ''}`
  const businessLabel = fa
    ? getVerticalPack(businessType).titleFa
    : getVerticalPack(businessType).titleEn

  return (
    <header className="dashboard-shell-header sticky top-0 z-30 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[112rem] items-center justify-between gap-3 rounded-card border border-black/[0.07] bg-white/[0.76] px-3 shadow-[var(--elev-1)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 supports-[backdrop-filter:none]:bg-white/[0.92] sm:px-4 xl:min-h-[5.5rem] xl:rounded-sheet xl:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5 xl:gap-4">
          {/* On phones the plan card (or the owner's account switcher) takes the start slot so it gets the full free width. */}
          <div className="min-w-0 flex-1 sm:hidden">
            {userSwitcher ? (
              <UserSwitcher
                key={userSwitcher.currentUserId}
                compact fa={fa}
                {...userSwitcher}
                badge={<PlanBadge compact PlanIcon={PlanIcon} periodProgress={periodProgress} expired={expired} isTrial={isTrial} />}
                detail={<PlanCredit compact fa={fa} creditToman={creditToman} active={active} daysLeft={daysLeft} nf={nf} />}
              />
            ) : (
              <HeaderPlan
                compact
                fa={fa}
                PlanIcon={PlanIcon}
                planTitle={planTitle}
                billingLabel={billingLabel}
                creditToman={creditToman}
                periodProgress={periodProgress}
                daysLeft={daysLeft}
                active={active}
                expired={expired}
                isTrial={isTrial}
                statusLabel={statusLabel}
                nf={nf}
              />
            )}
          </div>
          <MobileNav businessType={businessType} capabilities={capabilities} handedOffCount={handedOffCount} instagramConnected={instagramConnected} />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-bold leading-5 text-[var(--text-primary)] xl:text-[15px] xl:leading-6">
              {name ? t('greeting', { name }) : t('welcome')}
            </div>
            <div className="mt-1 hidden items-center gap-2 text-[12px] leading-4 text-[var(--text-muted)] sm:flex xl:mt-1.5 xl:text-xs">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]" />
              <span className="sr-only">{fa ? 'سامانه فعال است' : 'System online'}</span>
              <span className="truncate">
                {businessLabel} · {fa ? 'مرکز مدیریت ویجنت' : 'Vigent management center'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 xl:gap-2.5">
          <div className="hidden sm:block">
            {userSwitcher ? (
              <UserSwitcher
                key={userSwitcher.currentUserId}
                fa={fa}
                {...userSwitcher}
                badge={<PlanBadge PlanIcon={PlanIcon} periodProgress={periodProgress} expired={expired} isTrial={isTrial} />}
                detail={<PlanCredit fa={fa} creditToman={creditToman} active={active} daysLeft={daysLeft} nf={nf} />}
              />
            ) : (
              <HeaderPlan
                fa={fa}
                PlanIcon={PlanIcon}
                planTitle={planTitle}
                billingLabel={billingLabel}
                creditToman={creditToman}
                periodProgress={periodProgress}
                daysLeft={daysLeft}
                active={active}
                expired={expired}
                isTrial={isTrial}
                statusLabel={statusLabel}
                nf={nf}
              />
            )}
          </div>
          {userSwitcher ? <AdminPanelButton fa={fa} /> : <SupportButton />}
          <NotificationBell />
          <form action={logout}>
            <button
              type="submit"
              aria-label={t('logout')}
              className="spatial-press hidden h-12 w-12 items-center justify-center rounded-card border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[var(--elev-1)] hover:border-black/[0.12] hover:bg-white hover:text-[var(--text-primary)] sm:inline-flex xl:h-14 xl:w-14 xl:rounded-card"
            >
              <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180 xl:h-[1.15rem] xl:w-[1.15rem]" />
            </button>
          </form>
        </div>
      </div>
      <ImprovementActivityIndicator />
    </header>
  )
}
