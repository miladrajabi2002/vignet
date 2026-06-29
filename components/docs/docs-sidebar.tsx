'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { DOCS_NAV } from '@/lib/docs/nav'
import { cn } from '@/lib/utils'

export function DocsSidebar() {
  const pathname = usePathname()
  const locale = useLocale() as 'fa' | 'en'

  return (
    <nav className="space-y-1">
      {DOCS_NAV.map(({ slug, href, icon: Icon, title }) => {
        const active = pathname === href
        return (
          <Link
            key={slug}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-[var(--white-10)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--white-05)] hover:text-[var(--text-primary)]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {locale === 'fa' ? title.fa : title.en}
          </Link>
        )
      })}
    </nav>
  )
}
