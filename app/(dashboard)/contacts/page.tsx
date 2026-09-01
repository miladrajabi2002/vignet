import { getLocale } from 'next-intl/server'
import type { ChannelType, Prisma } from '@prisma/client'
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
import { contactLiveVersion } from '@/lib/crm/live-version'
import { contactPhoneLookupVariants } from '@/lib/phone'
import { contactAvatarSrc } from '@/lib/crm/avatar'

const PAGE_SIZE = 20
const FILTER_STAGES = ['lead', 'qualified', 'customer', 'lost'] as const
const FILTER_CHANNELS: ChannelType[] = ['INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'BALE', 'RUBIKA']
type FilterStage = (typeof FILTER_STAGES)[number]

const CHANNEL_FILTER_WHERE: Partial<Record<ChannelType, Prisma.ContactWhereInput>> = {
  INSTAGRAM: { instagramId: { not: null } },
  WHATSAPP: { whatsappId: { not: null } },
  TELEGRAM: { telegramId: { not: null } },
  BALE: { baleId: { not: null } },
  RUBIKA: { rubikaId: { not: null } },
}

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
    searchParams: Promise<{
      page?: string
      q?: string
      stage?: string
      channel?: string
      tag?: string
      contact?: string
    }>
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const isFa = locale === 'fa'
  const page = Math.max(1, Number(searchParams.page) || 1)
  const query = searchParams.q?.trim().slice(0, 120) || ''
  const stage = FILTER_STAGES.includes(searchParams.stage as FilterStage)
    ? (searchParams.stage as FilterStage)
    : ''
  const channel = FILTER_CHANNELS.includes(searchParams.channel as ChannelType)
    ? (searchParams.channel as ChannelType)
    : ''
  const tag = searchParams.tag?.trim().slice(0, 40) || ''
  const detailContactId = searchParams.contact?.trim().slice(0, 128) || undefined
  const phoneVariants = contactPhoneLookupVariants(query)
  const where: Prisma.ContactWhereInput = {
    workspaceId: user.workspaceId,
    ...(stage ? { stage } : {}),
    ...(channel ? (CHANNEL_FILTER_WHERE[channel] ?? {}) : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { phone: { contains: query } },
            ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
            { telegramUsername: { contains: query, mode: 'insensitive' as const } },
            { baleUsername: { contains: query, mode: 'insensitive' as const } },
            { rubikaUsername: { contains: query, mode: 'insensitive' as const } },
            { whatsappName: { contains: query, mode: 'insensitive' as const } },
            { instagramUsername: { contains: query, mode: 'insensitive' as const } },
            { tags: { has: query } },
          ],
        }
      : {}),
  }

  const [contacts, totalCount, matchedCount, stageGroups, contactTrend, latestContact] = await Promise.all([
    prisma.contact.findMany({
      where,
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
    prisma.contact.count({ where }),
    prisma.contact.groupBy({
      by: ['stage'],
      where: { workspaceId: user.workspaceId },
      _count: { _all: true },
    }),
    contactsDailyByWorkspace(user.workspaceId, 14),
    prisma.contact.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, updatedAt: true },
    }),
  ])

  const hasNext = contacts.length > PAGE_SIZE
  const pageContacts = hasNext ? contacts.slice(0, PAGE_SIZE) : contacts
  const liveVersion = contactLiveVersion({ count: totalCount, latest: latestContact })
  const listParams = new URLSearchParams()
  if (page > 1) listParams.set('page', String(page))
  if (query) listParams.set('q', query)
  if (stage) listParams.set('stage', stage)
  if (channel) listParams.set('channel', channel)
  if (tag) listParams.set('tag', tag)
  const detailReturnTo = listParams.size > 0
    ? `/contacts?${listParams.toString()}`
    : '/contacts'

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
    const avatar = c.instagramId
      ? { rawUrl: c.instagramAvatarUrl, channel: 'INSTAGRAM' as const }
      : c.telegramAvatarUrl
        ? { rawUrl: c.telegramAvatarUrl, channel: 'TELEGRAM' as const }
        : c.baleAvatarUrl
          ? { rawUrl: c.baleAvatarUrl, channel: 'BALE' as const }
          : c.rubikaAvatarUrl
            ? { rawUrl: c.rubikaAvatarUrl, channel: 'RUBIKA' as const }
            : c.whatsappAvatarUrl
              ? { rawUrl: c.whatsappAvatarUrl, channel: 'WHATSAPP' as const }
              : null
    const avatarUrl = avatar
      ? contactAvatarSrc({
          contactId: c.id,
          channel: avatar.channel,
          rawUrl: avatar.rawUrl,
        })
      : null
    const avatarFallbackUrl = c.instagramId
      ? c.telegramAvatarUrl ??
        c.baleAvatarUrl ??
        c.rubikaAvatarUrl ??
        c.whatsappAvatarUrl ??
        null
      : null
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
      avatarFallbackUrl,
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
        key={`contacts:${page}:${query}:${stage}:${channel}:${tag}`}
        initial={rows}
        locale={locale}
        liveVersion={liveVersion}
        liveEnabled={page === 1}
        liveScope={`contacts:${page}:${query}:${stage}:${channel}:${tag}`}
        query={query}
        initialStageFilter={stage}
        initialChannelFilter={channel}
        initialTagFilter={tag}
        totalResults={matchedCount}
        detailContactId={detailContactId}
        detailReturnTo={detailReturnTo}
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
            makeHref={(nextPage) => {
              const params = new URLSearchParams()
              if (nextPage > 1) params.set('page', String(nextPage))
              if (query) params.set('q', query)
              if (stage) params.set('stage', stage)
              if (channel) params.set('channel', channel)
              if (tag) params.set('tag', tag)
              const search = params.toString()
              return search ? `/contacts?${search}` : '/contacts'
            }}
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
                ? 'در پیام‌رسان‌ها مشتری با شناسه کانال ساخته می‌شود؛ در وب‌ویجت و لینک چت نیز به‌محض دریافت نام یا شماره، پروفایل مشتری به‌صورت خودکار ایجاد و به گفتگو متصل می‌شود.'
                : 'Messenger customers are created from their channel identity. In web widget and chat-link conversations, the customer profile is created and attached as soon as a name or phone is available.',
          },
          {
            icon: GitMerge,
            term:
              locale === 'fa'
                ? 'یکپارچه‌سازی بین کانال‌ها: '
                : 'Cross-channel unification: ',
            body:
              locale === 'fa'
                ? 'اگر یک شخص از چند کانال با یک شماره پیام بدهد، گفتگوها و سوابق او روی یک مشتری ادغام می‌شوند. قالب‌های +989…، 09… و 989… یک شماره واحد محسوب می‌شوند.'
                : 'When the same person uses multiple channels with one phone number, conversations and history merge into one customer. +989…, 09…, and 989… formats are treated as the same number.',
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
