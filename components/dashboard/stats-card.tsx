import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatsCard({
	label,
	value,
	icon: Icon,
	hint,
	className,
}: {
	label: string
	value: string | number
	icon: LucideIcon
	hint?: string
	className?: string
}) {
	return (
		<div
			className={cn(
				'dashboard-card group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white/[0.92] p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-[0_18px_46px_rgba(10,10,10,0.07)]',
				className,
			)}
		>
			<div aria-hidden className="pointer-events-none absolute -end-10 -top-12 h-28 w-28 rounded-full bg-[var(--accent-soft)] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
				<span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
					<Icon className="h-4 w-4" />
				</span>
			</div>
			<div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</div>
			{hint ? (
				<div className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</div>
			) : null}
		</div>
	)
}
