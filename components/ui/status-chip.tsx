import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One status chip for the whole product (ط۵). Tones follow the public
 * site's palette: `ok` green, `warn` amber, `danger` red, `signal` violet
 * for live / in-progress / AI states, `live` ink, `neutral` grey. Styles live
 * in app/ui-system.css (`.ui-chip*`) so tables, cards and sheets agree.
 */
export type ChipTone = 'ok' | 'warn' | 'danger' | 'signal' | 'live' | 'neutral'

export function StatusChip({
	tone,
	children,
	dot = false,
	pulse = false,
	className,
}: {
	tone: ChipTone
	children: ReactNode
	/** Leading status dot. */
	dot?: boolean
	/** Ping the dot — for states that need attention now. */
	pulse?: boolean
	className?: string
}) {
	return (
		<span className={cn('ui-chip', `ui-chip-${tone}`, className)}>
			{dot || pulse ? (
				<span aria-hidden className="relative inline-flex">
					{pulse ? <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-50 motion-reduce:animate-none" /> : null}
					<span className="ui-chip-dot relative" />
				</span>
			) : null}
			{children}
		</span>
	)
}

/** Maps legacy tone names (admin + dashboard) onto the chip tones. */
export const LEGACY_TONE: Record<string, ChipTone> = {
	success: 'ok',
	warning: 'warn',
	danger: 'danger',
	info: 'signal',
	muted: 'neutral',
	default: 'live',
}
