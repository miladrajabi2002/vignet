import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChevronRight, ChevronLeft } from 'lucide-react'

/**
 * Server-rendered prev/next pagination. Built for list pages that read a `page`
 * search param. `makeHref(page)` is called during render to build each link, so
 * the caller stays in control of which other search params to preserve.
 *
 * RTL-aware: in Persian the chevrons read right-to-left, so "previous" uses the
 * right chevron and "next" the left.
 */
export async function Pagination({
  page,
  hasNext,
  makeHref,
}: {
  page: number
  hasNext: boolean
  makeHref: (page: number) => string
}) {
  const t = await getTranslations('common')
  if (page <= 1 && !hasNext) return null

  return (
    <nav className="flex items-center justify-between gap-3 pt-2">
      <PageLink
        href={page > 1 ? makeHref(page - 1) : null}
        label={t('previous')}
        icon={<ChevronRight className="h-4 w-4" />}
      />
      <span className="text-xs text-[var(--text-muted)]">
        {t('page', { page })}
      </span>
      <PageLink
        href={hasNext ? makeHref(page + 1) : null}
        label={t('next')}
        icon={<ChevronLeft className="h-4 w-4" />}
        iconAfter
      />
    </nav>
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
    'inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm transition-colors'
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
