import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Shared Vigent wordmark with a stable 4:1 frame to prevent layout shift.
 * The current 3:2 PNG contains substantial transparent margins, so it is
 * deliberately center-cropped to make the visible wordmark legible. When a
 * tightly-cropped transparent wordmark replaces public/logo.png, change the
 * Image class below to `object-contain`; caller dimensions can remain 4:1.
 */
export function Logo({
	className,
	priority = false,
}: {
	className?: string
	priority?: boolean
}) {
	return (
		<span className={cn('relative block h-12 w-48 shrink-0 overflow-hidden', className)}>
			<Image
				src="/logo.svg"
				alt="Vigent"
				fill
				priority={priority}
				sizes="192px"
				className="object-cover object-center"
			/>
		</span>
	)
}
