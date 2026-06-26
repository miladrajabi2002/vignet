import { getTranslations } from 'next-intl/server'
import { ComingSoon } from '@/components/dashboard/coming-soon'

export default async function TeamPage() {
  const t = await getTranslations('settings')
  return <ComingSoon title={t('title')} />
}
