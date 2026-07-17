import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { ChevronRight, Gem, Hourglass, LogOut } from 'lucide-react'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import { getVerticalPack, type BusinessTypeValue } from '@/lib/verticals/registry'

export async function Header({
  name,
  businessType,
  services,
  plan,
  creditIRR,
  remainingPercent,
  daysLeft,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
  services?: readonly string[]
  plan: Plan
  creditIRR: number
  remainingPercent: number
  daysLeft: number | null
}) {
  const [t, locale] = await Promise.all([
    getTranslations('dashboard'),
    getLocale(),
  ])

  const fa = locale === 'fa'
  const isTrial = plan === 'TRIAL'
  const PlanIcon = isTrial ? Hourglass : Gem
  const planLabel = fa
    ? ({ TRIAL: 'آزمایشی', STARTER: 'استارتر', PRO: 'حرفه‌ای', BUSINESS: 'سازمانی' } as const)[plan]
    : plan.charAt(0) + plan.slice(1).toLowerCase()
  const remaining = Math.max(0, Math.min(100, remainingPercent))
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const businessLabel = fa
    ? getVerticalPack(businessType).titleFa
    : getVerticalPack(businessType).titleEn

  return (
    <header className="dashboard-shell-header sticky top-0 z-30 pt-3">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[112rem] items-center justify-between gap-3 rounded-[1.6rem] border border-black/[0.07] bg-white/[0.76] px-3 shadow-[0_10px_34px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 supports-[backdrop-filter:none]:bg-white/[0.92] sm:px-4 xl:min-h-[5.5rem] xl:rounded-[2rem] xl:px-5">
        <div className="flex min-w-0 items-center gap-3.5 xl:gap-4">
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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none xl:gap-2.5">
          {/* Plan / credit pill — shows plan name, credit amount with progress bar,
              and days left (if any) above the bar. Progress reflects credit remaining. */}
          <Link
            href="/billing"
            dir="ltr"
            aria-label={fa
              ? isTrial ? 'مشاهده دوره آزمایشی و اعتبار' : 'مشاهده پلن و اعتبار'
              : isTrial ? 'View trial and credit' : 'View plan and credit'}
            className="spatial-press group flex h-14 min-w-0 w-full max-w-[13rem] items-center gap-2 rounded-[1.45rem] border border-black/[0.08] bg-white/90 px-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow,transform] duration-200 hover:border-black/[0.15] hover:shadow-[0_12px_34px_rgba(0,0,0,0.09)] sm:w-[14rem] sm:max-w-none sm:gap-2.5 sm:px-3 lg:w-[15rem] xl:h-[4.25rem] xl:w-[18rem] xl:rounded-[1.7rem] xl:px-3.5"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_white,0_3px_10px_rgba(0,0,0,0.06)] sm:h-10 sm:w-10 xl:h-12 xl:w-12 ${isTrial
              ? 'border-amber-200/70 bg-[radial-gradient(circle_at_35%_30%,white_0%,#fff9eb_50%,#fef3c7_100%)] text-amber-700'
              : 'border-black/[0.06] bg-[radial-gradient(circle_at_35%_30%,white_0%,#f7f7f7_48%,#eeeeee_100%)] text-black'
            }`}>
              <PlanIcon aria-hidden="true" className="h-[1.05rem] w-[1.05rem] stroke-[1.8] sm:h-[1.15rem] sm:w-[1.15rem] xl:h-5 xl:w-5" />
            </span>

            <span className="min-w-0 flex-1" dir={fa ? 'rtl' : 'ltr'}>
              {/* Line 1: Plan name + days left (inline, compact) */}
              <span className="block truncate text-xs font-bold leading-4 text-[var(--text-primary)] sm:text-[13px] xl:text-[15px] xl:leading-5">
                {fa ? `پلن ${planLabel}` : `${planLabel} plan`}
                {daysLeft !== null && (
                  <span className="ms-1.5 text-[11px] font-normal text-[var(--text-muted)] xl:text-xs">
                    {fa ? `· ${nf.format(daysLeft)} روز` : `· ${nf.format(daysLeft)}d`}
                  </span>
                )}
              </span>
              {/* Line 2: Credit amount (number only, no "تومان اعتبار" to avoid overflow) */}
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-[var(--text-muted)] xl:text-xs">
                {nf.format(Math.round(creditIRR / 10))}
                <span className="ms-0.5">{fa ? 'تومان' : 'toman'}</span>
              </span>
              {/* Progress bar — reflects CREDIT remaining */}
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-black/[0.075] xl:mt-1.5 xl:h-[5px]">
                <span className="block h-full rounded-full bg-black transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${remaining}%` }} />
              </span>
            </span>

            <span className="flex shrink-0 items-center text-black/65" dir="ltr">
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none xl:h-[1.1rem] xl:w-[1.1rem]" />
            </span>
          </Link>
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
