'use client'

import { useLocale } from 'next-intl'
import { NotFoundView } from '@/components/marketing/not-found-view'
import { toSiteLocale } from '@/components/marketing/site/ui'

// A client component so the 404 needs no request data: the locale comes from
// the root layout's intl provider, which got it from the URL.
export default function SiteNotFound() {
	return <NotFoundView locale={toSiteLocale(useLocale())} />
}
