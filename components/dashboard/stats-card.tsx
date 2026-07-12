import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Minimal stat card — pure white, thin border, soft shadow, large number.
 * OpenAI-style: no decorative glows, no accent tints, just clean data.
 */
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
				'rounded-xl border border-[var(--border-default)] bg-white p-5 transition-shadow duration-150 hover:shadow-[var(--shadow-float)]',
				className,
			)}
			style={{ boxShadow: 'var(--shadow-card)' }}
		>
			<div className="flex items-center justify-between">
				<span className="text-[13px] font-medium text-[var(--text-muted)]">{label}</span>
				<span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)]">
					<Icon className="h-[1.05rem] w-[1.05rem]" />
				</span>
			</div>
			<div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</div>
			{hint ? (
				<div className="mt-1 text-xs text-[var(--text-muted)]">{hint}</div>
			) : null}
		</div>
	)
}
