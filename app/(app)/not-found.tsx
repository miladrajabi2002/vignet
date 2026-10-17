import { getLocale } from 'next-intl/server'
import { NotFoundView } from '@/components/marketing/not-found-view'
import { toSiteLocale } from '@/components/marketing/site/ui'

export default async function NotFound() {
	return <NotFoundView locale={toSiteLocale(await getLocale())} />
}
