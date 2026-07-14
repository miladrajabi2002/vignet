'use client'

export interface NamedPoint {
  label: string
  value: number
}

/**
 * Theme-aware horizontal bar list — compact ranking chart.
 * Each row: label + value, with a proportional bar underneath.
 */
export function DashboardBarList({
  data,
  formatValue,
  color = 'var(--text-primary)',
  emptyText = 'داده‌ای نیست',
}: {
  data: NamedPoint[]
  formatValue?: (v: number) => string
  color?: string
  emptyText?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={i}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-[var(--text-secondary)]">{d.label}</span>
            <span className="shrink-0 font-semibold text-[var(--text-primary)]">
              {formatValue ? formatValue(d.value) : d.value.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
        </li>
      ))}
      {data.length === 0 && (
        <li className="py-4 text-center text-xs text-[var(--text-muted)]">{emptyText}</li>
      )}
    </ul>
  )
}
