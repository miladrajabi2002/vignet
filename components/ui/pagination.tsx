import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChevronRight, ChevronLeft } from 'lucide-react'

/**
 * Server-rendered pagination with numeric page links.
 *
 * Built for list pages that read a `page` search param. `makeHref(page)` is
 * called during render to build each link, so the caller stays in control of
 * which other search params to preserve.
 *
 * RTL-aware: in Persian the chevrons read right-to-left, so "previous" uses
 * the right chevron and "next" the left. The numeric pager renders a sliding
 * window of pages around the current page so very long catalogs stay usable.
 */
export async function Pagination({
  page,
  hasNext,
  totalPages,
  makeHref,
}: {
  page: number
  hasNext: boolean
  totalPages?: number
  makeHref: (page: number) => string
}) {
  const t = await getTranslations('common')
  // If the caller didn't supply totalPages we can still render the simple
  // prev/next pager (used by other pages that haven't been migrated yet).
  const hasTotal = typeof totalPages === 'number' && totalPages > 0
  if (hasTotal) {
    if (totalPages! <= 1) return null
  } else if (page <= 1 && !hasNext) {
    return null
  }

  // Build a sliding window of page numbers (max 7 slots, current centered).
  const pages: (number | '…')[] = []
  if (hasTotal) {
    const tp = totalPages as number
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i)
    } else {
      const start = Math.max(1, page - 2)
      const end = Math.min(tp, page + 2)
      if (start > 1) {
        pages.push(1)
        if (start > 2) pages.push('…')
      }
      for (let i = start; i <= end; i++) pages.push(i)
      if (end < tp) {
        if (end < tp - 1) pages.push('…')
        pages.push(tp)
      }
    }
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 pt-2"
      aria-label="pagination"
    >
      <PageLink
        href={page > 1 ? makeHref(page - 1) : null}
        label={t('previous')}
        icon={<ChevronRight className="h-4 w-4" />}
      />

      {hasTotal && pages.map((p, idx) =>
        p === '…' ? (
          <span
            key={`gap-${idx}`}
            className="inline-flex h-9 min-w-9 items-center justify-center px-2 text-xs text-[var(--text-muted)]"
          >
            …
          </span>
        ) : (
          <NumericLink
            key={p}
            href={makeHref(p)}
            page={p}
            current={p === page}
          />
        ),
      )}

      {!hasTotal && (
        <span className="text-xs text-[var(--text-muted)]">
          {t('page', { page })}
        </span>
      )}

      <PageLink
        href={hasNext ? makeHref(page + 1) : (hasTotal && page < (totalPages as number) ? makeHref(page + 1) : null)}
        label={t('next')}
        icon={<ChevronLeft className="h-4 w-4" />}
        iconAfter
      />
    </nav>
  )
}

function NumericLink({
  href,
  page,
  current,
}: {
  href: string
  page: number
  current: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={
        current
          ? 'inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[var(--text-primary)] px-3 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)]'
          : 'inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
      }
    >
      {page}
    </Link>
  )
}

function PageLink({
  href,
  label,
  icon,
  iconAfter = false,
}: {
  href: string | null
  label: string
  icon: React.ReactNode
  iconAfter?: boolean
}) {
  const base =
    'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors'
  if (!href) {
    return (
      <span
        className={`${base} cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50`}
      >
        {!iconAfter && icon}
        {label}
        {iconAfter && icon}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className={`${base} border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]`}
    >
      {!iconAfter && icon}
      {label}
      {iconAfter && icon}
    </Link>
  )
}
