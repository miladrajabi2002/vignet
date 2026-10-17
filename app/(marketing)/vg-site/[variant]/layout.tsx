import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { enterSite, type SiteParams } from '@/lib/marketing/enter-site'
import { SITE_VARIANTS } from '@/lib/marketing/site-variant'
import { RootDocument, rootMetadata, rootViewport } from '../../../root-document'
import '../../../marketing.css'

// Root of the static public site (see lib/marketing/site-variant.ts). Pages
// refresh at least hourly; pages with live data set a shorter revalidate, and
// admin edits to posts or prices revalidate the whole site at once.
export const revalidate = 3600

export function generateStaticParams() {
	return SITE_VARIANTS.map((variant) => ({ variant }))
}

export const viewport: Viewport = rootViewport

export async function generateMetadata({ params }: { params: SiteParams }): Promise<Metadata> {
	const { locale } = await enterSite(params)
	return rootMetadata(locale)
}

export default async function SiteRootLayout({ children, params }: { children: ReactNode; params: SiteParams }) {
	const { locale } = await enterSite(params)
	return <RootDocument locale={locale}>{children}</RootDocument>
}
