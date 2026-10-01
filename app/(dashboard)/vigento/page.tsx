import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { VigentoWorkspace } from '@/components/dashboard/vigento-workspace'

export default async function VigentoPage(props: { searchParams: Promise<{ q?: string }> }) {
  const [user, localeValue, searchParams] = await Promise.all([requireUser(), getLocale(), props.searchParams])
  const locale = localeValue === 'en' ? 'en' : 'fa'
  // `?q=` comes from the overview card's starter questions.
  const initialQuestion = typeof searchParams.q === 'string' ? searchParams.q.slice(0, 1000) : undefined
  return <VigentoWorkspace locale={locale} ownerName={user.name} initialQuestion={initialQuestion} />
}
