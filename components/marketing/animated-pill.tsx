import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type BaseProps = {
	children: ReactNode
	className?: string
	inverse?: boolean
}

/**
 * The small orbiting announcement used above public-page H1s. It mirrors the
 * Writora spark treatment while keeping the control readable in Vigent's
 * light visual system.
 */
export function MarketingHeroPill({
	children,
	href,
	className,
	showArrow = false,
}: BaseProps & { href?: string; showArrow?: boolean }) {
	const content = (
		<>
			<span aria-hidden className="marketing-hero-pill__spark" />
			<span aria-hidden className="marketing-hero-pill__surface" />
			<span className="marketing-hero-pill__content">
				<Sparkles className="size-3.5 text-violet-300" strokeWidth={1.8} aria-hidden />
				<span>{children}</span>
				{showArrow ? (
					<ArrowLeft
						className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
						aria-hidden
					/>
				) : null}
			</span>
		</>
	)

	const rootClassName = cn('marketing-hero-pill group', className)
	return href ? (
		<Link href={href} className={rootClassName}>
			{content}
		</Link>
	) : (
		<span className={rootClassName}>{content}</span>
	)
}

/** Animated conic-outline label used above public marketing section titles. */
export function MarketingSectionPill({ children, className, inverse = false }: BaseProps) {
	return (
		<span className={cn('marketing-section-pill', inverse && 'marketing-section-pill--inverse', className)}>
			<span aria-hidden className="marketing-section-pill__spin" />
			<span className="marketing-section-pill__content">{children}</span>
		</span>
	)
}
