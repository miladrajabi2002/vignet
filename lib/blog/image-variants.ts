/**
 * Responsive variants for uploaded blog images.
 *
 * Every image uploaded through /api/admin/blog/upload keeps its original file
 * (used for Open Graph / social previews) plus three WebP copies, one per
 * device class. Variants live next to the original:
 *
 *   1784500899592-<uuid>.png          original
 *   1784500899592-<uuid>-w480.webp    mobile
 *   1784500899592-<uuid>-w960.webp    tablet / high-DPI mobile
 *   1784500899592-<uuid>-w1600.webp   desktop
 *
 * Pure module (no fs / sharp) so client components and the markdown renderer
 * can build srcsets too. Generation lives in image-processing.ts.
 */

export const BLOG_IMAGE_WIDTHS = [480, 960, 1600] as const
export type BlogImageWidth = (typeof BLOG_IMAGE_WIDTHS)[number]

/** Base name of an uploaded original: `<timestamp>-<uuid>`. */
const ORIGINAL_FILE_RE = /^(\d{10,}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpe?g|webp|avif)$/i
const VARIANT_FILE_RE = /^(\d{10,}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-w(\d+)\.webp$/i
// Uploads return /api/uploads/blog/<file>; older content may reference the
// static /uploads/blog/<file> path. Absolute URLs on our own host also count.
const BLOG_URL_RE = /^(?:https?:\/\/[^/]+)?\/(?:api\/)?uploads\/blog\/([^/?#]+)$/i

/** GIFs are skipped: a resized WebP would drop the animation. */
export function blogImageBaseName(fileName: string): string | null {
	return ORIGINAL_FILE_RE.exec(fileName)?.[1] ?? null
}

export function blogImageVariantFileName(baseName: string, width: BlogImageWidth): string {
	return `${baseName}-w${width}.webp`
}

/** Parses `<base>-w<width>.webp`; null for anything that isn't a known variant. */
export function parseBlogImageVariant(fileName: string): { baseName: string; width: BlogImageWidth } | null {
	const match = VARIANT_FILE_RE.exec(fileName)
	if (!match) return null
	const width = Number(match[2]) as BlogImageWidth
	if (!BLOG_IMAGE_WIDTHS.includes(width)) return null
	return { baseName: match[1], width }
}

export type ResponsiveBlogImage = {
	src: string
	srcSet: string
}

/**
 * srcset for an uploaded blog image, or null when the URL isn't one of ours
 * (external CDN, GIF, data URI…) and must be rendered as-is.
 */
export function blogImageSources(url: string | null | undefined): ResponsiveBlogImage | null {
	const fileName = url ? BLOG_URL_RE.exec(url.trim())?.[1] : undefined
	const baseName = fileName ? blogImageBaseName(fileName) : null
	if (!baseName) return null
	const variantUrl = (width: BlogImageWidth) => `/api/uploads/blog/${blogImageVariantFileName(baseName, width)}`
	return {
		src: variantUrl(960),
		srcSet: BLOG_IMAGE_WIDTHS.map((width) => `${variantUrl(width)} ${width}w`).join(', '),
	}
}
