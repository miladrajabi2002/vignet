import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Shared Vigent wordmark. public/logo.svg has a tight viewBox, so callers can
 * scale the wordmark without cropping or losing sharpness.
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
				className="object-contain object-center"
			/>
		</span>
	)
}
