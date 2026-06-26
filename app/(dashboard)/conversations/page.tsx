import { getTranslations } from 'next-intl/server'
import { ComingSoon } from '@/components/dashboard/coming-soon'

export default async function ConversationsPage() {
  const t = await getTranslations('dashboard')
  return <ComingSoon title={t('conversations')} />
}
