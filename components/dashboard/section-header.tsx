import { cn } from '@/lib/utils'

/**
 * Unified section header — wraps a title + optional subtitle in a
 * `spatial-surface` card bar, so section headers that previously floated on
 * the raw canvas ("خدمات قابل معرفی", "سناریوهای پاسخ‌گویی", …) now share the
 * same calm, cohesive surface as every other dashboard card.
 *
 * Design language (Apple / ChatGPT iOS material):
 *  - Same `spatial-surface` treatment as DashboardPanel: subtle gradient,
 *    hairline border, soft inset highlight.
 *  - Title: `text-base font-bold tracking-tight` — confident but not loud.
 *  - Subtitle: `text-sm text-secondary` — breathable, one line ideal.
 *  - Right-side `action` slot for primary buttons (e.g. "خدمت جدید").
 *  - Right-side `meta` slot for secondary info (e.g. "۳ سناریوی فعال از ۵").
 *
 * This is the "card bar" counterpart of PageHeader: PageHeader is the page
 * hero, SectionHeader is a mid-page section header. Together they give every
 * dashboard surface a single, predictable hierarchy.
 *
 * Usage:
 *   <SectionHeader
 *     title="خدمات قابل معرفی"
 *     subtitle="فعال‌بودن یعنی ویجنتو می‌تواند این خدمت را پیشنهاد دهد."
 *     action={<button>خدمت جدید</button>}
 *   />
 */
export function SectionHeader({
  title,
  subtitle,
  action,
  meta,
  className,
}: {
  title: string
  subtitle?: string
  /** Optional right-side primary action (button / link). */
  action?: React.ReactNode
  /** Optional right-side secondary text (counts, hints). */
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'spatial-surface rounded-[1.5rem] p-4 sm:p-5',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        {(action || meta) && (
          <div className="flex shrink-0 items-center gap-3">
            {meta && (
              <span className="text-xs font-medium tabular-nums text-[var(--text-muted)]">
                {meta}
              </span>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
