import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Plan } from '@prisma/client'
import { LogOut, Wallet } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

export async function Header({
  name,
  businessType,
  plan,
  creditIRR,
  usagePercent,
  daysLeft,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
  plan: Plan
  creditIRR: number
  usagePercent: number
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
  const remaining = Math.max(0, 100 - usagePercent)
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 lg:px-8 xl:px-10">
      <div className="spatial-control flex min-h-14 items-center justify-between gap-2 rounded-[1.15rem] px-2.5 sm:px-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav businessType={businessType} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
            {name ? t('greeting', { name }) : t('welcome')}
          </div>
          <div className="mt-0.5 hidden items-center gap-1.5 text-[11px] text-[var(--text-muted)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {locale === 'fa' ? 'فضای کاری ویجنت' : 'Vigent workspace'}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/billing"
          aria-label={fa ? 'مشاهده پلن و اعتبار' : 'View plan and credit'}
          className="spatial-press me-1 flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-2.5 sm:min-w-44 sm:px-3"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black text-white shadow-[var(--shadow-control)]">
            <Wallet className="h-3.5 w-3.5" />
          </span>
          <span className="hidden min-w-0 flex-1 sm:block">
            <span className="flex items-center justify-between gap-3 text-[10px] font-semibold text-[var(--text-primary)]">
              <span>{planLabel}</span>
              <span className="tabular-nums">{nf.format(remaining)}{fa ? '٪ باقی' : '% left'}</span>
            </span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <span
                className="block h-full rounded-full bg-black transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${remaining}%` }}
              />
            </span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[var(--text-muted)]">
              <span>{nf.format(Math.round(creditIRR / 10))} {fa ? 'تومان اعتبار' : 'toman credit'}</span>
              {daysLeft !== null && <span>{nf.format(daysLeft)} {fa ? 'روز' : 'days'}</span>}
            </span>
          </span>
        </Link>
        <NotificationBell />
        <LanguageSwitcher />
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
