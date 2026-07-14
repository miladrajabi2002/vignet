'use client'

import { cn } from '@/lib/utils'

/**
 * Shared toggle switch with a high-contrast on state: ink (black) track +
 * white knob when on, muted track + bordered white knob when off, so the
 * state is readable at a glance on the light theme.
 */
export function Switch({
	checked,
	onChange,
	disabled,
	className,
	'aria-label': ariaLabel,
}: {
	checked: boolean
	onChange: (v: boolean) => void
	disabled?: boolean
	className?: string
	'aria-label'?: string
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
				checked
					? 'border-[var(--white)] bg-[var(--white)]'
					: 'border-[var(--border-hover)] bg-[var(--bg-muted)]',
				className,
			)}
		>
			<span
				className={cn(
					'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full shadow-sm transition-[inset-inline-start,background-color,transform] duration-200',
					checked
						? 'start-6 bg-[var(--bg-base)]'
						: 'start-1 border border-[var(--border-hover)] bg-[var(--bg-base)]',
				)}
			/>
		</button>
	)
}
