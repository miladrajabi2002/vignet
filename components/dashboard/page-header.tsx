import { type LucideIcon } from 'lucide-react'

/**
 * Shared dashboard page header — unifies every dashboard page under one
 * consistent "card hero" pattern (icon box + title + optional subtitle +
 * optional right-side actions slot).
 *
 * Replaces the 3+ drifted header styles:
 *   - "services-style"  (spatial-surface card + icon + kicker + h1 + subtitle)
 *   - "conversations-style" (bare text, no card, font-light h1)
 *   - "analytics-style"   (pill kicker + h1 + back button)
 *
 * Usage:
 *   <PageHeader
 *     icon={MessagesSquare}
 *     title={t('title')}
 *     subtitle={t('subtitle')}
 *   />
 *
 *   <PageHeader
 *     icon={Bot}
 *     title={t('title')}
 *     subtitle={t('subtitle')}
 *     actions={<Link href="/agents/new" className="...">New</Link>}
 *   />
 *
 * The card uses `spatial-surface` (consistent shadow + bg with the rest of
 * the dashboard cards), `rounded-[1.5rem]` (matches the channels/knowledge
 * pages), and a black icon box (matches /services, /menu, /overview,
 * /agents/[agentId] layout). The h1 is `text-2xl font-bold tracking-tight`.
 *
 * IMPORTANT: by request, there is NO kicker / eyebrow text above the title.
 * Pages that previously had a kicker ("مرکز تنظیمات کسب‌وکار", "اعتبار و
 * اشتراک", "هوش کاتالوگ", etc.) should pass only `title` + `subtitle`.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon
  title: string
  subtitle?: string
  /** Optional right-side content — typically a primary action button. */
  actions?: React.ReactNode
}) {
  return (
    <header className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  )
}
