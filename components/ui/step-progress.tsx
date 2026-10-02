import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Numbered step rail + filling bar (ط۱۲) — the same language as the public
 * site's setup stepper: done steps are ink with a check, the current step is
 * the violet signal, upcoming steps stay quiet. `progress` (0–1) optionally
 * fills the current step's share of the bar (e.g. an analysis run).
 */
export function StepProgress({
	steps,
	current,
	progress,
	locale,
	className,
}: {
	steps: string[]
	current: number
	/** 0–1 progress within the current step; omitted = the step counts as half done. */
	progress?: number
	locale: 'fa' | 'en'
	className?: string
}) {
	const total = steps.length
	const within = progress === undefined ? 0.5 : Math.max(0, Math.min(1, progress))
	const filled = Math.min(1, (current + (current >= total ? 0 : within)) / total)
	const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
	return (
		<div className={cn('w-full', className)}>
			<ol className="flex items-start gap-1.5 sm:gap-2" aria-label={locale === 'fa' ? 'مراحل' : 'Steps'}>
				{steps.map((title, index) => {
					const done = index < current
					const active = index === current
					return (
						<li key={title} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2 sm:text-start">
							<span
								className={cn(
									'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors duration-200',
									done && 'bg-[var(--text-primary)] text-white',
									active && 'bg-[var(--signal)] text-white shadow-[0_0_0_4px_rgba(91,61,232,0.14)]',
									!done && !active && 'border border-[var(--border-hover)] bg-white text-[var(--text-muted)]',
								)}
							>
								{done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.6} /> : nf.format(index + 1)}
							</span>
							<span className={cn('min-w-0 max-w-full truncate text-[13px] leading-5 sm:text-[13px]', active ? 'font-bold text-[var(--text-primary)]' : done ? 'font-medium text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')}>
								{title}
							</span>
						</li>
					)
				})}
			</ol>
			<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(filled * 100)}>
				<div className="h-full rounded-full bg-[linear-gradient(90deg,var(--text-primary),var(--signal))] transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none rtl:bg-[linear-gradient(270deg,var(--text-primary),var(--signal))]" style={{ width: `${filled * 100}%` }} />
			</div>
		</div>
	)
}
