'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Bot,
  Package,
  MessagesSquare,
  Users,
  BarChart3,
  Plug,
  CreditCard,
  Settings,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

const NAV = [
  { key: 'overview', href: '/overview', icon: LayoutDashboard },
  { key: 'agents', href: '/agents', icon: Bot },
  { key: 'products', href: '/products', icon: Package },
  { key: 'conversations', href: '/conversations', icon: MessagesSquare },
  { key: 'contacts', href: '/contacts', icon: Users },
  { key: 'analytics', href: '/analytics', icon: BarChart3 },
  { key: 'integrations', href: '/integrations', icon: Plug },
  { key: 'billing', href: '/billing', icon: CreditCard },
  { key: 'settings', href: '/settings', icon: Settings },
] as const

export function Sidebar() {
  const t = useTranslations('dashboard')
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-[var(--border-default)] bg-[var(--bg-surface)] p-4 md:flex">
      <Link
        href="/overview"
        className="mb-8 flex items-center gap-2 px-2 py-1"
      >
        <Logo className="h-5 w-auto text-[var(--text-primary)]" />
      </Link>

      <Link
        href="/onboarding"
        className={cn(
          'mb-4 flex items-center gap-3 rounded-xl border border-[var(--border-default)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
          pathname.startsWith('/onboarding')
            ? 'border-[var(--border-strong)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)]',
        )}
      >
        <Rocket className="h-4 w-4" />
        {t('onboarding')}
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ key, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(key)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
