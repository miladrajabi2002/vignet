import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { LogOut } from 'lucide-react'
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
    <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 lg:px-8 xl:px-10">
      <div className="spatial-control flex min-h-14 items-center justify-between gap-2 rounded-[1.15rem] px-2.5 sm:px-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <MobileNav businessType={businessType} services={services} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-5 text-[var(--text-primary)]">
            {name ? t('greeting', { name }) : t('welcome')}
          </div>
          <div className="mt-1 hidden items-center gap-1.5 text-[10px] leading-4 text-[var(--text-muted)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {businessLabel} · {fa ? 'مرکز مدیریت ویجنت' : 'Vigent management center'}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/billing"
          aria-label={fa ? 'مشاهده پلن و اعتبار' : 'View plan and credit'}
          className="spatial-press relative me-0.5 flex h-11 w-[8.8rem] flex-col justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-white px-2.5 pb-1.5 shadow-[var(--shadow-xs)] sm:w-[10.5rem]"
        >
          <span className="flex w-full min-w-0 items-center justify-between gap-2 text-[9px] font-bold text-[var(--text-primary)] sm:text-[10px]">
            <span className="truncate">{fa ? `پلن ${planLabel}` : `${planLabel} plan`}</span>
            <span className="shrink-0 tabular-nums text-[8px] font-medium text-[var(--text-muted)]">{nf.format(remaining)}{fa ? '٪' : '%'}</span>
          </span>
          <span className="mt-0.5 flex w-full min-w-0 items-center justify-between gap-1 text-[8px] leading-3 text-[var(--text-muted)]">
            <span className="truncate">{nf.format(Math.round(creditIRR / 10))} {fa ? 'تومان' : 'toman'}</span>
            {daysLeft !== null && <span className="shrink-0">{nf.format(daysLeft)} {fa ? 'روز' : 'days'}</span>}
          </span>
          <span className="absolute inset-x-2 bottom-0.5 h-1 overflow-hidden rounded-full bg-black/[0.08]">
            <span className="block h-full rounded-full bg-black" style={{ width: `${remaining}%` }} />
          </span>
        </Link>
        <NotificationBell />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t('logout')}
            className="spatial-press inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
          </button>
        </form>
      </div>
      </div>
    </header>
  )
}
