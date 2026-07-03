import { cn } from '@/lib/utils'

/**
 * Theme-aware Panel for the user dashboard.
 * Uses CSS variables so it works in both light and dark themes.
 *
 * (The admin panel has its own Panel in app/admin/(dash)/ui.tsx with
 * hardcoded light-theme classes — that one is intentionally separate.)
 */
export function DashboardPanel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-[var(--bg-surface)] p-5 transition-colors',
        className,
      )}
      style={{ borderColor: 'var(--border-default)' }}
    >
      {title && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
