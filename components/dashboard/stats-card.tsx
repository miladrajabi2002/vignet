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
				'spatial-surface rounded-card p-5',
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<span className="ui-caption font-medium">{label}</span>
				<span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)]">
					<Icon className="h-[1.05rem] w-[1.05rem]" />
				</span>
			</div>
			<div className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</div>
			{hint ? (
				<div className="ui-caption mt-1">{hint}</div>
			) : null}
		</div>
	)
}
