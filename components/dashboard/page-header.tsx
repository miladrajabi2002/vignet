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
 *  - `actions`     end-aligned beside the title at every width. On phones the
 *                  title keeps at least 8rem, the actions take the rest (and
 *                  scroll if they still do not fit), and the subtitle moves
 *                  under both at full width. When a tablet column is too
 *                  narrow for both, the actions drop to a second row so the
 *                  title never breaks inside a word.
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
      <div className="grid grid-cols-[minmax(8rem,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
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
            {subtitle && <p className="page-header-subtitle max-sm:hidden">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto py-0.5 [&>:first-child]:ms-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 sm:shrink-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:py-0">
            {actions}
          </div>
        )}
        {/* Phones: the subtitle runs under the title and the actions at full width. */}
        {subtitle && <p className="page-header-subtitle col-span-2 !mt-0 sm:hidden">{subtitle}</p>}
      </div>
    </header>
  )
}
