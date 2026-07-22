import Link from 'next/link'
import { Suspense } from 'react'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ChannelType, ConvStatus, Prisma } from '@prisma/client'
import { MessagesSquare, Clock, Filter, RefreshCw } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { MetricsExplainer } from '@/components/dashboard/metrics-explainer'
import { ConversationFilters } from '@/components/dashboard/conversation-filters'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import {
        conversationsDailyByWorkspace,
} from '@/lib/dashboard/charts'
import { relativeTime } from '@/lib/format'
import { stripProductTokens } from '@/lib/widget/config'
import {
        contactDisplayName,
        channelHandleFor,
        channelAvatarFor,
} from '@/lib/crm/display'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { DashboardPanel } from '@/components/dashboard/panel'
import { DashboardDonut } from '@/components/dashboard/donut'
import { PageHeader } from '@/components/dashboard/page-header'
import { dateLocaleTag } from '@/lib/localized-date'
import { CampaignLaunchButton } from '@/components/crm/campaign-launch-button'
import { inboundSourceLabel, readInboundSource } from '@/lib/conversations/source'
import { conversationLiveVersion } from '@/lib/crm/live-version'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { SalesInsightBadge } from '@/components/crm/sales-insight'
import { SalesInsightBackfill } from '@/components/crm/sales-insight-backfill'
import {
        LiveArrivalItem,
        LiveArrivalProvider,
        LiveArrivalStatus,
        LiveRefreshProbe,
} from '@/components/crm/live-arrivals'

const PAGE_SIZE = 50
const VALID_STATUSES = new Set<ConvStatus>(['OPEN', 'RESOLVED', 'HANDED_OFF'])
const VALID_CHANNELS = new Set<ChannelType>([
        'TELEGRAM',
        'WHATSAPP',
        'INSTAGRAM',
        'RUBIKA',
        'BALE',
        'WEB_WIDGET',
        'API',
        'CHAT_LINK',
])
type SalesFilter = 'HIGH_INTENT' | 'BUYER' | 'INFORMATION_SEEKER' | 'EXISTING_CUSTOMER' | 'SUPPORT_SEEKER'
const VALID_SALES_FILTERS = new Set<SalesFilter>([
        'HIGH_INTENT',
        'BUYER',
        'INFORMATION_SEEKER',
        'EXISTING_CUSTOMER',
        'SUPPORT_SEEKER',
])

const CHANNEL_LABELS_FA: Record<string, string> = {
        TELEGRAM: 'تلگرام',
        WHATSAPP: 'واتساپ',
        INSTAGRAM: 'اینستاگرام',
        RUBIKA: 'روبیکا',
        BALE: 'بله',
        WEB_WIDGET: 'ویجت وب',
        API: 'API',
        CHAT_LINK: 'لینک چت',
}

export default async function ConversationsPage(props: {
        searchParams: Promise<{
                page?: string
                channel?: string
                status?: string
                agent?: string
                sales?: string
                q?: string
        }>
}) {
        const searchParams = await props.searchParams
        const user = await requireUser()
        const t = await getTranslations('conversations')
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
        const isFa = locale === 'fa'

        const page = Math.max(1, Number(searchParams.page) || 1)

        // ── Filters from query string ──
        const channelFilter = VALID_CHANNELS.has(searchParams.channel as ChannelType)
                ? (searchParams.channel as ChannelType)
                : undefined
        const statusFilter = VALID_STATUSES.has(searchParams.status as ConvStatus)
                ? (searchParams.status as ConvStatus)
                : undefined
        const agentFilter = searchParams.agent?.trim().slice(0, 64) || undefined
        const salesFilter = VALID_SALES_FILTERS.has(searchParams.sales as SalesFilter)
                ? (searchParams.sales as SalesFilter)
                : undefined
        const query = searchParams.q?.trim().slice(0, 120) || undefined

        const where: Prisma.ConversationWhereInput = { workspaceId: user.workspaceId }
        if (channelFilter) where.channel = channelFilter
        if (statusFilter) where.status = statusFilter
        if (agentFilter) where.agentId = agentFilter
        if (salesFilter === 'HIGH_INTENT') {
                where.salesInsight = { is: { buyerProbability: { gte: 50 }, leadType: 'BUYER' } }
        } else if (salesFilter) {
                where.salesInsight = { is: { leadType: salesFilter } }
        }
        if (query) {
                where.OR = [
                        { summary: { contains: query, mode: 'insensitive' } },
                        { contact: { name: { contains: query, mode: 'insensitive' } } },
                        { contact: { phone: { contains: query } } },
                        { contact: { telegramUsername: { contains: query, mode: 'insensitive' } } },
                        { contact: { baleUsername: { contains: query, mode: 'insensitive' } } },
                        { contact: { rubikaUsername: { contains: query, mode: 'insensitive' } } },
                        { contact: { instagramUsername: { contains: query, mode: 'insensitive' } } },
                        { messages: { some: { content: { contains: query, mode: 'insensitive' } } } },
                ]
        }

        const [
                conversations,
                totalCount,
                openCount,
                resolvedCount,
                handedOffCount,
                convTrend,
                channelGroups,
                agents,
                audienceContacts,
                latestConversation,
                latestContactVersion,
                salesGroups,
                highIntentCount,
                missingSalesInsightCount,
        ] = await Promise.all([
                prisma.conversation.findMany({
                        where,
                        orderBy: [
                                // Handed-off conversations first (need attention), then by last message.
                                { handedOff: 'desc' },
                                { lastMessageAt: 'desc' },
                                { createdAt: 'desc' },
                        ],
                        skip: (page - 1) * PAGE_SIZE,
                        take: PAGE_SIZE + 1,
                        select: {
                                id: true,
                                channel: true,
                                status: true,
                                handedOff: true,
                                messageCount: true,
                                lastMessageAt: true,
                                createdAt: true,
                                agent: { select: { name: true } },
                                contact: {
                                        select: {
                                                id: true,
                                                name: true,
                                                phone: true,
                                                telegramUsername: true,
                                                baleUsername: true,
                                                rubikaUsername: true,
                                                whatsappName: true,
                                                instagramUsername: true,
                                                instagramAvatarUrl: true,
                                                telegramAvatarUrl: true,
                                                baleAvatarUrl: true,
                                                rubikaAvatarUrl: true,
                                                whatsappAvatarUrl: true,
                                        },
                                },
                                messages: {
                                        orderBy: { createdAt: 'desc' },
                                        take: 3,
                                        select: { content: true, role: true, metadata: true },
                                },
                                salesInsight: {
                                        select: { leadType: true, buyerProbability: true },
                                },
                        },
                }),
                prisma.conversation.count({ where: { workspaceId: user.workspaceId } }),
                prisma.conversation.count({
                        where: { workspaceId: user.workspaceId, status: 'OPEN' },
                }),
                prisma.conversation.count({
                        where: { workspaceId: user.workspaceId, status: 'RESOLVED' },
                }),
                prisma.conversation.count({
                        where: { workspaceId: user.workspaceId, status: 'HANDED_OFF', handedOff: true },
                }),
                conversationsDailyByWorkspace(user.workspaceId, 14),
                // Available channels for the filter pills.
                prisma.conversation.groupBy({
                        by: ['channel'],
                        where: { workspaceId: user.workspaceId },
                        _count: { _all: true },
                }),
                prisma.agent.findMany({
                        where: { workspaceId: user.workspaceId, conversations: { some: {} } },
                        orderBy: { name: 'asc' },
                        select: {
                                id: true,
                                name: true,
                                _count: { select: { conversations: true } },
                        },
                }),
                prisma.conversation.findMany({
                        where: { ...where, contactId: { not: null } },
                        distinct: ['contactId'],
                        orderBy: { lastMessageAt: 'desc' },
                        take: 500,
                        select: { contactId: true },
                }),
                prisma.conversation.findFirst({
                        where: { workspaceId: user.workspaceId },
                        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                        select: {
                                id: true,
                                updatedAt: true,
                        },
                }),
                prisma.contact.findFirst({
                        where: { workspaceId: user.workspaceId },
                        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                        select: { id: true, updatedAt: true },
                }),
                prisma.conversationSalesInsight.groupBy({
                        by: ['leadType'],
                        where: { workspaceId: user.workspaceId },
                        _count: { _all: true },
                }),
                prisma.conversationSalesInsight.count({
                        where: { workspaceId: user.workspaceId, leadType: 'BUYER', buyerProbability: { gte: 50 } },
                }),
                prisma.conversation.count({
                        where: {
                                workspaceId: user.workspaceId,
                                salesInsight: { is: null },
                                messages: { some: { role: 'USER' } },
                        },
                }),
        ])

        const hasNext = conversations.length > PAGE_SIZE
        const pageItems = hasNext ? conversations.slice(0, PAGE_SIZE) : conversations
        const liveVersion = conversationLiveVersion({
                count: totalCount,
                latestConversation,
                latestContact: latestContactVersion,
        })
        const liveScope = [
                page,
                channelFilter ?? '',
                statusFilter ?? '',
                agentFilter ?? '',
                salesFilter ?? '',
                query ?? '',
        ].join(':')

        // Build 14-day TrendPoint[] for the ConversationChart (matches /overview).
        const trendFormatter = new Intl.DateTimeFormat(dateLocaleTag(locale), { month: 'short', day: 'numeric' })
        const convTrendPoints: TrendPoint[] = convTrend.series.map((value, i) => {
                const d = new Date(Date.now() - (convTrend.series.length - 1 - i) * 86_400_000)
                return { label: trendFormatter.format(d), value }
        })

        // Build filter pill hrefs (resets to page 1).
        const channelLabels = isFa ? CHANNEL_LABELS_FA : null
        const availableChannels = channelGroups
                .map((g) => ({ channel: g.channel, count: g._count._all }))
                .sort((a, b) => b.count - a.count)
        const salesCounts = new Map(salesGroups.map((group) => [group.leadType, group._count._all]))
        const statusDonut = [
                { label: isFa ? 'باز' : 'Open', value: openCount },
                { label: isFa ? 'حل‌شده' : 'Resolved', value: resolvedCount },
                { label: isFa ? 'تحویل اپراتور' : 'Handed off', value: handedOffCount },
        ].filter((item) => item.value > 0)

        return (
                <div className="mx-auto max-w-6xl min-w-0 space-y-6">
                        <PageHeader
                                icon={MessagesSquare}
                                title={t('title')}
                                subtitle={t('subtitle')}
                                actions={
                                        <CampaignLaunchButton
                                                audience={{ selectedContactIds: audienceContacts.flatMap((row) => row.contactId ? [row.contactId] : []) }}
                                                locale={locale}
                                                disabled={audienceContacts.length === 0}
                                        />
                                }
                        />

                        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                                <DashboardPanel
                                        title={isFa ? 'وضعیت گفتگوها' : 'Conversation status'}
                                        subtitle={isFa ? 'نمای کلی پرونده‌های باز، حل‌شده و تحویل‌شده' : 'Open, resolved and handed-off cases'}
                                >
                                        <DashboardDonut data={statusDonut} centerValue={totalCount} centerLabel={isFa ? 'گفتگو' : 'conversations'} />
                                </DashboardPanel>
                                <DashboardPanel
                                        title={isFa ? 'روند گفتگوهای ۱۴ روز اخیر' : 'Conversation trend, last 14 days'}
                                        subtitle={isFa ? `${convTrend.total.toLocaleString('fa-IR')} گفتگو در این دوره` : `${convTrend.total} conversations in this period`}
                                >
                                        <ConversationChart data={convTrendPoints} />
                                </DashboardPanel>
                        </div>

                        {/* ─── Filters: search + status + channel + agent (handed-off prioritized) ─── */}
                        <Suspense fallback={<div className="h-16 rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-surface)]" />}>
                        <div className="spatial-surface rounded-[1.5rem] p-3 sm:p-4">
                        <ConversationFilters
                                isFa={isFa}
                                activeStatus={statusFilter}
                                activeChannel={channelFilter}
                                activeAgent={agentFilter}
                                activeSales={salesFilter}
                                query={query}
                                basePath="/conversations"
                                statusOptions={[
                                        { key: 'ALL', label: isFa ? 'همه' : 'All', count: totalCount },
                                        {
                                                key: 'HANDED_OFF',
                                                label: isFa ? 'تحویل اپراتور' : 'Handed off',
                                                count: handedOffCount,
                                        },
                                        { key: 'OPEN', label: isFa ? 'باز' : 'Open', count: openCount },
                                        {
                                                key: 'RESOLVED',
                                                label: isFa ? 'بسته‌شده' : 'Resolved',
                                                count: resolvedCount,
                                        },
                                ]}
                                channelOptions={[
                                        { key: 'ALL', label: isFa ? 'همه' : 'All', count: 0 },
                                        ...availableChannels.map((c) => ({
                                                key: c.channel,
                                                label: channelLabels?.[c.channel] ?? c.channel,
                                                count: c.count,
                                        })),
                                ]}
                                agentOptions={agents.map((agent) => ({
                                        key: agent.id,
                                        label: agent.name,
                                        count: agent._count.conversations,
                                }))}
                                salesOptions={[
                                        { key: 'ALL', label: isFa ? 'همه دسته‌های فروش' : 'All sales categories', count: totalCount },
                                        { key: 'HIGH_INTENT', label: isFa ? 'فرصت‌های گرم (۵۰٪+)' : 'Warm opportunities (50%+)', count: highIntentCount },
                                        { key: 'BUYER', label: isFa ? 'خریدار بالقوه' : 'Potential buyer', count: salesCounts.get('BUYER') ?? 0 },
                                        { key: 'INFORMATION_SEEKER', label: isFa ? 'در حال کسب اطلاعات' : 'Information seeker', count: salesCounts.get('INFORMATION_SEEKER') ?? 0 },
                                        { key: 'EXISTING_CUSTOMER', label: isFa ? 'مشتری فعلی' : 'Existing customer', count: salesCounts.get('EXISTING_CUSTOMER') ?? 0 },
                                        { key: 'SUPPORT_SEEKER', label: isFa ? 'درخواست پشتیبانی' : 'Support request', count: salesCounts.get('SUPPORT_SEEKER') ?? 0 },
                                ]}
                        />
                        </div>
                        </Suspense>

                        <LiveArrivalProvider key={liveScope} ids={pageItems.map((item) => item.id)}>
                        <LiveRefreshProbe
                                resource="conversations"
                                initialVersion={liveVersion}
                                enabled={page === 1}
                        />
                        {pageItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
                                        <MessagesSquare className="h-8 w-8 text-[var(--text-muted)]" />
                                        <p className="mt-4 text-sm text-[var(--text-secondary)]">
                                                {channelFilter || statusFilter || agentFilter || salesFilter || query
                                                        ? isFa
                                                                ? 'مکالمه‌ای با این فیلتر یافت نشد'
                                                                : 'No conversations match these filters'
                                                        : t('empty')}
                                        </p>
                                        {!channelFilter && !statusFilter && !agentFilter && !salesFilter && !query && (
                                                <Link
                                                        href="/integrations"
                                                        className="mt-6 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
                                                >
                                                        {t('emptyCta')}
                                                </Link>
                                        )}
                                </div>
                        ) : (
                                <div className="spatial-surface min-w-0 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[1.5rem]">
                                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
                                        <div className="min-w-0">
                                                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{isFa ? 'صندوق گفتگوها' : 'Conversation inbox'}</h2>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">{isFa ? `${totalCount.toLocaleString('fa-IR')} پرونده از همه کانال‌ها` : `${totalCount} cases across all channels`}</p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                                                <SalesInsightBackfill key={missingSalesInsightCount} missingCount={missingSalesInsightCount} locale={locale} />
                                                <LiveArrivalStatus resource="conversations" locale={locale} />
                                        </div>
                                </div>
                                {pageItems.map((c) => {
                                                const last = c.messages[0]
                                                const lastInbound = c.messages.find((message) => message.role === 'USER')
                                                const sourceLabel = lastInbound
                                                        ? inboundSourceLabel(readInboundSource(lastInbound.metadata), locale)
                                                        : null
                                                const when = c.lastMessageAt ?? c.createdAt
                                                // Resolve the contact's display name + per-channel handle/avatar.
                                                // For Instagram DMs the webhook only carries the sender id (no
                                                // name/username/avatar), so without a fallback these contacts
                                                // show as "ناشناس". The helper provides a per-channel fallback
                                                // ("کاربر اینستاگرام", etc.) so the operator always sees something
                                                // meaningful. When the visitor types their name, extractIdentity
                                                // backfills it and it takes precedence.
                                                const channelHandle = channelHandleFor({
                                                        channel: c.channel,
                                                        telegramUsername: c.contact?.telegramUsername,
                                                        baleUsername: c.contact?.baleUsername,
                                                        rubikaUsername: c.contact?.rubikaUsername,
                                                        whatsappName: c.contact?.whatsappName,
                                                        instagramUsername: c.contact?.instagramUsername,
                                                })
                                                const channelAvatar = channelAvatarFor({
                                                        channel: c.channel,
                                                        telegramAvatarUrl: c.contact?.telegramAvatarUrl,
                                                        baleAvatarUrl: c.contact?.baleAvatarUrl,
                                                        rubikaAvatarUrl: c.contact?.rubikaAvatarUrl,
                                                        whatsappAvatarUrl: c.contact?.whatsappAvatarUrl,
                                                        instagramAvatarUrl: c.contact?.instagramAvatarUrl,
                                                })
                                                const channelAvatarSrc = contactAvatarSrc({
                                                        contactId: c.contact?.id,
                                                        channel: c.channel,
                                                        rawUrl: channelAvatar,
                                                })
                                                // A channelId proxy: if we have a contact at all, it has a
                                                // channel-specific id. Use the conversation channel as the
                                                // signal that a fallback label is appropriate.
                                                const channelId = c.contact ? (c.channel as string) : null
                                                const who = contactDisplayName({
                                                        name: c.contact?.name,
                                                        phone: c.contact?.phone,
                                                        handle: channelHandle,
                                                        channel: c.channel,
                                                        channelId,
                                                        anonymousLabel: t('anonymous'),
                                                })
                                                return (
                                                        <LiveArrivalItem key={c.id} itemId={c.id}>
                                                        <Link
                                                                href={`/conversations/${c.id}`}
                                                                className={cn(
                                                                        'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-3.5 transition-colors hover:bg-[var(--bg-hover)] sm:px-5',
                                                                        c.handedOff && c.status !== 'RESOLVED' && 'bg-amber-500/5',
                                                                )}
                                                        >
                                                                <ContactAvatar src={channelAvatarSrc} alt={who} />
                                                                <div className="min-w-0 flex-1">
                                                                        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                                                                <span dir="auto" className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                                                                                        {who}
                                                                                </span>
                                                                                {channelHandle && who !== channelHandle && (
                                                                                        <span dir="ltr" className="max-w-28 shrink truncate rounded-full bg-[var(--bg-base)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
                                                                                                @{channelHandle}
                                                                                        </span>
                                                                                )}
                                                                                {sourceLabel && (
                                                                                        <span className="shrink-0 rounded-full border border-black/[0.07] bg-black/[0.035] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                                                                                                {sourceLabel}
                                                                                        </span>
                                                                                )}
                                                                                {c.handedOff && c.status !== 'RESOLVED' && (
                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                                                                                                <span className="relative flex h-1.5 w-1.5">
                                                                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:animate-none" />
                                                                                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                                                                </span>
                                                                                                {isFa ? 'تحویل اپراتور' : 'Handed off'}
                                                                                        </span>
                                                                                )}
                                                                        </div>
                                                                        <p dir="auto" className="mt-1 min-w-0 truncate text-xs leading-5 text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                                                                                {last
                                                                                        ? `${stripProductTokens(last.content)}${last.role === 'ASSISTANT' ? ' ↩' : ''}`
                                                                                        : c.agent.name}
                                                                        </p>
                                                                </div>
                                                                 <span className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1.5 text-[11px] leading-5 text-[var(--text-muted)]">
                                                                         <ChannelBadge type={c.channel} />
                                                                         {c.salesInsight && c.salesInsight.leadType !== 'UNCLEAR' && (
                                                                                 <SalesInsightBadge insight={c.salesInsight} locale={locale} compactOnMobile />
                                                                         )}
                                                                         <span>{relativeTime(when, locale)}</span>
                                                                        <span className="tabular-nums">{c.messageCount.toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'پیام' : 'messages'}</span>
                                                                        </span>
                                                        </Link>
                                                        </LiveArrivalItem>
                                                )
                                        })}
                                </div>
                        )}

                        </LiveArrivalProvider>

                        <Pagination
                                page={page}
                                hasNext={hasNext}
                                makeHref={(p) => {
                                        const sp = new URLSearchParams()
                                        if (channelFilter) sp.set('channel', channelFilter)
                                        if (statusFilter) sp.set('status', statusFilter)
                                        if (agentFilter) sp.set('agent', agentFilter)
                                        if (salesFilter) sp.set('sales', salesFilter)
                                        if (query) sp.set('q', query)
                                        if (p > 1) sp.set('page', String(p))
                                        const qs = sp.toString()
                                        return qs ? `/conversations?${qs}` : '/conversations'
                                }}
                        />

                        <MetricsExplainer
                                title={
                                        locale === 'fa' ? 'این لیست چگونه مرتب می‌شود؟' : 'How is this list ordered?'
                                }
                                items={[
                                        {
                                                icon: Clock,
                                                term: locale === 'fa' ? 'ترتیب نمایش: ' : 'Sort order: ',
                                                body:
                                                        locale === 'fa'
                                                                ? 'مکالمات تحویل‌داده‌شده به اپراتور (نیاز به توجه) اول نمایش داده می‌شوند، سپس بقیه بر اساس زمان آخرین پیام (جدیدترین اول).'
                                                                : 'Handed-off conversations (needing attention) are shown first, then the rest by last message time (newest first).',
                                        },
                                        {
                                                icon: Filter,
                                                term: locale === 'fa' ? 'فیلترها: ' : 'Filters: ',
                                                body:
                                                        locale === 'fa'
                                                                ? 'می‌توانید بر اساس کانال، وضعیت و دسته هوش فروش—از جمله فرصت‌های گرم—فیلتر کنید. فیلترها در URL ذخیره می‌شوند تا قابل اشتراک‌گذاری باشند.'
                                                                : 'Filter by channel, status, and sales-intelligence category—including warm opportunities. Filters stay in the URL for sharing.',
                                        },
                                        {
                                                icon: RefreshCw,
                                                term: locale === 'fa' ? 'به‌روزرسانی: ' : 'Live updates: ',
                                                body:
                                                        locale === 'fa'
                                                                ? 'گفتگوهای تازه به‌صورت خودکار وارد صندوق می‌شوند و برای چند لحظه با افکت ورود مشخص خواهند شد؛ نیازی به refresh دستی نیست.'
                                                                : 'New conversations enter the inbox automatically and receive a brief arrival highlight; no manual refresh is needed.',
                                        },
                                ]}
                        />
                </div>
        )
}
