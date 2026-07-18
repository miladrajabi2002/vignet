import { getLocale } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import { Users, UserPlus, GitMerge, Tag } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ContactsView, type ContactRow } from '@/components/crm/contacts-view'
import { MetricsExplainer } from '@/components/dashboard/metrics-explainer'
import { Pagination } from '@/components/ui/pagination'
import { DashboardPanel } from '@/components/dashboard/panel'
import { DashboardDonut } from '@/components/dashboard/donut'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { contactsDailyByWorkspace } from '@/lib/dashboard/charts'
import { dateLocaleTag } from '@/lib/localized-date'

const PAGE_SIZE = 100

const STAGE_LABELS_FA: Record<string, string> = {
  lead: 'سرنخ',
  qualified: 'واجد شرایط',
  customer: 'مشتری',
  lost: 'از دست‌رفته',
}
const STAGE_LABELS_EN: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  customer: 'Customer',
  lost: 'Lost',
}

export default async function ContactsPage(
  props: {
    searchParams: Promise<{ page?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const isFa = locale === 'fa'
  const page = Math.max(1, Number(searchParams.page) || 1)

  const [contacts, totalCount, stageGroups, contactTrend, latestContact] = await Promise.all([
    prisma.contact.findMany({
      where: { workspaceId: user.workspaceId },
      // Order by denormalized "last activity" first (bumped on every inbound/
      // AI/operator message); fall back to updatedAt so rows that predate the
      // lastActivityAt column still sort deterministically.
      orderBy: [{ lastActivityAt: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1, // one extra row signals whether a next page exists
      select: {
        id: true,
        name: true,
        phone: true,
        stage: true,
        tags: true,
        updatedAt: true,
        lastActivityAt: true,
        telegramId: true,
        whatsappId: true,
        instagramId: true,
        rubikaId: true,
        baleId: true,
        telegramUsername: true,
        telegramAvatarUrl: true,
        baleUsername: true,
        baleAvatarUrl: true,
        rubikaUsername: true,
        rubikaAvatarUrl: true,
        whatsappName: true,
        whatsappAvatarUrl: true,
        instagramUsername: true,
        instagramAvatarUrl: true,
        marketingOptIn: true,
        _count: { select: { conversations: true } },
      },
    }),
    prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
    prisma.contact.groupBy({
      by: ['stage'],
      where: { workspaceId: user.workspaceId },
      _count: { _all: true },
    }),
    contactsDailyByWorkspace(user.workspaceId, 14),
    prisma.contact.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true },
    }),
  ])

  const hasNext = contacts.length > PAGE_SIZE
  const pageContacts = hasNext ? contacts.slice(0, PAGE_SIZE) : contacts
  const liveVersion = latestContact
    ? `${latestContact.createdAt.toISOString()}:${latestContact.id}`
    : 'empty'

  // Build 14-day TrendPoint[] for the ConversationChart (matches /overview).
  const trendFormatter = new Intl.DateTimeFormat(dateLocaleTag(locale), { month: 'short', day: 'numeric' })
  const contactTrendPoints: TrendPoint[] = contactTrend.series.map((value, i) => {
    const d = new Date(Date.now() - (contactTrend.series.length - 1 - i) * 86_400_000)
    return { label: trendFormatter.format(d), value }
  })

  const rows: ContactRow[] = pageContacts.map((c) => {
    const channels: ChannelType[] = []
    if (c.telegramId) channels.push('TELEGRAM')
    if (c.whatsappId) channels.push('WHATSAPP')
    if (c.instagramId) channels.push('INSTAGRAM')
    if (c.rubikaId) channels.push('RUBIKA')
    if (c.baleId) channels.push('BALE')
    // Fall back to updatedAt for contacts created before lastActivityAt was
    // backfilled — so we never show a "—" or a 1970 date on the list.
    const lastActivity = c.lastActivityAt ?? c.updatedAt
    // Pick the first available avatar across channels (Instagram first since
    // it has the most useful profile pictures).
    const avatarUrl =
      c.instagramAvatarUrl ??
      c.telegramAvatarUrl ??
      c.baleAvatarUrl ??
      c.rubikaAvatarUrl ??
      c.whatsappAvatarUrl ??
      null
    // Per-channel usernames, keyed by ChannelType — only the non-null ones.
    const channelUsernames: Partial<Record<ChannelType, string | null>> = {}
    if (c.telegramUsername) channelUsernames.TELEGRAM = c.telegramUsername
    if (c.baleUsername) channelUsernames.BALE = c.baleUsername
    if (c.rubikaUsername) channelUsernames.RUBIKA = c.rubikaUsername
    if (c.whatsappName) channelUsernames.WHATSAPP = c.whatsappName
    if (c.instagramUsername) channelUsernames.INSTAGRAM = c.instagramUsername
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      stage: c.stage,
      tags: c.tags,
      channels,
      conversationCount: c._count.conversations,
      lastActivity: lastActivity.toISOString(),
      avatarUrl,
      channelUsernames,
      marketingOptIn: c.marketingOptIn,
    }
  })

  // Stage donut data.
  const stageLabels = isFa ? STAGE_LABELS_FA : STAGE_LABELS_EN
  const stageDonut = stageGroups
    .map((g) => ({
      label: stageLabels[g.stage] ?? g.stage,
      value: g._count._all,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ContactsView
        key={`contacts:${page}`}
        initial={rows}
        locale={locale}
        liveVersion={liveVersion}
        liveEnabled={page === 1}
        liveScope={`contacts:${page}`}
        insights={
          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardPanel
              title={isFa ? 'قیف فروش' : 'Sales Pipeline'}
              subtitle={isFa ? 'توزیع مشتریان بر اساس مرحله' : 'Customers by pipeline stage'}
            >
              <DashboardDonut
                data={stageDonut}
                centerValue={totalCount}
                centerLabel={isFa ? 'مشتری' : 'customers'}
              />
            </DashboardPanel>
            <DashboardPanel
              title={isFa ? 'مشتریان جدید ۱۴ روز اخیر' : 'New customers, last 14 days'}
              subtitle={isFa ? `${contactTrend.total.toLocaleString('fa-IR')} مشتری جدید در این دوره` : `${contactTrend.total} new customers in this period`}
            >
              <ConversationChart data={contactTrendPoints} />
            </DashboardPanel>
          </div>
        }
        footer={
          <Pagination
            page={page}
            hasNext={hasNext}
            makeHref={(p) => `/contacts?page=${p}`}
          />
        }
      />

      <MetricsExplainer
        title={
          locale === 'fa'
            ? 'این مشتریان از کجا می‌آیند؟'
            : 'Where do these customers come from?'
        }
        items={[
          {
            icon: UserPlus,
            term:
              locale === 'fa' ? 'ایجاد خودکار: ' : 'Auto-created: ',
            body:
              locale === 'fa'
                ? 'هر بار که یک شخص برای اولین بار از طریق یکی از کانال‌ها (تلگرام، بله، روبیکا، واتساپ، اینستاگرام یا وب‌ویجت) با ایجنت شما صحبت کند، یک مشتری جدید به‌صورت خودکار ایجاد می‌شود. نیازی به افزودن دستی نیست.'
                : 'Every time someone talks to your agent for the first time through any channel (Telegram, Bale, Rubika, WhatsApp, Instagram, or web widget), a new customer is created automatically. No manual entry needed.',
          },
          {
            icon: GitMerge,
            term:
              locale === 'fa'
                ? 'یکپارچه‌سازی بین کانال‌ها: '
                : 'Cross-channel unification: ',
            body:
              locale === 'fa'
                ? 'اگر یک شخص از دو کانال مختلف (مثلاً تلگرام و واتساپ) با شماره تلفن یکسان پیام بدهد، هر دو ارتباط به همان مشتری متصل می‌شود — «یک مشتری، چند کانال». این کار با تطبیق شماره تلفن انجام می‌شود.'
                : 'If the same person messages from two different channels (e.g. Telegram and WhatsApp) with the same phone number, both connections are linked to one customer — "one customer, many channels". This is done by matching phone numbers.',
          },
          {
            icon: Users,
            term:
              locale === 'fa' ? 'مرحله (Stage): ' : 'Pipeline stage: ',
            body:
              locale === 'fa'
                ? 'هر مشتری یک مرحله فروش دارد: لید (سرنخ)، واجد شرایط، مشتری، یا از دست رفته. می‌توانید در نمای pipeline مرحله را با drag-and-drop تغییر دهید. مراحل به‌صورت پیش‌فرض روی «لید» هستند.'
                : 'Each customer has a sales stage: lead, qualified, customer, or lost. Drag-and-drop in the pipeline view to change it. New customers default to "lead".',
          },
          {
            icon: Tag,
            term: locale === 'fa' ? 'تگ‌ها: ' : 'Tags: ',
            body:
              locale === 'fa'
                ? 'تگ‌ها برچسب‌های دلخواه هستند که می‌توانید به مشتری اضافه کنید (مثلاً «VIP»، «خرید عمده»). در صفحه جزئیات مشتری قابل ویرایش هستند و برای فیلتر کردن و دسته‌بندی استفاده می‌شوند.'
                : 'Tags are custom labels you can add to a customer (e.g. "VIP", "wholesale"). Edit them on the customer detail page; use them for filtering and segmentation.',
          },
        ]}
      />
    </div>
  )
}
