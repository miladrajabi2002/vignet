import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { Building2, ChevronRight, Gem, Hourglass, LogOut, Rocket, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import { getVerticalPack, type BusinessTypeValue, type CapabilityKey } from '@/lib/verticals/registry'
import { ImpersonationBanner } from '@/components/dashboard/impersonation-banner'
import { cn } from '@/lib/utils'
import { PERIOD_DAYS } from '@/lib/billing/plans'
import { ImprovementActivityIndicator } from '@/components/dashboard/improvement-activity-indicator'
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
        'group flex min-w-0 items-center rounded-control border border-black/[0.08] bg-white text-[var(--text-primary)] outline-none transition-[border-color,background-color] duration-200 hover:border-black/[0.18] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none',
        compact
          ? 'h-11 w-full max-w-[16rem] gap-2 px-1.5 pe-2.5'
          : 'h-11 w-[14rem] gap-2.5 px-2 pe-2.5 lg:w-[14.5rem]',
      )}
    >
      <span className={cn(
        'relative grid shrink-0 place-items-center',
        'h-9 w-9',
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
          'h-7 w-7',
          expired
            ? 'border-red-200 bg-red-50 text-red-700'
            : isTrial
              ? 'border-amber-200/80 bg-amber-50 text-amber-700'
              : 'border-black/[0.06] bg-[var(--bg-surface)] text-black',
        )}>
          <PlanIcon aria-hidden="true" className="h-3.5 w-3.5 stroke-[1.9]" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn(
          'flex min-w-0 items-center font-bold text-[var(--text-primary)]',
          compact ? 'text-[12px] leading-4' : 'text-[13px] leading-4',
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

        <span className={cn(
          'block min-w-0 truncate whitespace-nowrap text-[12px] leading-4 text-[var(--text-muted)]',
          'mt-0.5',
        )}>
          <span className="font-bold tabular-nums text-[var(--text-secondary)]">{nf.format(creditToman)}</span>
          <span className="ms-1">{fa ? 'تومان' : 'toman'}</span>
          {active && daysLeft !== null && (
            <>
              <span aria-hidden="true" className="mx-1 text-[var(--text-muted)]">-</span>
              <span className="tabular-nums">{fa ? `${nf.format(daysLeft)} روز` : `${nf.format(daysLeft)} days`}</span>
            </>
          )}
        </span>
      </span>

      {!compact && (
        <span className="flex shrink-0 items-center text-[var(--text-secondary)]">
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
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
  impersonatedUserName,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
  capabilities?: readonly CapabilityKey[]
  plan: Plan
  creditIRR: number
  daysLeft: number | null
  handedOffCount?: number
  instagramConnected?: boolean
  impersonatedUserName?: string
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
    // A flat bar on the canvas: only the page content below is a card, so the
    // chrome never competes with it. The hairline separates it while scrolling.
    <header data-dashboard-header className="dashboard-shell-content sticky top-0 z-30 border-b border-[var(--border-default)] bg-[var(--bg-base)]/90 backdrop-blur-xl [padding-top:env(safe-area-inset-top)] supports-[backdrop-filter:none]:bg-[var(--bg-base)]">
      {impersonatedUserName && <div className="pt-2"><ImpersonationBanner userName={impersonatedUserName} /></div>}
      <div className="mx-auto flex min-h-14 max-w-[108rem] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5">
          {/* On phones the plan card takes the start slot so it gets the full free width. */}
          <div className="min-w-0 flex-1 sm:hidden">
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
          </div>
          <MobileNav businessType={businessType} capabilities={capabilities} handedOffCount={handedOffCount} instagramConnected={instagramConnected} />
          <div className="hidden min-w-0 sm:block md:hidden lg:block">
            <div className="truncate text-sm font-bold leading-5 text-[var(--text-primary)]">
              {name ? t('greeting', { name }) : t('welcome')}
            </div>
            <div className="mt-0.5 hidden items-center gap-2 text-[12px] leading-4 text-[var(--text-muted)] sm:flex">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]" />
              <span className="sr-only">{fa ? 'سامانه فعال است' : 'System online'}</span>
              <span className="truncate">
                {businessLabel} · {fa ? 'مرکز مدیریت ویجنت' : 'Vigent management center'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1">
          <div className="hidden sm:block">
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
          </div>
          <SupportButton />
          <NotificationBell />
          <form action={logout}>
            <button
              type="submit"
              aria-label={t('logout')}
              className="hidden h-10 w-10 items-center justify-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:inline-flex"
            >
              <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>
      <ImprovementActivityIndicator />
    </header>
  )
}
