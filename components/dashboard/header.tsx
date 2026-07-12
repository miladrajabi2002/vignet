import { getLocale, getTranslations } from 'next-intl/server'
import { LogOut, Sparkles } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { logout } from '@/app/actions/auth'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

export async function Header({
  name,
  businessType,
}: {
  name?: string | null
  businessType?: BusinessTypeValue | null
}) {
  const [t, locale] = await Promise.all([
    getTranslations('dashboard'),
    getLocale(),
  ])

  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between gap-2 border-b border-[var(--border-default)] bg-white/[0.82] px-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav businessType={businessType} />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:grid">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[var(--text-primary)]">
              {name ? t('greeting', { name }) : t('welcome')}
            </div>
            <div className="mt-0.5 hidden items-center gap-1.5 text-[11px] text-[var(--text-muted)] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]" />
              {locale === 'fa' ? 'فضای کاری ویجنت' : 'Vigent workspace'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <LanguageSwitcher />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t('logout')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-danger"
          >
            <LogOut className="h-4 w-4 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </header>
  )
}
