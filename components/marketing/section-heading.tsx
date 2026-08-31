import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function MarketingSectionHeading({
	eyebrow,
	title,
	subtitle,
	align = 'center',
	inverse = false,
	className,
}: {
	eyebrow: string
	title: ReactNode
	subtitle?: ReactNode
	align?: 'center' | 'start'
	inverse?: boolean
	className?: string
}) {
	return (
		<header
			data-scroll-reveal={align === 'start' ? 'side' : 'up'}
			className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-start', className)}
		>
			<span
				className={cn(
					'inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 text-[11px] font-semibold',
					inverse ? 'border-white/15 bg-white/[0.06] text-white/65' : 'border-black/[0.08] bg-white text-black/55',
				)}
			>
				<span className={cn('size-1.5 rounded-full', inverse ? 'bg-emerald-300' : 'bg-emerald-500')} />
				{eyebrow}
			</span>
			<h2 className={cn('mt-5 text-balance text-[clamp(1.8rem,5vw,3.5rem)] font-semibold leading-[1.28] tracking-[-0.035em] rtl:tracking-normal', inverse ? 'text-white' : 'text-black')}>
				{title}
			</h2>
			{subtitle ? (
				<p className={cn('mt-4 text-pretty text-[15px] leading-8', inverse ? 'text-white/55' : 'text-black/55')}>{subtitle}</p>
			) : null}
		</header>
	)
}
