import { getTranslations } from 'next-intl/server'
import { LogOut } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { logout } from '@/app/actions/auth'

export async function Header({ name }: { name?: string | null }) {
  const t = await getTranslations('dashboard')

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-base)]/80 px-6 backdrop-blur">
      <div className="text-sm text-[var(--text-secondary)]">
        {name ? t('greeting', { name }) : t('welcome')}
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <LanguageSwitcher />
        <ThemeToggle />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t('logout')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-danger"
          >
            <LogOut className="h-4 w-4 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </header>
  )
}
