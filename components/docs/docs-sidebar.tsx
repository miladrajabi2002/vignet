'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { List, ChevronDown, Search, X } from 'lucide-react'
import { DOCS_NAV } from '@/lib/docs/nav'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
}

function DocsSearchField({
  query,
  onQueryChange,
  locale,
  dark = false,
}: {
  query: string
  onQueryChange: Dispatch<SetStateAction<string>>
  locale: 'fa' | 'en'
  dark?: boolean
}) {
  const label = locale === 'fa' ? 'جست‌وجو در راهنماها' : 'Search documentation'

  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search
        className={cn('pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2', dark ? 'text-white/60' : 'text-[var(--text-muted)]')}
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={label}
        className={cn(
          'min-h-11 w-full rounded-xl border ps-10 pe-10 text-base outline-none transition-[border-color,background-color,box-shadow] focus:ring-2 md:text-sm',
          dark
            ? 'border-white/10 bg-white/[0.065] text-white placeholder:text-white/60 focus:border-white/25 focus:ring-white/15'
            : 'border-black/10 bg-black/[0.025] text-black placeholder:text-black/40 focus:border-black/25 focus:bg-white focus:ring-black/10',
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          aria-label={locale === 'fa' ? 'پاک کردن جست‌وجو' : 'Clear search'}
          className={cn(
            'absolute end-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2',
            dark ? 'text-white/60 hover:text-white focus-visible:ring-[var(--focus-ring)]' : 'text-[var(--text-muted)] hover:text-black focus-visible:ring-[var(--focus-ring)]',
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </label>
  )
}

export function DocsSidebar() {
  const pathname = usePathname()
  const locale = useLocale() as 'fa' | 'en'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeItem = DOCS_NAV.find(({ href }) => pathname === href) ?? DOCS_NAV[0]
  const normalizedQuery = normalizeSearch(query)
  const filteredItems = normalizedQuery
    ? DOCS_NAV.filter(({ slug, title }) =>
        normalizeSearch(`${title.fa} ${title.en} ${slug}`).includes(normalizedQuery),
      )
    : DOCS_NAV

  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 rounded-[calc(var(--radius-card)-4px)] px-3 text-start text-sm font-semibold text-[var(--text-primary)] md:hidden"
      >
        <List className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {locale === 'fa' ? activeItem.title.fa : activeItem.title.en}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      <nav className="hidden min-w-0 flex-col gap-1 md:flex" aria-label={locale === 'fa' ? 'فهرست مستندات' : 'Documentation navigation'}>
        <div className="mb-2">
          <DocsSearchField query={query} onQueryChange={setQuery} locale={locale} />
        </div>
        {filteredItems.map(({ slug, href, icon: Icon, title }) => {
          const active = pathname === href
          return (
            <Link key={slug} href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', active ? 'bg-[var(--signal-soft)] font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]')}>
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[var(--signal)]' : 'text-[var(--text-hint)]')} aria-hidden="true" />
              {locale === 'fa' ? title.fa : title.en}
            </Link>
          )
        })}
        {filteredItems.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border-default)] px-3 py-5 text-center text-xs leading-6 text-[var(--text-muted)]">
            {locale === 'fa' ? 'راهنمایی با این عبارت پیدا نشد.' : 'No guide matches this search.'}
          </p>
        )}
      </nav>

      <MobileBottomSheet
        open={open}
        title={locale === 'fa' ? 'فهرست راهنما' : 'Documentation index'}
        description={locale === 'fa' ? 'موضوع موردنظر را انتخاب کنید.' : 'Choose a topic to continue.'}
        closeLabel={locale === 'fa' ? 'بستن' : 'Close'}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
      >
        <div className="mb-4">
          <DocsSearchField query={query} onQueryChange={setQuery} locale={locale} />
          <p className="mt-2 text-xs text-[var(--text-muted)]" aria-live="polite">
            {locale === 'fa'
              ? `${filteredItems.length.toLocaleString('fa-IR')} راهنما`
              : `${filteredItems.length} guides`}
          </p>
        </div>
        <nav className="grid gap-2" aria-label={locale === 'fa' ? 'فهرست مستندات' : 'Documentation navigation'}>
          {filteredItems.map(({ slug, href, icon: Icon, title }) => {
            const active = pathname === href
            return (
              <Link key={slug} href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold', active ? 'border-[var(--signal-border)] bg-[var(--signal-soft)] text-[var(--text-primary)]' : 'border-[var(--border-default)] bg-white text-[var(--text-primary)]')}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {locale === 'fa' ? title.fa : title.en}
              </Link>
            )
          })}
          {filteredItems.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              {locale === 'fa' ? 'راهنمایی با این عبارت پیدا نشد.' : 'No guide matches this search.'}
            </p>
          )}
        </nav>
      </MobileBottomSheet>
    </>
  )
}
