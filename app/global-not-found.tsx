import type { Metadata, Viewport } from 'next'
import { getLocale } from 'next-intl/server'
import { NotFoundView } from '@/components/marketing/not-found-view'
import { toSiteLocale } from '@/components/marketing/site/ui'
import type { Locale } from '@/lib/locale'
import { RootDocument, rootMetadata, rootViewport } from './root-document'
import './marketing.css'

// Unmatched URLs. With two root layouts there is no single root to hold a
// not-found page, so Next renders this whole document instead.
export const viewport: Viewport = rootViewport

export async function generateMetadata(): Promise<Metadata> {
	return rootMetadata(await getLocale())
}

export default async function GlobalNotFound() {
	const locale = (await getLocale()) as Locale
	return (
		<RootDocument locale={locale}>
			<NotFoundView locale={toSiteLocale(locale)} />
		</RootDocument>
	)
}
