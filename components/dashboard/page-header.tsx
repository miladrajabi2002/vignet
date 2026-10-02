import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BackButton } from '@/components/dashboard/back-button'
import { cn } from '@/lib/utils'

/**
 * Shared page header for the user dashboard AND the admin panel.
 *
 * A quiet title bar instead of a card: the page title sits directly on the
 * canvas and the content cards below carry the weight. Anatomy, in reading
 * order:
 *
 *   (‹)  [■]  Title                                   [actions]
 *             Subtitle
 *   ─────────────── hairline that fades at both ends ───────────────
 *
 *  - `back`        round back control at the very start of the row (history
 *                  back when possible, `href` otherwise — see BackButton).
 *                  On phones the icon tile is dropped next to it so the title
 *                  keeps its width.
 *  - `icon`        ink tile with a soft top highlight.
 *  - `breadcrumbs` optional tiny trail above the title (admin detail pages).
 *  - `actions`     end-aligned on desktop, a single scrollable row on phones.
 *                  When the column is too narrow for both (tablets next to
 *                  the rail), the actions drop to a second row so the title
 *                  never breaks inside a word.
 *
 * By request there is no kicker / eyebrow copy above the title — only the
 * optional breadcrumb trail, which is navigation, not decoration.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  back,
  breadcrumbs,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Optional end-side content — typically the page's primary action. */
  actions?: React.ReactNode
  /** Where the round back control goes (label is used for its accessible name). */
  back?: { href: string; label: string }
  breadcrumbs?: { label: string; href?: string }[]
  className?: string
}) {
  return (
    <header className={cn('dashboard-page-header', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:min-w-[min(100%,17rem)] sm:flex-1 sm:gap-3.5">
          {back && <BackButton href={back.href} label={back.label} variant="icon" />}
          {back && Icon && <span aria-hidden className="hidden h-8 w-px shrink-0 bg-black/[0.08] sm:block" />}
          {Icon && (
            <span className={cn('page-header-icon', back && 'max-sm:hidden')}>
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="breadcrumb" className="mb-0.5">
                <ol className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-[var(--text-muted)]">
                  {breadcrumbs.map((crumb, index) => {
                    const last = index === breadcrumbs.length - 1
                    return (
                      <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                        {crumb.href && !last ? (
                          <Link href={crumb.href} className="rounded transition-colors hover:text-[var(--text-primary)]">
                            {crumb.label}
                          </Link>
                        ) : (
                          <span aria-current={last ? 'page' : undefined} className={last ? 'text-[var(--text-secondary)]' : undefined}>
                            {crumb.label}
                          </span>
                        )}
                        {!last && <ChevronLeft aria-hidden className="h-3 w-3 opacity-50 ltr:rotate-180" />}
                      </li>
                    )
                  })}
                </ol>
              </nav>
            )}
            <h1 className="ui-h1 page-header-title">{title}</h1>
            {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
