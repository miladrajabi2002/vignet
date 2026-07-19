import { getLocale, getTranslations } from 'next-intl/server'
import { SlidersHorizontal } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
        OperatorChannelSetup,
        type OperatorChannelInfo,
        type OperatorChannelStats,
} from '@/components/crm/operator-channel-setup'
import { WeeklyReportCard } from '@/components/settings/weekly-report-card'
import { BusinessProfileStep } from '@/components/onboarding/business-profile-step'
import { readBusinessProfile } from '@/lib/verticals/profile'
import type { BusinessTypeValue } from '@/lib/verticals/registry'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function SettingsPage() {
  const t = await getTranslations()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const user = await requireUser()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)

  // All operator-center data is loaded together so the client can render a
  // useful management dashboard immediately, before its optional live check.
  const [workspace, op, open, claimed, resolved7d, total7d, delivered7d, latestAlert] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: {
        name: true,
        reportEmail: true,
        businessType: true,
        businessProfile: true,
      },
    }),
    prisma.operatorChannel.findUnique({
      where: { workspaceId: user.workspaceId },
      select: {
        id: true,
        botUsername: true,
        operatorChatId: true,
        active: true,
        lastError: true,
        botToken: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.handoffAlert.count({ where: { workspaceId: user.workspaceId, state: 'open' } }),
    prisma.handoffAlert.count({ where: { workspaceId: user.workspaceId, state: 'claimed' } }),
    prisma.handoffAlert.count({
      where: { workspaceId: user.workspaceId, state: 'resolved', resolvedAt: { gte: sevenDaysAgo } },
    }),
    prisma.handoffAlert.count({ where: { workspaceId: user.workspaceId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.handoffAlert.count({
      where: {
        workspaceId: user.workspaceId,
        createdAt: { gte: sevenDaysAgo },
        externalMessageId: { not: null },
      },
    }),
    prisma.handoffAlert.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])
  const operatorChannel: OperatorChannelInfo | null = op
    ? {
        id: op.id,
        botUsername: op.botUsername,
        operatorChatId: op.operatorChatId,
        active: op.active,
        lastError: op.lastError,
        botTokenMasked: op.botToken ? '••••' : null,
        createdAt: op.createdAt.toISOString(),
        updatedAt: op.updatedAt.toISOString(),
      }
    : null
  const operatorStats: OperatorChannelStats = {
    open,
    claimed,
    resolved7d,
    total7d,
    delivered7d,
    deliveryRate: total7d > 0 ? Math.round((delivered7d / total7d) * 100) : null,
    latestAlertAt: latestAlert?.createdAt.toISOString() ?? null,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={SlidersHorizontal}
        title={t('settings.title')}
        subtitle={locale === 'fa' ? 'هویت کسب‌وکار، حساب، گزارش‌ها و مسیر تحویل اپراتور را مدیریت کنید.' : 'Manage business identity, account, reports and operator handoff.'}
      />
      {workspace && (
        <BusinessProfileStep
          workspaceName={workspace.name}
          initialType={workspace.businessType as BusinessTypeValue}
          initialProfile={readBusinessProfile(workspace.businessProfile)}
          mode="settings"
        />
      )}

      <OperatorChannelSetup current={operatorChannel} stats={operatorStats} />

      <WeeklyReportCard initialEmail={workspace?.reportEmail ?? ''} />
    </div>
  )
}
