import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { VigentoWorkspace } from '@/components/dashboard/vigento-workspace'

export default async function VigentoPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  return <VigentoWorkspace locale={locale} ownerName={user.name} />
}
