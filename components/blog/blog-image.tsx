import { blogImageSources } from '@/lib/blog/image-variants'

/**
 * Blog image with device-sized WebP variants (see lib/blog/image-variants).
 *
 * `priority` is for the one above-the-fold image that is likely the page's
 * LCP element: it loads eagerly with high fetch priority. Everything else is
 * native-lazy, so text and layout paint first and images stream in as the
 * reader scrolls. No client JS: works in server and client components.
 */
export function BlogImage({
	src,
	alt,
	sizes,
	className,
	priority = false,
	width = 1600,
	height = 1000,
}: {
	src: string
	alt: string
	/** Rendered width per breakpoint, e.g. "(min-width: 1024px) 384px, 100vw". */
	sizes: string
	className?: string
	priority?: boolean
	/** Intrinsic ratio hint (reserves space before the file arrives). */
	width?: number
	height?: number
}) {
	const responsive = blogImageSources(src)
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={responsive?.src ?? src}
			srcSet={responsive?.srcSet}
			sizes={responsive ? sizes : undefined}
			alt={alt}
			width={width}
			height={height}
			loading={priority ? 'eager' : 'lazy'}
			fetchPriority={priority ? 'high' : 'auto'}
			decoding="async"
			className={className}
		/>
	)
}
