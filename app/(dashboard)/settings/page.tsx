import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { UserRound, ChevronRight, SlidersHorizontal } from 'lucide-react'
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

  const items = [
    {
      href: '/settings/team',
      icon: UserRound,
      title: locale === 'fa' ? 'تنظیمات مشتری' : 'Customer settings',
      desc: locale === 'fa' ? 'نام، زبان و اطلاعات حساب کاربری' : 'Name, language and account identity',
    },
  ]

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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Vigento AI</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{locale === 'fa' ? 'هویت کسب‌وکار، حساب، گزارش‌ها و مسیر تحویل اپراتور را مدیریت کنید.' : 'Manage business identity, account, reports and operator handoff.'}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="spatial-surface group flex items-center gap-4 rounded-[1.5rem] p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white shadow-[var(--shadow-control)]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--text-primary)]">
                {title}
              </div>
              <div className="truncate text-sm text-[var(--text-secondary)]">
                {desc}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        ))}
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
