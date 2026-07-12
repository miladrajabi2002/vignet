import { getLocale, getTranslations } from 'next-intl/server'
import { LogOut } from 'lucide-react'
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-white px-4 sm:px-6 lg:px-10">
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

      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationBell />
        <LanguageSwitcher />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t('logout')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
          </button>
        </form>
      </div>
    </header>
  )
}
