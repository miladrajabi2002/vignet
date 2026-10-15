import { cn } from '@/lib/utils'
import type { NavStatus } from '@/lib/dashboard/nav-status'

/**
 * The mark beside a menu item: a breathing green dot while a connection is
 * live, an amber dot while it is half set up, a red count (or dot) when it
 * needs the owner. The label goes to screen readers; the item's own title
 * carries it as a tooltip.
 */
export function NavStatusMark({ status, locale, className }: { status: NavStatus; locale: string; className?: string }) {
	return (
		<span className={cn('inline-flex shrink-0 items-center', className)}>
			<span className="sr-only">{status.label}</span>
			{status.tone === 'alert' && status.count ? (
				<span aria-hidden className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
					{status.count.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR')}
				</span>
			) : (
				<span aria-hidden className={cn('nav-status-dot', `nav-status-${status.tone}`)} />
			)}
		</span>
	)
}
