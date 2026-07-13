import { getLocale, getTranslations } from 'next-intl/server'
import { SlidersHorizontal } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
        OperatorChannelSetup,
        type OperatorChannelInfo,
} from '@/components/crm/operator-channel-setup'
import { WeeklyReportCard } from '@/components/settings/weekly-report-card'
import { BusinessProfileStep } from '@/components/onboarding/business-profile-step'
import { readBusinessProfile } from '@/lib/verticals/profile'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

export default async function SettingsPage() {
  const t = await getTranslations()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const user = await requireUser()

  // Load the workspace's operator Telegram bot (masked) so the setup card can
  // render without an extra round-trip. We strip the raw token here — only the
  // masked hint is sent to the client.
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: {
      name: true,
      reportEmail: true,
      businessType: true,
      businessProfile: true,
    },
  })

  const op = await prisma.operatorChannel.findUnique({
    where: { workspaceId: user.workspaceId },
    select: {
      id: true,
      botUsername: true,
      operatorChatId: true,
      active: true,
      lastError: true,
      botToken: true,
    },
  })
  const operatorChannel: OperatorChannelInfo | null = op
    ? {
        id: op.id,
        botUsername: op.botUsername,
        operatorChatId: op.operatorChatId,
        active: op.active,
        lastError: op.lastError,
        botTokenMasked: op.botToken ? '••••' : null,
      }
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><SlidersHorizontal className="h-5 w-5" /></span>
        <div>
          <p className="text-[10px] font-bold text-[var(--text-muted)]">{locale === 'fa' ? 'مرکز تنظیمات کسب‌وکار' : 'Business settings center'}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{locale === 'fa' ? 'هویت کسب‌وکار، حساب، گزارش‌ها و مسیر تحویل اپراتور را مدیریت کنید.' : 'Manage business identity, account, reports and operator handoff.'}</p>
        </div>
      </div>
      {workspace && (
        <BusinessProfileStep
          workspaceName={workspace.name}
          initialType={workspace.businessType as BusinessTypeValue}
          initialProfile={readBusinessProfile(workspace.businessProfile)}
          mode="settings"
        />
      )}

      <OperatorChannelSetup current={operatorChannel} />

      <WeeklyReportCard initialEmail={workspace?.reportEmail ?? ''} />
    </div>
  )
}
