import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatsCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-hover)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <Icon className="h-4 w-4 text-[var(--text-muted)]" />
      </div>
      <div className="mt-3 text-3xl font-light text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  )
}
