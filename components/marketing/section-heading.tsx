import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MarketingSectionPill } from './animated-pill'

export function MarketingSectionHeading({
        eyebrow,
        title,
        subtitle,
        align = 'center',
        inverse = false,
        className,
        titleClassName,
        titleStyle,
}: {
        eyebrow: string
        title: ReactNode
        subtitle?: ReactNode
        align?: 'center' | 'start'
        inverse?: boolean
        className?: string
        /** Replaces the default responsive h2 sizing entirely (e.g. the one-line title treatment). */
        titleClassName?: string
        /** Paired with titleClassName — CSS vars such as --title-fit for the cqw fit. */
        titleStyle?: CSSProperties
}) {
        return (
                <header
                        data-scroll-reveal={align === 'start' ? 'side' : 'up'}
                        className={cn(
                                align === 'center' ? 'mx-auto max-w-3xl text-center [container-type:inline-size]' : 'max-w-2xl text-start',
                                className,
                        )}
                >
                        <MarketingSectionPill inverse={inverse}>{eyebrow}</MarketingSectionPill>
                        <h2
                                style={titleStyle}
                                className={cn(
                                        'mt-5 font-semibold leading-[1.24] tracking-[-0.04em] rtl:tracking-normal sm:mt-6',
                                        inverse ? 'text-white' : 'text-black',
                                        titleClassName ??
                                                'text-balance text-[clamp(1.75rem,6.4vw,3.9rem)] sm:text-[clamp(2.15rem,5vw,4rem)]',
                                )}
                        >
                                {title}
                        </h2>
                        {subtitle ? (
                                <p className={cn('mt-3 text-pretty text-[13px] leading-7 sm:mt-4 sm:text-[15px] sm:leading-8', inverse ? 'text-white/55' : 'text-black/55')}>{subtitle}</p>
                        ) : null}
                </header>
        )
}
