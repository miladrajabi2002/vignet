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
    <nav className="flex min-w-max gap-1 md:min-w-0 md:flex-col" aria-label={locale === 'fa' ? 'فهرست مستندات' : 'Documentation navigation'}>
      {DOCS_NAV.map(({ slug, href, icon: Icon, title }) => {
        const active = pathname === href
        return (
          <Link
            key={slug}
            href={href}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              active
                ? 'bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.08)]'
                : 'text-white/50 hover:bg-white/[0.08] hover:text-white',
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
