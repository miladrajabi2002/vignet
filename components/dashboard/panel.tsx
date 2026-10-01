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
        'spatial-surface min-w-0 overflow-hidden rounded-card p-5 sm:p-6',
        className,
      )}
    >
      {title && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="ui-h3">{title}</h2>
            {subtitle && (
              <p className="ui-caption mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
