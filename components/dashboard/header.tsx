import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { Building2, ChevronRight, Gem, Hourglass, LogOut, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import { getVerticalPack, type BusinessTypeValue } from '@/lib/verticals/registry'
import { ImpersonationBanner } from '@/components/dashboard/impersonation-banner'
import { cn } from '@/lib/utils'
import { PERIOD_DAYS } from '@/lib/billing/plans'

const PLAN_PRESENTATION = {
  TRIAL: { fa: 'دوره آزمایشی', en: 'Trial', shortFa: 'آزمایشی', shortEn: 'Trial', icon: Hourglass },
  STARTER: { fa: 'پلن استارتر', en: 'Starter plan', shortFa: 'استارتر', shortEn: 'Starter', icon: Rocket },
  PRO: { fa: 'پلن حرفه‌ای', en: 'Professional plan', shortFa: 'حرفه‌ای', shortEn: 'Pro', icon: Gem },
  BUSINESS: { fa: 'پلن سازمانی', en: 'Business plan', shortFa: 'سازمانی', shortEn: 'Business', icon: Building2 },
} as const satisfies Record<Plan, {
  fa: string
  en: string
  shortFa: string
  shortEn: string
  icon: LucideIcon
}>

function HeaderPlan({
  compact = false,
  fa,
  PlanIcon,
  planTitle,
  shortPlanTitle,
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
  shortPlanTitle: string
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
        'spatial-press group flex min-w-0 items-center border border-black/[0.08] bg-white/90 text-[var(--text-primary)] shadow-[0_8px_28px_rgba(0,0,0,0.06)] outline-none transition-[border-color,box-shadow,transform] duration-200 hover:border-black/[0.15] hover:shadow-[0_12px_34px_rgba(0,0,0,0.09)] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none',
        compact
          ? 'h-12 w-[7.25rem] gap-1.5 rounded-[1.1rem] px-1.5'
          : 'h-14 w-[14.5rem] gap-2.5 rounded-[1.45rem] px-3 lg:w-[15.5rem] xl:h-[4.25rem] xl:w-[18rem] xl:rounded-[1.7rem] xl:px-3.5',
      )}
    >
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
          'grid place-items-center rounded-full border shadow-[inset_0_1px_0_white,0_3px_10px_rgba(0,0,0,0.05)]',
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

      <span className="min-w-0 flex-1">
        <span className={cn(
          'flex min-w-0 items-center font-extrabold text-[var(--text-primary)]',
          compact ? 'text-[11px] leading-4' : 'text-[13px] leading-4 xl:text-[15px] xl:leading-5',
        )}>
          <span className="truncate">{compact ? shortPlanTitle : planTitle}</span>
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
            {!compact && (
              <span className={cn(
                'text-[10px] font-medium',
                active ? 'text-emerald-700' : expired ? 'text-red-600' : 'text-[var(--text-muted)]',
              )}>
                {statusLabel}
              </span>
            )}
          </span>
          {!compact && active && daysLeft !== null && (
            <span className="ms-1.5 shrink-0 text-[10px] font-medium text-[var(--text-muted)] xl:text-xs">
              {fa ? `· ${nf.format(daysLeft)} روز` : `· ${nf.format(daysLeft)}d`}
            </span>
          )}
        </span>

        {compact ? (
          <span className={cn(
            'mt-0.5 block truncate whitespace-nowrap text-[10px] font-medium leading-4',
            expired ? 'text-red-600' : 'text-[var(--text-muted)]',
          )}>
            {daysLeft !== null
              ? expired
                ? statusLabel
                : fa
                  ? `${nf.format(daysLeft)} روز مانده`
                  : `${nf.format(daysLeft)} days left`
              : statusLabel}
          </span>
        ) : (
          <span className="mt-1 block min-w-0 truncate whitespace-nowrap text-[10px] leading-4 text-[var(--text-muted)] xl:text-[11px]">
            <span className="min-w-0 truncate">
              <span className="font-bold tabular-nums text-[var(--text-secondary)]">{nf.format(creditToman)}</span>
              <span className="ms-1">{fa ? 'تومان' : 'toman'}</span>
            </span>
          </span>
        )}
      </span>

      {!compact && (
        <span className="flex shrink-0 items-center text-black/55">
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5 xl:h-[1.1rem] xl:w-[1.1rem]" />
        </span>
      )}
    </Link>
  )
}

export async function Header({
  name,
  businessType,
  services,
  plan,
  creditIRR,
  daysLeft,
  impersonatedUserName,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
  services?: readonly string[]
  plan: Plan
  creditIRR: number
  daysLeft: number | null
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
  const shortPlanTitle = fa ? planPresentation.shortFa : planPresentation.shortEn
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
      {impersonatedUserName && <ImpersonationBanner userName={impersonatedUserName} />}
      <div className="mx-auto flex min-h-[4.5rem] max-w-[112rem] items-center justify-between gap-3 rounded-[1.6rem] border border-black/[0.07] bg-white/[0.76] px-3 shadow-[0_10px_34px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 supports-[backdrop-filter:none]:bg-white/[0.92] sm:px-4 xl:min-h-[5.5rem] xl:rounded-[2rem] xl:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5 xl:gap-4">
          {/* The mobile-only Vigento shortcut balances the opposite action group. */}
          <Link
            href="/vigento"
            dir="ltr"
            aria-label={fa ? 'باز کردن ویجنتو، دستیار هوش مصنوعی' : 'Open Vigento AI assistant'}
            className="spatial-press flex h-12 min-w-12 max-w-[6.5rem] items-center gap-1.5 overflow-hidden rounded-[1.1rem] border border-black/[0.08] bg-white/85 px-1.5 text-[var(--text-primary)] shadow-[0_5px_18px_rgba(0,0,0,0.04)] outline-none hover:border-black/[0.14] hover:bg-white focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:hover:transform-none motion-reduce:active:transform-none sm:hidden"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-black/[0.06] bg-[var(--bg-surface)]">
              <Sparkles aria-hidden="true" className="h-4 w-4 stroke-[1.8]" />
            </span>
            <span className="min-w-0 truncate text-[11px] font-black tracking-[-0.01em]">Vigento</span>
          </Link>
          <MobileNav businessType={businessType} services={services} />
          <div className="hidden min-w-0 sm:block md:hidden lg:block">
            <div className="truncate text-sm font-extrabold leading-5 text-[var(--text-primary)] xl:text-[15px] xl:leading-6">
              {name ? t('greeting', { name }) : t('welcome')}
            </div>
            <div className="mt-1 hidden items-center gap-2 text-[11px] leading-4 text-[var(--text-muted)] sm:flex xl:mt-1.5 xl:text-xs">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]" />
              <span className="sr-only">{fa ? 'سامانه فعال است' : 'System online'}</span>
              <span className="truncate">
                {businessLabel} · {fa ? 'مرکز مدیریت ویجنت' : 'Vigent management center'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 xl:gap-2.5">
          <div className="sm:hidden">
            <HeaderPlan
              compact
              fa={fa}
              PlanIcon={PlanIcon}
              planTitle={planTitle}
              shortPlanTitle={shortPlanTitle}
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
          <div className="hidden sm:block">
            <HeaderPlan
              fa={fa}
              PlanIcon={PlanIcon}
              planTitle={planTitle}
              shortPlanTitle={shortPlanTitle}
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
          <NotificationBell />
          <form action={logout}>
            <button
              type="submit"
              aria-label={t('logout')}
              className="spatial-press hidden h-12 w-12 items-center justify-center rounded-[1.15rem] border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[0_5px_18px_rgba(0,0,0,0.035)] hover:border-black/[0.12] hover:bg-white hover:text-[var(--text-primary)] sm:inline-flex xl:h-14 xl:w-14 xl:rounded-[1.35rem]"
            >
              <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180 xl:h-[1.15rem] xl:w-[1.15rem]" />
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
