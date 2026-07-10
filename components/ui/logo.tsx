import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Vigent brand logo.
 *
 * Renders the logo image from /public/logo.svg (preferred — vector, crisp at
 * any size, tiny file) so the same asset is reused across the navbar, footer,
 * dashboard sidebar, auth screen, etc. Swap the file at public/logo.svg with
 * your own and it appears everywhere instantly — no code change needed.
 *
 * Recommended asset:
 *   - public/logo.svg  → vector wordmark, transparent background (BEST).
 *   - public/logo.png  → fallback raster (transparent PNG, ≥512px tall).
 *   - Aspect ratio 3:2 (e.g. 1536×1024) matches the width/height below; if
 *     your file has a different ratio, update width/height to keep it
 *     undistorted (the className h-* w-auto then scales it to the rendered
 *     height and preserves the aspect ratio).
 *
 * The site is a single light theme, so a single dark/brand-colored logo on a
 * transparent background reads correctly in every current placement.
 *
 * `className` controls the rendered size — callers pass e.g. "h-5 w-auto".
 * The legacy `text-[…]` classes are accepted but ignored (they only affected
 * the old inline-SVG `currentColor` fill).
 */
export function Logo({
	className,
	priority = false,
}: {
	className?: string
	priority?: boolean
}) {
	return (
		<span className={cn('relative inline-block shrink-0 overflow-hidden', className)}>
			<Image
				src="/logo.png"
				alt="Vigent"
				fill
				priority={priority}
				sizes="(max-width: 768px) 128px, 144px"
				className="object-cover object-center"
			/>
		</span>
	)
}
