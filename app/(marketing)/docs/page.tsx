import { getLocale } from 'next-intl/server'
import { DocContent } from '@/components/docs/doc-content'
import { getDoc, type Locale } from '@/lib/docs/content'

export default async function DocsHomePage() {
  const locale = (await getLocale()) as Locale
  const page = getDoc('introduction')!
  return <DocContent page={page} locale={locale} />
}
