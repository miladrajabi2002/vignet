import type { LucideIcon } from 'lucide-react'

/**
 * Reusable "این اعداد از کجا می‌آیند؟" / "Where do these numbers come from?"
 * explainer panel. Renders a list of icon + term + explanation rows inside a
 * bordered card so the user always understands how each metric is computed.
 *
 * Used on /overview, /agents/[id]/analytics, /conversations, /contacts.
 */

export interface ExplainerItem {
  icon: LucideIcon
  /** Tailwind text color class for the icon, e.g. 'text-warning', 'text-success'. */
  iconClass?: string
  /** Bold term prefix shown before the explanation. */
  term: string
  /** The explanation body. */
  body: string
}

export function MetricsExplainer({
  title,
  items,
}: {
  title: string
  items: ExplainerItem[]
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <h2 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">{title}</h2>
      <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <li key={i} className="flex gap-2">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${item.iconClass ?? 'text-[var(--text-secondary)]'}`}
              />
              <div>
                <strong className="text-[var(--text-primary)]">{item.term}</strong>
                {item.body}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
