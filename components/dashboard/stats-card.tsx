import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Minimal stat card — pure white, thin border, soft shadow, large number.
 * OpenAI-style: no decorative glows, no accent tints, just clean data.
 *
 * Reading order is label → figure → hint, so the number never has to be
 * decoded from the line under it. The unit sits beside the figure in small
 * muted type, and a missing value says so in words instead of a bare dash.
 */
export function StatsCard({
	label,
	value,
	unit,
	icon: Icon,
	hint,
	emptyText = 'بدون داده',
	tone = 'default',
	className,
}: {
	label: string
	/** `null` (or an empty string) renders `emptyText` instead of a figure. */
	value: string | number | null
	/** Small unit after the figure, e.g. "تومان". */
	unit?: string
	icon: LucideIcon
	hint?: string
	emptyText?: string
	tone?: 'default' | 'signal'
	className?: string
}) {
	const empty = value === null || value === ''
	return (
		<div
			className={cn(
				'spatial-surface rounded-card p-4 sm:p-5',
				className,
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[13px] leading-6 text-[var(--text-secondary)]">{label}</span>
				<span
					className={cn(
						'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
						tone === 'signal' ? 'bg-[var(--signal-soft)] text-[var(--signal-strong)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]',
					)}
				>
					<Icon className="h-[1.05rem] w-[1.05rem]" />
				</span>
			</div>
			{empty ? (
				<div className="mt-2 flex min-h-[2.625rem] items-center text-[15px] font-medium text-[var(--text-muted)]">{emptyText}</div>
			) : (
				<div className="mt-2 flex min-h-[2.625rem] items-baseline gap-1.5 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">
					{value}
					{unit ? <span className="text-[13px] font-normal tracking-normal text-[var(--text-muted)]">{unit}</span> : null}
				</div>
			)}
			{hint ? (
				<div className="ui-caption mt-0.5">{hint}</div>
			) : null}
		</div>
	)
}
