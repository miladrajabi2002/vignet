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

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 lg:px-8 xl:px-10">
      <div className="spatial-control flex min-h-16 items-center justify-between gap-2 rounded-[1.35rem] px-2 sm:px-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <MobileNav businessType={businessType} services={services} />
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-bold leading-5 text-[var(--text-primary)]">
            {name ? t('greeting', { name }) : t('welcome')}
          </div>
          <div className="mt-1 hidden items-center gap-1.5 text-[10px] leading-4 text-[var(--text-muted)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {businessLabel} · {fa ? 'مرکز مدیریت ویجنت' : 'Vigent management center'}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:flex-none">
        {/* Plan / credit pill — slightly more compact than the original,
            but keeps the same visual structure: icon + label + progress + %.
            Height reduced from h-14 → h-12, padding tightened, text sizes
            trimmed by 1px each. Everything else (border, radius, shadow,
            gradient icon, progress bar, chevron) is the original design. */}
        <Link
          href="/billing"
          dir="ltr"
          aria-label={fa ? 'مشاهده پلن و اعتبار' : 'View plan and credit'}
          className="spatial-press group me-0.5 flex h-12 min-w-0 w-full max-w-[12rem] items-center gap-2 rounded-[1.35rem] border border-black/[0.08] bg-white px-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow,transform] duration-200 hover:border-black/15 hover:shadow-[0_12px_34px_rgba(0,0,0,0.09)] sm:w-[15rem] sm:max-w-none sm:gap-2.5 sm:px-3"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/[0.06] bg-[radial-gradient(circle_at_35%_30%,white_0%,#f7f7f7_48%,#eeeeee_100%)] text-black shadow-[inset_0_1px_0_white,0_3px_10px_rgba(0,0,0,0.06)] sm:h-9 sm:w-9">
            <Gem className="h-[0.95rem] w-[0.95rem] stroke-[1.8] sm:h-[1.05rem] sm:w-[1.05rem]" />
          </span>

          <span className="min-w-0 flex-1" dir={fa ? 'rtl' : 'ltr'}>
            <span className="block truncate text-[10px] font-bold leading-4 text-[var(--text-primary)] sm:text-[11px]">
              {fa ? `پلن ${planLabel}` : `${planLabel} plan`}
            </span>
            {/* Credit amount — the main info shown under the plan name */}
            <span className="mt-0.5 block truncate text-[9px] leading-3.5 text-[var(--text-muted)] sm:text-[10px]">
              {fa
                ? `${nf.format(Math.round(creditIRR / 10))} تومان اعتبار`
                : `${nf.format(Math.round(creditIRR / 10))} toman credit`}
            </span>
            {/* Days left shown ABOVE the progress bar (small, muted) */}
            {daysLeft !== null && (
              <span className="mt-1 block text-[8px] leading-3 text-[var(--text-muted)] sm:text-[9px]">
                {fa
                  ? `${nf.format(daysLeft)} روز تا پایان پلن`
                  : `${nf.format(daysLeft)} days left`}
              </span>
            )}
            {/* Progress bar reflects CREDIT remaining (not time) */}
            <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-black/[0.075]">
              <span className="block h-full rounded-full bg-black transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${remaining}%` }} />
            </span>
          </span>

          {/* Chevron only — percentage removed per request */}
          <span className="flex shrink-0 items-center text-black/65" dir="ltr">
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </Link>
        <NotificationBell />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t('logout')}
            className="spatial-press hidden h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] sm:inline-flex"
          >
            <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
          </button>
        </form>
      </div>
      </div>
    </header>
  )
}
