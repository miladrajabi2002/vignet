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
import { SettingsMobileTabs } from '@/components/settings/settings-mobile-tabs'

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
      <SettingsMobileTabs
        navigationLabel={locale === 'fa' ? 'بخش‌های تنظیمات' : 'Settings sections'}
        labels={{
          business: locale === 'fa' ? 'کسب‌وکار' : 'Business',
          operator: locale === 'fa' ? 'اپراتور' : 'Operator',
          reports: locale === 'fa' ? 'گزارش‌ها' : 'Reports',
        }}
        locale={locale}
        searchIndex={locale === 'fa'
          ? [
            { id: 'settings-business-profile', tab: 'business', tabLabel: 'کسب‌وکار', label: 'پروفایل و نوع کسب‌وکار', keywords: ['نوع کسب و کار', 'پروفایل', 'مغازه', 'کلینیک', 'آژانس', 'خدمات', 'رسته', 'حوزه', 'business type', 'profile', 'vertical'] },
            { id: 'telegram-operator', tab: 'operator', tabLabel: 'اپراتور', label: 'اتصال اپراتور تلگرام', keywords: ['اپراتور', 'تلگرام', 'بات', 'وبهوک', 'توکن', 'ارجاع', 'operator', 'telegram', 'bot', 'webhook', 'token', 'handoff'] },
            { id: 'settings-operator-health', tab: 'operator', tabLabel: 'اپراتور', label: 'سلامت و آمادگی سرویس', keywords: ['سلامت', 'وضعیت', 'بررسی', 'اتصال', 'health', 'status', 'check'] },
            { id: 'settings-operator-controls', tab: 'operator', tabLabel: 'اپراتور', label: 'کنترل‌های مدیریتی', keywords: ['کنترل', 'مدیریت', 'فعال', 'غیرفعال', 'هشدار', 'controls', 'management', 'alerts'] },
            { id: 'settings-operator-commands', tab: 'operator', tabLabel: 'اپراتور', label: 'مرکز فرمان داخل تلگرام', keywords: ['فرمان', 'دکمه', 'دستور', 'command', 'inline', 'buttons'] },
            { id: 'settings-operator-connection', tab: 'operator', tabLabel: 'اپراتور', label: 'جزئیات اتصال', keywords: ['جزئیات', 'آخرین ارجاع', 'صف', 'connection', 'details', 'queue'] },
            { id: 'settings-operator-bot', tab: 'operator', tabLabel: 'اپراتور', label: 'اتصال امن بات', keywords: ['توکن', 'امنیت', 'رمز', 'بات', 'token', 'secure', 'bot'] },
            { id: 'settings-operator-benefits', tab: 'operator', tabLabel: 'اپراتور', label: 'بعد از اتصال چه دارید؟', keywords: ['مزیت', 'امکانات', 'benefits', 'features'] },
            { id: 'settings-weekly-report', tab: 'reports', tabLabel: 'گزارش‌ها', label: 'گزارش هفتگی ایمیلی', keywords: ['گزارش', 'ایمیل', 'هفتگی', 'weekly', 'report', 'email'] },
          ]
          : [
            { id: 'settings-business-profile', tab: 'business', tabLabel: 'Business', label: 'Business profile & type', keywords: ['type', 'profile', 'vertical', 'shop', 'clinic', 'agency'] },
            { id: 'telegram-operator', tab: 'operator', tabLabel: 'Operator', label: 'Telegram operator connection', keywords: ['operator', 'telegram', 'bot', 'webhook', 'token', 'handoff'] },
            { id: 'settings-operator-health', tab: 'operator', tabLabel: 'Operator', label: 'Service health and readiness', keywords: ['health', 'status', 'check', 'connection'] },
            { id: 'settings-operator-controls', tab: 'operator', tabLabel: 'Operator', label: 'Management controls', keywords: ['controls', 'management', 'alerts'] },
            { id: 'settings-operator-commands', tab: 'operator', tabLabel: 'Operator', label: 'Telegram command center', keywords: ['command', 'inline', 'buttons'] },
            { id: 'settings-operator-connection', tab: 'operator', tabLabel: 'Operator', label: 'Connection details', keywords: ['connection', 'details', 'queue'] },
            { id: 'settings-operator-bot', tab: 'operator', tabLabel: 'Operator', label: 'Secure bot connection', keywords: ['token', 'secure', 'bot'] },
            { id: 'settings-operator-benefits', tab: 'operator', tabLabel: 'Operator', label: 'What you get after connecting', keywords: ['benefits', 'features'] },
            { id: 'settings-weekly-report', tab: 'reports', tabLabel: 'Reports', label: 'Weekly email report', keywords: ['weekly', 'report', 'email'] },
          ]}
        business={workspace ? (
          <BusinessProfileStep
            workspaceName={workspace.name}
            initialType={workspace.businessType as BusinessTypeValue}
            initialProfile={readBusinessProfile(workspace.businessProfile)}
            mode="settings"
          />
        ) : null}
        operator={<OperatorChannelSetup current={operatorChannel} stats={operatorStats} />}
        reports={<WeeklyReportCard initialEmail={workspace?.reportEmail ?? ''} />}
      />
    </div>
  )
}
