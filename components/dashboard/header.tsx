import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { ChevronRight, Gem, LogOut } from 'lucide-react'
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
  const planLabel = fa
    ? ({ TRIAL: 'آزمایشی', STARTER: 'استارتر', PRO: 'حرفه‌ای', BUSINESS: 'سازمانی' } as const)[plan]
    : plan.charAt(0) + plan.slice(1).toLowerCase()
  const remaining = Math.max(0, Math.min(100, remainingPercent))
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const businessLabel = fa
    ? getVerticalPack(businessType).titleFa
    : getVerticalPack(businessType).titleEn

  // Single-line display: show business name if available, otherwise user name.
  // This replaces the old two-line greeting + business label pattern.
  const displayLabel = businessLabel || name || t('welcome')

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 lg:px-8 xl:px-10">
      <div className="flex min-h-14 items-center justify-between gap-2 rounded-[1.25rem] border border-black/[0.06] bg-white/72 shadow-[0_8px_28px_rgba(0,0,0,0.055)] backdrop-blur-xl transition-[background-color,box-shadow] duration-200 supports-[backdrop-filter:none]:bg-white/90 sm:min-h-15 sm:px-4">
      {/* ── Left: mobile nav + single-line identity ─────────────── */}
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav businessType={businessType} services={services} />
        <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {displayLabel}
          </span>
        </div>
      </div>

      {/* ── Right: compact plan pill + notifications + logout ───── */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none">
        {/* Compact plan pill — minimal: icon + plan name + percentage */}
        <Link
          href="/billing"
          dir="ltr"
          aria-label={fa ? 'مشاهده پلن و اعتبار' : 'View plan and credit'}
          className="group flex h-9 min-w-0 items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white/80 px-2.5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-black/12 hover:shadow-md sm:h-10 sm:gap-2 sm:px-3"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[radial-gradient(circle_at_35%_30%,white_0%,#f7f7f7_48%,#e8e8e8_100%)] text-black shadow-[inset_0_1px_0_white,0_2px_6px_rgba(0,0,0,0.05)] sm:h-7 sm:w-7">
            <Gem className="h-3 w-3 stroke-[2] sm:h-3.5 sm:w-3.5" />
          </span>
          <span className="min-w-0 flex-1" dir={fa ? 'rtl' : 'ltr'}>
            <span className="block truncate text-[10px] font-bold leading-4 text-[var(--text-primary)] sm:text-[11px]">
              {fa ? `پلن ${planLabel}` : `${planLabel} plan`}
            </span>
            <span className="block truncate text-[9px] leading-3 text-[var(--text-muted)] sm:text-[10px]">
              {daysLeft !== null
                ? fa
                  ? `${nf.format(daysLeft)} روز · ${nf.format(remaining)}٪`
                  : `${nf.format(daysLeft)}d · ${nf.format(remaining)}%`
                : fa
                  ? `${nf.format(Math.round(creditIRR / 10))} تومان`
                  : `${nf.format(Math.round(creditIRR / 10))} toman`}
            </span>
          </span>
          <span className="flex shrink-0 items-center text-black/40" dir="ltr">
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </Link>
        <NotificationBell />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t('logout')}
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)] sm:inline-flex sm:h-10 sm:w-10"
          >
            <LogOut className="h-4 w-4 rtl:rotate-180" />
          </button>
        </form>
      </div>
      </div>
    </header>
  )
}
