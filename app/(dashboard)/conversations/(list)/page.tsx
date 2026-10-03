import Link from 'next/link'
import { Suspense } from 'react'
import { getTranslations, getLocale } from 'next-intl/server'
import type { ChannelType, ConvStatus, Prisma } from '@prisma/client'
import { MessagesSquare } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationFilters } from '@/components/dashboard/conversation-filters'
import { smartTime, formatDateTime } from '@/lib/format'
import { conversationPreviewText } from '@/lib/conversations/preview'
import {
        contactDisplayName,
        channelHandleFor,
        channelAvatarFor,
} from '@/lib/crm/display'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CampaignLaunchButton } from '@/components/crm/campaign-launch-button'
import { inboundSourceTag, readInboundSource } from '@/lib/conversations/source'
import { presentConversationMessages } from '@/lib/conversations/reactions'
import { conversationLiveVersion } from '@/lib/crm/live-version'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { SalesInsightText, SatisfactionText } from '@/components/crm/sales-insight'
import { SalesInsightBackfill } from '@/components/crm/sales-insight-backfill'
import { SALES_INTELLIGENCE_VERSION } from '@/lib/ai/sales-intelligence'
import { DISSATISFIED_BELOW } from '@/lib/ai/turn-signal'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'
import {
        LiveArrivalItem,
        LiveArrivalProvider,
        LiveArrivalStatus,
        LiveRefreshProbe,
} from '@/components/crm/live-arrivals'
import { MobileConversationCard } from '@/components/crm/mobile-conversation-card'
import { searchVariants } from '@/lib/search/persian'
import { LiveEmptyState } from '@/components/ui/live-empty-state'
import { InboxRowPending } from '@/components/crm/inbox-row-pending'
import { ConversationStatusDot } from '@/components/crm/conversation-status-dot'

const PAGE_SIZE = 20
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
type SalesFilter = 'HIGH_INTENT' | 'DISSATISFIED' | 'BUYER' | 'INFORMATION_SEEKER' | 'EXISTING_CUSTOMER' | 'SUPPORT_SEEKER'
const VALID_SALES_FILTERS = new Set<SalesFilter>([
        'HIGH_INTENT',
        'DISSATISFIED',
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
        } else if (salesFilter === 'DISSATISFIED') {
                where.salesInsight = { is: { satisfaction: { lt: DISSATISFIED_BELOW } } }
        } else if (salesFilter) {
                where.salesInsight = { is: { leadType: salesFilter } }
        }
        if (query) {
                where.OR = searchVariants(query).flatMap((term): Prisma.ConversationWhereInput[] => [
                        { summary: { contains: term, mode: 'insensitive' } },
                        { contact: { name: { contains: term, mode: 'insensitive' } } },
                        { contact: { phone: { contains: term } } },
                        { contact: { telegramUsername: { contains: term, mode: 'insensitive' } } },
                        { contact: { baleUsername: { contains: term, mode: 'insensitive' } } },
                        { contact: { rubikaUsername: { contains: term, mode: 'insensitive' } } },
                        { contact: { instagramUsername: { contains: term, mode: 'insensitive' } } },
                        { messages: { some: { content: { contains: term, mode: 'insensitive' } } } },
                ])
        }

        const [
                conversations,
                totalCount,
                matchedCount,
                openCount,
                resolvedCount,
                handedOffCount,
                channelGroups,
                agents,
                audienceContacts,
                latestConversation,
                latestContactVersion,
                salesGroups,
                highIntentCount,
                dissatisfiedCount,
                missingSalesInsightCount,
        ] = await Promise.all([
                prisma.conversation.findMany({
                        where,
                        orderBy: [
                                // The inbox is chronological. Operator handoffs remain available
                                // through the dedicated status filter instead of pinning old threads.
                                { lastMessageAt: { sort: 'desc', nulls: 'last' } },
                                { createdAt: 'desc' },
                                { id: 'desc' },
                        ],
                        skip: (page - 1) * PAGE_SIZE,
                        take: PAGE_SIZE + 1,
                        select: {
                                id: true,
                                channel: true,
                                externalId: true,
                                status: true,
                                handedOff: true,
                                messageCount: true,
                                summary: true,
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
                                        // Timeline rows (handoff, notes) are not messages to preview.
                                        where: { role: { in: ['USER', 'ASSISTANT'] } },
                                        orderBy: { createdAt: 'desc' },
                                        // Keep enough history to fold a short run of legacy
                                        // standalone reactions into the message they belong to.
                                        take: 12,
                                        select: { id: true, content: true, role: true, metadata: true, createdAt: true },
                                },
                                salesInsight: {
                                        select: { leadType: true, buyerProbability: true, satisfaction: true, recommendedAction: true },
                                },
                        },
                }),
                prisma.conversation.count({ where: { workspaceId: user.workspaceId } }),
                prisma.conversation.count({ where }),
                prisma.conversation.count({
                        where: { workspaceId: user.workspaceId, status: 'OPEN' },
                }),
                prisma.conversation.count({
                        where: { workspaceId: user.workspaceId, status: 'RESOLVED' },
                }),
                prisma.conversation.count({
                        where: { workspaceId: user.workspaceId, status: 'HANDED_OFF', handedOff: true },
                }),
                // Available channels for the filter pills.
                prisma.conversation.groupBy({
                        by: ['channel'],
                        where: { workspaceId: user.workspaceId },
                        _count: { _all: true },
                }),
                prisma.agent.findMany({
                        where: { workspaceId: user.workspaceId, conversations: { some: { deletedAt: null } } },
                        orderBy: { name: 'asc' },
                        select: {
                                id: true,
                                name: true,
                                _count: { select: { conversations: { where: { deletedAt: null } } } },
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
                prisma.conversationSalesInsight.count({
                        where: { workspaceId: user.workspaceId, satisfaction: { lt: DISSATISFIED_BELOW } },
                        // Zero until the satisfaction migration is applied.
                }).catch(() => 0),
                prisma.conversation.count({
                        where: {
                                workspaceId: user.workspaceId,
                                messages: { some: { role: 'USER' } },
                                OR: [
                                        { salesInsight: { is: null } },
                                        { salesInsight: { is: { modelVersion: { not: SALES_INTELLIGENCE_VERSION } } } },
                                ],
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

        // Build filter pill hrefs (resets to page 1).
        const channelLabels = isFa ? CHANNEL_LABELS_FA : null
        const availableChannels = channelGroups
                .map((g) => ({ channel: g.channel, count: g._count._all }))
                .sort((a, b) => b.count - a.count)
        const salesCounts = new Map(salesGroups.map((group) => [group.leadType, group._count._all]))
        const statusLabels: Record<ConvStatus, string> = {
                OPEN: isFa ? 'باز' : 'Open',
                RESOLVED: isFa ? 'حل‌شده' : 'Resolved',
                HANDED_OFF: isFa ? 'نیاز به اپراتور' : 'Needs operator',
        }
        const inboxItems = pageItems.map((conversation) => {
                const presentation = presentConversationMessages([...conversation.messages].reverse())
                const last = presentation.messages.at(-1)
                const lastInbound = [...presentation.messages].reverse().find((message) => message.role === 'USER')
                const lastReactions = last ? presentation.reactionsByMessageId.get(last.id) ?? [] : []
                const reactionEmoji = lastReactions.at(-1)?.emoji ?? null
                const sourceTag = lastInbound
                        ? inboundSourceTag(readInboundSource(lastInbound.metadata), conversation.externalId)
                        : null
                const channelHandle = channelHandleFor({
                        channel: conversation.channel,
                        telegramUsername: conversation.contact?.telegramUsername,
                        baleUsername: conversation.contact?.baleUsername,
                        rubikaUsername: conversation.contact?.rubikaUsername,
                        whatsappName: conversation.contact?.whatsappName,
                        instagramUsername: conversation.contact?.instagramUsername,
                })
                const channelAvatar = channelAvatarFor({
                        channel: conversation.channel,
                        telegramAvatarUrl: conversation.contact?.telegramAvatarUrl,
                        baleAvatarUrl: conversation.contact?.baleAvatarUrl,
                        rubikaAvatarUrl: conversation.contact?.rubikaAvatarUrl,
                        whatsappAvatarUrl: conversation.contact?.whatsappAvatarUrl,
                        instagramAvatarUrl: conversation.contact?.instagramAvatarUrl,
                })
                const channelAvatarSrc = contactAvatarSrc({
                        contactId: conversation.contact?.id,
                        channel: conversation.channel,
                        rawUrl: channelAvatar,
                })
                const who = contactDisplayName({
                        name: conversation.contact?.name,
                        phone: conversation.contact?.phone,
                        handle: channelHandle,
                        channel: conversation.channel,
                        channelId: conversation.contact ? conversation.channel : null,
                        anonymousLabel: t('anonymous'),
                })
                const attention = conversation.handedOff && conversation.status !== 'RESOLVED'
                const displayStatus: ConvStatus = attention ? 'HANDED_OFF' : conversation.status

                return {
                        conversation,
                        last,
                        reactionEmoji,
                        sourceTag,
                        channelHandle,
                        channelAvatarSrc,
                        who,
                        when: conversation.lastMessageAt ?? conversation.createdAt,
                        attention,
                        displayStatus,
                        statusLabel: statusLabels[displayStatus],
                }
        })

        const fmt = (value: number) => value.toLocaleString(isFa ? 'fa-IR' : 'en-US')
        // Every link on this page keeps the active filters.
        const hrefWith = (patch: Record<string, string | undefined>) => {
                const sp = new URLSearchParams()
                const values: Record<string, string | undefined> = {
                        channel: channelFilter,
                        status: statusFilter,
                        agent: agentFilter,
                        sales: salesFilter,
                        q: query,
                        page: page > 1 ? String(page) : undefined,
                        ...patch,
                }
                for (const [key, value] of Object.entries(values)) if (value) sp.set(key, value)
                const qs = sp.toString()
                return qs ? `/conversations?${qs}` : '/conversations'
        }
        const totalPages = Math.max(1, Math.ceil(matchedCount / PAGE_SIZE))
        const filtered = Boolean(channelFilter || statusFilter || agentFilter || salesFilter || query)

        return (
                <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-3">
                        <PageHeader
                                icon={MessagesSquare}
                                title={t('title')}
                                subtitle={t('subtitle')}
                                actions={
                                        <>
                                                <CampaignLaunchButton
                                                        audience={{ selectedContactIds: audienceContacts.flatMap((row) => row.contactId ? [row.contactId] : []) }}
                                                        locale={locale}
                                                        disabled={audienceContacts.length === 0}
                                                        compactOnMobile
                                                />

                                                <BulkDeleteButton
                                                        countEndpoint="/api/conversations/bulk"
                                                        deleteEndpoint="/api/conversations/bulk"
                                                        restoreEndpoint="/api/conversations/bulk/restore"
                                                        undoKind="conversation"
                                                        entityLabel={isFa ? 'گفتگو' : 'conversation'}
                                                        entitySingularLabel={isFa ? 'گفتگو' : 'conversation'}
                                                        buttonLabel={t('deleteAll')}
                                                        compactOnMobile
                                                        extraWarning={isFa
                                                                ? 'تاریخچه پیام‌ها حذف می‌شود اما بلافاصله بعد از حذف، چند ثانیه فرصت «بازگردانی» کامل خواهید داشت. اطلاعات مشتریان حفظ می‌شود.'
                                                                : 'Message history is removed, but you get a few seconds to fully undo right after the delete. Customer info is preserved.'}
                                                />
                                        </>
                                }
                        />

                        <LiveArrivalProvider key={liveScope} ids={pageItems.map((item) => item.id)}>
                        <LiveRefreshProbe
                                resource="conversations"
                                initialVersion={liveVersion}
                                enabled={page === 1}
                        />

                        <div className="min-w-0 md:overflow-hidden md:rounded-card md:border md:border-[var(--border-subtle)] md:bg-white md:shadow-[var(--elev-1)]">
                                <div className="flex min-w-0 flex-col gap-3 md:gap-0">
                                        <Suspense fallback={<div className="h-16 rounded-card border border-[var(--border-default)] bg-[var(--bg-surface)]" />}>
                                        <div className="sticky top-[5.35rem] z-20 rounded-card border border-[var(--border-subtle)] bg-white p-2.5 shadow-[var(--elev-1)] md:static md:z-auto md:shrink-0 md:rounded-none md:border-0 md:border-b md:p-3 md:shadow-none">
                                        <ConversationFilters
                                                isFa={isFa}
                                                activeStatus={statusFilter}
                                                activeChannel={channelFilter}
                                                activeAgent={agentFilter}
                                                activeSales={salesFilter}
                                                query={query}
                                                resultCount={matchedCount}
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
                                                        { key: 'DISSATISFIED', label: isFa ? 'مشتری ناراضی' : 'Dissatisfied customer', count: dissatisfiedCount },
                                                        { key: 'BUYER', label: isFa ? 'خریدار بالقوه' : 'Potential buyer', count: salesCounts.get('BUYER') ?? 0 },
                                                        { key: 'INFORMATION_SEEKER', label: isFa ? 'در حال کسب اطلاعات' : 'Information seeker', count: salesCounts.get('INFORMATION_SEEKER') ?? 0 },
                                                        { key: 'EXISTING_CUSTOMER', label: isFa ? 'مشتری فعلی' : 'Existing customer', count: salesCounts.get('EXISTING_CUSTOMER') ?? 0 },
                                                        { key: 'SUPPORT_SEEKER', label: isFa ? 'درخواست پشتیبانی' : 'Support request', count: salesCounts.get('SUPPORT_SEEKER') ?? 0 },
                                                ]}
                                        />
                                        </div>
                                        </Suspense>

                                        {pageItems.length === 0 ? (
                                                <div className="md:grid md:place-items-center md:p-6">
                                                {filtered ? (
                                                        <LiveEmptyState
                                                                icon={MessagesSquare}
                                                                title={isFa ? 'مکالمه‌ای با این فیلتر یافت نشد' : 'No conversations match these filters'}
                                                                description={isFa ? 'فیلترها را کمتر کنید یا عبارت دیگری جستجو کنید.' : 'Loosen the filters or try another search.'}
                                                        />
                                                ) : (
                                                        <LiveEmptyState
                                                                icon={MessagesSquare}
                                                                preview="chat"
                                                                title={t('empty')}
                                                                description={isFa ? 'اولین برنامه را وصل کنید؛ پیام‌های مشتری‌ها از همهٔ برنامه‌ها همین‌جا کنار هم می‌آیند.' : 'Connect your first app — customer messages from every app will land here side by side.'}
                                                                action={{ href: '/integrations', label: t('emptyCta') }}
                                                        />
                                                )}
                                                </div>
                                        ) : (
                                                <>
                                                        <div className="flex items-center justify-between gap-3 px-1 md:shrink-0 md:border-b md:border-[var(--border-subtle)] md:px-3 md:py-1.5">
                                                                <p className="text-[12px] text-[var(--text-muted)]">{isFa ? `${fmt(matchedCount)} گفتگو` : `${matchedCount} conversations`}</p>
                                                                <div className="flex items-center gap-2">
                                                                        <LiveArrivalStatus resource="conversations" locale={locale} />
                                                                        <SalesInsightBackfill key={missingSalesInsightCount} missingCount={missingSalesInsightCount} locale={locale} />
                                                                </div>
                                                        </div>

                                                        <div className="space-y-3 md:hidden">
                                                                {inboxItems.map(({ conversation: c, last, reactionEmoji, sourceTag, channelHandle, channelAvatarSrc, who, when, attention, displayStatus, statusLabel }) => (
                                                                        <LiveArrivalItem key={`mobile-${c.id}`} itemId={c.id}>
                                                                                <MobileConversationCard
                                                                                        conversationId={c.id}
                                                                                        who={who}
                                                                                        avatarSrc={channelAvatarSrc}
                                                                                        channelHandle={channelHandle}
                                                                                        sourceTag={sourceTag}
                                                                                        summary={c.summary}
                                                                                        recommendedAction={c.salesInsight?.recommendedAction ?? null}
                                                                                        buyerProbability={c.salesInsight && c.salesInsight.leadType !== 'UNCLEAR' ? c.salesInsight : null}
                                                                                        relativeTimeLabel={smartTime(when, locale)}
                                                                                        messageCountLabel={`${fmt(c.messageCount)} ${isFa ? 'پیام' : 'messages'}`}
                                                                                        channel={c.channel}
                                                                                        status={displayStatus}
                                                                                        statusLabel={statusLabel}
                                                                                        attention={attention}
                                                                                        satisfaction={c.salesInsight?.satisfaction ?? null}
                                                                                        locale={locale}
                                                                                        lastMessage={last ? `${conversationPreviewText(last.content)}${last.role === 'ASSISTANT' ? ' ↩' : ''}` : c.agent.name}
                                                                                        reactionEmoji={reactionEmoji}
                                                                                />
                                                                        </LiveArrivalItem>
                                                                ))}
                                                        </div>

                                                        <div className="hidden divide-y divide-[var(--border-subtle)] md:block">
                                                                {inboxItems.map(({ conversation: c, last, reactionEmoji, sourceTag, channelHandle, channelAvatarSrc, who, when, attention, displayStatus, statusLabel }) => {
                                                                        const preview = last ? `${conversationPreviewText(last.content)}${last.role === 'ASSISTANT' ? ' ↩' : ''}` : c.agent.name
                                                                        return (
                                                                        <LiveArrivalItem key={`desktop-${c.id}`} itemId={c.id}>
                                                                                <Link
                                                                                        href={`/conversations/${c.id}`}
                                                                                        dir={isFa ? 'rtl' : 'ltr'}
                                                                                        className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-5"
                                                                                >
                                                                                        <ConversationStatusDot attention={attention} open={displayStatus === 'OPEN'} label={statusLabel} />
                                                                                        <ContactAvatar src={channelAvatarSrc} alt={who} />
                                                                                        <div className="min-w-0">
                                                                                                <div className="flex min-w-0 items-center gap-1.5">
                                                                                                        <span dir="auto" className={cn('min-w-0 truncate text-sm text-[var(--text-primary)]', displayStatus === 'RESOLVED' ? 'font-medium' : 'font-bold')} title={who}>{who}</span>
                                                                                                        {channelHandle && who !== channelHandle && <span dir="ltr" className="max-w-32 shrink truncate rounded-full bg-[var(--bg-base)] px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)]" title={`@${channelHandle}`}>{`@${channelHandle}`}</span>}
                                                                                                        {/* The app, and for Instagram the entry the customer used: "Instagram Direct", "Instagram Comment"… */}
                                                                                                        <ChannelBadge type={c.channel} label={sourceTag} />
                                                                                                        {/* How they feel and how likely they buy, as tags beside the app. */}
                                                                                                        <SatisfactionText satisfaction={c.salesInsight?.satisfaction} locale={locale} variant="tag" />
                                                                                                        {c.salesInsight && c.salesInsight.leadType !== 'UNCLEAR' && <SalesInsightText insight={c.salesInsight} locale={locale} variant="tag" className="hidden lg:inline-flex" />}
                                                                                                        <InboxRowPending />
                                                                                                        <span
                                                                                                                className={cn('ms-auto shrink-0 whitespace-nowrap ps-1 text-[12px] tabular-nums text-[var(--text-muted)]', attention && 'font-medium text-[var(--text-primary)]')}
                                                                                                                title={`${formatDateTime(when, locale)} · ${fmt(c.messageCount)} ${isFa ? 'پیام' : 'messages'}`}
                                                                                                        >
                                                                                                                {smartTime(when, locale)}
                                                                                                        </span>
                                                                                                </div>
                                                                                                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                                                                                        {reactionEmoji && (
                                                                                                                <span dir="ltr" className="emoji-glyph shrink-0 text-[13px] leading-none" aria-label={isFa ? 'واکنش مشتری' : 'Customer reaction'}>{reactionEmoji}</span>
                                                                                                        )}
                                                                                                        <p dir={isFa ? 'rtl' : 'ltr'} className={cn('min-w-0 flex-1 truncate text-start text-[13px] leading-5', attention ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')} title={preview}>{preview}</p>
                                                                                                </div>
                                                                                        </div>
                                                                                </Link>
                                                                        </LiveArrivalItem>
                                                                        )
                                                                })}
                                                        </div>
                                                </>
                                        )}
                                </div>
                        </div>
                        {pageItems.length > 0 && (
                                <Pagination
                                        page={page}
                                        totalPages={totalPages}
                                        hasNext={hasNext}
                                        makeHref={(p) => hrefWith({ page: p > 1 ? String(p) : undefined })}
                                />
                        )}
                        </LiveArrivalProvider>
                </div>
        )
}
