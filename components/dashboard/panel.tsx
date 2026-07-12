import { cn } from '@/lib/utils'

/**
 * Dashboard panel — pure white card, thin border, very soft shadow.
 * OpenAI-style: minimal, calm, lots of breathing room.
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
        'rounded-xl border border-[var(--border-default)] bg-white p-5 sm:p-6',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {title && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h2>
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
