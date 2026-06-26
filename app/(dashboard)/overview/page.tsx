import { getTranslations } from 'next-intl/server'
import { Bot, MessagesSquare, Users, Package } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'
import { computeOnboarding } from '@/lib/onboarding'

export default async function OverviewPage() {
  const user = await requireUser()
  const t = await getTranslations('dashboard')

  const [agents, conversations, contacts, products, onboarding] =
    await Promise.all([
      prisma.agent.count({ where: { workspaceId: user.workspaceId } }),
      prisma.conversation.count({ where: { workspaceId: user.workspaceId } }),
      prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
      prisma.product.count({ where: { workspaceId: user.workspaceId } }),
      computeOnboarding(user.workspaceId),
    ])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">
        {t('overview')}
      </h1>

      {!onboarding.completed && (
        <OnboardingChecklist initialState={onboarding} />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label={t('agents')} value={agents} icon={Bot} />
        <StatsCard
          label={t('conversations')}
          value={conversations}
          icon={MessagesSquare}
        />
        <StatsCard label={t('contacts')} value={contacts} icon={Users} />
        <StatsCard label={t('products')} value={products} icon={Package} />
      </div>
    </div>
  )
}
