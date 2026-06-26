import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { KeyRound, Users, ChevronRight } from 'lucide-react'

export default async function SettingsPage() {
  const t = await getTranslations()

  const items = [
    {
      href: '/settings/ai-keys',
      icon: KeyRound,
      title: t('settings.aiKeys.title'),
      desc: t('settings.aiKeys.subtitle'),
    },
    {
      href: '/settings/team',
      icon: Users,
      title: t('dashboard.contacts'),
      desc: t('settings.title'),
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">
        {t('settings.title')}
      </h1>
      <div className="space-y-3">
        {items.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-hover)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--text-primary)]">
                {title}
              </div>
              <div className="truncate text-sm text-[var(--text-secondary)]">
                {desc}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] rtl:rotate-180" />
          </Link>
        ))}
      </div>
    </div>
  )
}
