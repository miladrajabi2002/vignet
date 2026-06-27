/** Simple monochrome horizontal bar list (no chart lib needed). */
export interface BarItem {
  label: string
  value: number
}

export function BarList({ data }: { data: BarItem[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate text-[var(--text-secondary)]">
              {d.label}
            </span>
            <span className="text-[var(--text-primary)]">{d.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full bg-white/70"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
