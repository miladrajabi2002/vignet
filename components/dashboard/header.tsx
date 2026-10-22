import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import type { NavStatusMap } from '@/lib/dashboard/nav-status'
import { ChevronRight, LogOut } from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import { getVerticalPack, type BusinessTypeValue, type CapabilityKey } from '@/lib/verticals/registry'
import { AdminPanelButton, UserSwitcher } from '@/components/dashboard/user-switcher'
import { cn } from '@/lib/utils'
import { planUrgency, type PlanStanding, type PlanUrgency } from '@/lib/billing/plan-standing'
import { PlanRing, planDaysLabel, URGENCY_TEXT } from '@/components/ui/plan-ring'
import { ImprovementActivityIndicator } from '@/components/dashboard/improvement-activity-indicator'
import { AnimatedNumber } from '@/components/dashboard/animated-number'
import { SupportButton } from '@/components/dashboard/support-button'

const PLAN_TITLE = {
  TRIAL: { fa: 'دوره آزمایشی', en: 'Trial' },
  STARTER: { fa: 'پلن استارتر', en: 'Starter plan' },
  PRO: { fa: 'پلن حرفه‌ای', en: 'Professional plan' },
  BUSINESS: { fa: 'پلن سازمانی', en: 'Business plan' },
} as const satisfies Record<Plan, { fa: string; en: string }>

/** The status dot beside the plan name. */
const STATUS_TONE: Record<PlanUrgency, { dot: string; text: string }> = {
  ok: { dot: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.09)]', text: 'text-emerald-700' },
  soon: { dot: 'bg-amber-500', text: 'text-amber-700' },
  critical: { dot: 'bg-red-500', text: 'text-red-600' },
  expired: { dot: 'bg-red-500', text: 'text-red-600' },
}

/** "<credit> toman - <n> days" line under the plan or account name. */
function PlanCredit({
  compact = false,
  fa,
  creditToman,
  standing,
  nf,
}: {
  compact?: boolean
  fa: boolean
  creditToman: number
  standing: PlanStanding
  nf: Intl.NumberFormat
}) {
  const urgency = planUrgency(standing)
  const { daysLeft } = standing
  // A running period reads as "<n> days"; one that has ended says how long ago.
  const days = daysLeft === null
    ? null
    : standing.active
      ? (fa ? `${nf.format(daysLeft)} روز` : `${nf.format(daysLeft)} days`)
      : daysLeft < 0 ? planDaysLabel(standing, fa) : null
  return (
    <span className={cn(
      'block min-w-0 truncate whitespace-nowrap text-[12px] leading-4 text-[var(--text-muted)]',
      compact ? 'mt-0.5' : 'mt-1 xl:text-[12px]',
    )}>
      <span className="font-bold tabular-nums text-[var(--text-secondary)]"><AnimatedNumber value={creditToman} locale={fa ? 'fa-IR' : 'en-US'} /></span>
      <span className="ms-1">{fa ? 'تومان' : 'toman'}</span>
      {days && (
        <>
          <span aria-hidden="true" className="mx-1 text-[var(--text-muted)]">-</span>
          <span className={cn('tabular-nums', urgency !== 'ok' && cn('font-bold', URGENCY_TEXT[urgency]))}>{days}</span>
        </>
      )}
    </span>
  )
}

function HeaderPlan({
  compact = false,
  fa,
  standing,
  planTitle,
  billingLabel,
  creditToman,
  statusLabel,
  nf,
}: {
  compact?: boolean
  fa: boolean
  standing: PlanStanding
  planTitle: string
  billingLabel: string
  creditToman: number
  statusLabel: string
  nf: Intl.NumberFormat
}) {
  const urgency = planUrgency(standing)
  // No end date at all (a paid plan without a live subscription) reads as inactive, not ended.
  const tone = standing.daysLeft === null
    ? { dot: 'bg-zinc-400', text: 'text-[var(--text-muted)]' }
    : STATUS_TONE[urgency]
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
      <PlanRing standing={standing} fa={fa} className={compact ? 'h-9 w-9' : 'h-10 w-10 xl:h-12 xl:w-12'} />

      <span className="min-w-0 flex-1">
        <span className={cn(
          'flex min-w-0 items-center font-bold text-[var(--text-primary)]',
          compact ? 'text-[12px] leading-4' : 'text-[13px] leading-4 xl:text-[15px] xl:leading-5',
        )}>
          <span className="truncate">{planTitle}</span>
          {!compact && (
            <span className="ms-1.5 inline-flex shrink-0 items-center gap-1" aria-label={statusLabel}>
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
              <span className={cn('text-[12px] font-medium', tone.text)}>{statusLabel}</span>
            </span>
          )}
        </span>

        <PlanCredit compact={compact} fa={fa} creditToman={creditToman} standing={standing} nf={nf} />
      </span>

      {urgency === 'ok' ? (
        !compact && (
          <span className="flex shrink-0 items-center text-[var(--text-secondary)]">
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5 xl:h-[1.1rem] xl:w-[1.1rem]" />
          </span>
        )
      ) : (
        // The last week of a period, or after it: the card becomes the way to renew.
        <span className={cn(
          'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-extrabold leading-4 text-white',
          urgency === 'soon' ? 'bg-amber-600' : 'bg-red-600',
        )}>
          {standing.plan === 'TRIAL'
            ? (fa ? 'خرید اشتراک' : 'Subscribe')
            : (fa ? 'تمدید' : 'Renew')}
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
  storeConnected = false,
  navStatus,
  userSwitcher,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
  capabilities?: readonly CapabilityKey[]
  plan: Plan
  creditIRR: number
  /** Days left in the period; negative once it has ended. */
  daysLeft: number | null
  handedOffCount?: number
  instagramConnected?: boolean
  storeConnected?: boolean
  navStatus?: NavStatusMap
  /** Platform owner only: replaces the plan card with the account switcher. */
  userSwitcher?: { currentUserId: string; currentName: string; impersonating: boolean; endingSoonCount?: number }
}) {
  const [t, locale] = await Promise.all([
    getTranslations('dashboard'),
    getLocale(),
  ])

  const fa = locale === 'fa'
  const planTitle = PLAN_TITLE[plan][fa ? 'fa' : 'en']
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const creditToman = Math.max(0, Math.round(creditIRR / 10))
  const active = daysLeft !== null && daysLeft > 0
  const standing: PlanStanding = { plan, active, daysLeft }
  const urgency = planUrgency(standing)
  const statusLabel = active
    ? urgency === 'ok' ? (fa ? 'فعال' : 'Active') : (fa ? 'رو به پایان' : 'Ending soon')
    : daysLeft !== null
      ? (fa ? 'پایان‌یافته' : 'Expired')
      : (fa ? 'غیرفعال' : 'Inactive')
  const billingLabel = fa
    ? `مشاهده جزئیات پلن و اعتبار؛ ${planTitle}، ${statusLabel}، ${nf.format(creditToman)} تومان اعتبار پاسخ${daysLeft !== null ? `، ${planDaysLabel(standing, fa)}` : ''}`
    : `View plan and credit details; ${planTitle}, ${statusLabel}, ${nf.format(creditToman)} toman reply credit${daysLeft !== null ? `, ${planDaysLabel(standing, fa)}` : ''}`
  // The dot beside the greeting is the account's health: green only when
  // nothing below the header waits for the owner.
  const alerts = Object.entries(navStatus ?? {}).filter(([, status]) => status?.tone === 'alert')
  const setups = Object.entries(navStatus ?? {}).filter(([, status]) => status?.tone === 'setup')
  const health: { tone: 'ok' | 'setup' | 'alert'; label: string; href: string | null } = handedOffCount > 0
    ? { tone: 'alert', label: fa ? `${nf.format(handedOffCount)} گفتگو منتظر شماست` : `${handedOffCount} chats wait for you`, href: '/conversations?status=HANDED_OFF' }
    : alerts.length
      ? { tone: 'alert', label: alerts[0][1]!.label, href: `/${alerts[0][0]}` }
      : setups.length
        ? { tone: 'setup', label: setups[0][1]!.label, href: `/${setups[0][0]}` }
        : { tone: 'ok', label: fa ? 'همه‌چیز کار می‌کند' : 'Everything is working', href: null }
  const businessLabel = fa
    ? getVerticalPack(businessType).titleFa
    : getVerticalPack(businessType).titleEn

  return (
    <header className="dashboard-shell-header sticky top-0 z-30 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
      <div className="dashboard-shell-frame flex min-h-[4.5rem] items-center justify-between gap-3 rounded-card border border-black/[0.07] bg-white px-3 shadow-[var(--elev-2)] sm:px-4 xl:min-h-[5.5rem] xl:rounded-sheet xl:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5 xl:gap-4">
          {/* On phones the plan card (or the owner's account switcher) takes the start slot so it gets the full free width. */}
          <div className="min-w-0 flex-1 sm:hidden">
            {userSwitcher ? (
              <UserSwitcher
                key={userSwitcher.currentUserId}
                compact fa={fa}
                {...userSwitcher}
                badge={<PlanRing standing={standing} fa={fa} showDays className="h-9 w-9" />}
                detail={<PlanCredit compact fa={fa} creditToman={creditToman} standing={standing} nf={nf} />}
              />
            ) : (
              <HeaderPlan
                compact
                fa={fa}
                standing={standing}
                planTitle={planTitle}
                billingLabel={billingLabel}
                creditToman={creditToman}
                statusLabel={statusLabel}
                nf={nf}
              />
            )}
          </div>
          <MobileNav businessType={businessType} capabilities={capabilities} handedOffCount={handedOffCount} instagramConnected={instagramConnected} storeConnected={storeConnected} navStatus={navStatus} />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-bold leading-5 text-[var(--text-primary)] xl:text-[15px] xl:leading-6">
              {name ? t('greeting', { name }) : t('welcome')}
            </div>
            <div className="mt-1 hidden items-center gap-2 text-[12px] leading-4 text-[var(--text-muted)] sm:flex xl:mt-1.5 xl:text-xs">
              <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', health.tone === 'ok' ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]' : health.tone === 'alert' ? 'bg-red-500' : 'bg-amber-500')} />
              {health.href ? (
                <Link href={health.href} className={cn('truncate font-medium underline-offset-2 hover:underline', health.tone === 'alert' ? 'text-red-600' : 'text-amber-700')}>
                  {health.label}
                </Link>
              ) : (
                <span className="sr-only">{health.label}</span>
              )}
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
                badge={<PlanRing standing={standing} fa={fa} showDays className="h-10 w-10 xl:h-12 xl:w-12" />}
                detail={<PlanCredit fa={fa} creditToman={creditToman} standing={standing} nf={nf} />}
              />
            ) : (
              <HeaderPlan
                fa={fa}
                standing={standing}
                planTitle={planTitle}
                billingLabel={billingLabel}
                creditToman={creditToman}
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
