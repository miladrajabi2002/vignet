import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { parseSiteVariant } from '@/lib/marketing/site-variant'

export type SiteParams = Promise<{ variant: string }>

/**
 * Every public layout, page and generateMetadata calls this first: it pins the
 * request locale from the URL so next-intl never reads cookies or headers,
 * which keeps the page statically renderable.
 */
export async function enterSite(params: SiteParams) {
	const variant = parseSiteVariant((await params).variant)
	if (!variant) notFound()
	setRequestLocale(variant.locale)
	return variant
}
