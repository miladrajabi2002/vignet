import { channelLabel } from '@/components/crm/channel-badge'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getLocale, getTranslations } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import {
        ArrowRight,
        Plug,
        Store,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { ChannelMark } from '@/components/ui/channel-mark'
import { WOO_LINK_CARD, WOO_TINT } from '@/components/integrations/woo-styles'
import { StatusChip } from '@/components/ui/status-chip'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/dashboard/page-header'

const CHANNELS: {
        type: ChannelType
        name: string
        available: boolean
}[] = [
        { type: 'WEB_WIDGET', name: 'Web Widget', available: true },
        { type: 'TELEGRAM', name: 'Telegram', available: true },
        { type: 'BALE', name: 'Bale', available: true },
        { type: 'RUBIKA', name: 'Rubika', available: true },
        { type: 'INSTAGRAM', name: 'Instagram', available: true },
]

export default async function IntegrationsPage() {
        const user = await requireUser()
        const t = await getTranslations('integrations')
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

        const [groups, primaryAgent] = await Promise.all([
                prisma.agentChannel.groupBy({
                        by: ['type'],
                        where: { agent: { workspaceId: user.workspaceId }, active: true },
                        _count: { _all: true },
                }),
                prisma.agent.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
        ])
        const counts = new Map<ChannelType, number>(
                groups.map((g) => [g.type, g._count._all]),
        )

        // Chat Link isn't a ChannelType — count active public links separately so
        // its card shows the same connected/not-connected state as the others.
        const chatLinkCount = await prisma.chatLink.count({
                where: { workspaceId: user.workspaceId, enabled: true },
        })

        // The store has its own tab; this page only says whether it is connected.
        const store = await prisma.storeIntegration.findFirst({
                where: { workspaceId: user.workspaceId, type: 'WOOCOMMERCE' },
                orderBy: { createdAt: 'desc' },
                select: { storeUrl: true, active: true, lastSyncError: true, _count: { select: { products: true } } },
        })
        const storeHost = store?.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null

        return (
                <div className="mx-auto max-w-none space-y-6">
                        <PageHeader
                                icon={Plug}
                                title={t('title')}
                                subtitle={t('subtitle')}
                        />

                        <Link
                                href="/store"
                                className={cn(WOO_LINK_CARD, 'group flex flex-wrap items-center gap-4 p-4 sm:p-5')}
                        >
                                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', WOO_TINT)}>
                                        <Store className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold text-[var(--text-primary)]">
                                                {locale === 'fa' ? 'فروشگاه ووکامرس' : 'WooCommerce store'}
                                                {storeHost ? <span dir="ltr" className="ms-2 text-[13px] font-normal text-[var(--text-secondary)]">{storeHost}</span> : null}
                                        </span>
                                        <span className="mt-0.5 block text-[13px] leading-6 text-[var(--text-muted)]">
                                                {store
                                                        ? (locale === 'fa' ? 'همگام‌سازی، سفارش‌ها و فروش در گفتگو را از تب «ووکامرس» مدیریت کنید.' : 'Sync, orders and in-chat selling are managed in the WooCommerce tab.')
                                                        : (locale === 'fa' ? 'محصولات و سفارش‌های سایت وردپرسی را با افزونهٔ ویجنت وصل کنید.' : 'Connect your WordPress store’s products and orders with the Vigent plugin.')}
                                        </span>
                                </span>
                                <StatusChip tone={!store ? 'neutral' : !store.active ? 'neutral' : store.lastSyncError ? 'danger' : 'ok'} dot={Boolean(store?.active)}>
                                        {!store ? t('notConnected') : !store.active ? (locale === 'fa' ? 'متوقف' : 'Paused') : store.lastSyncError ? (locale === 'fa' ? 'خطای همگام‌سازی' : 'Sync error') : t('connected')}
                                </StatusChip>
                                <ArrowRight className="h-4 w-4 text-[var(--text-muted)] rtl:rotate-180" />
                        </Link>

                        <div className="flex items-center justify-between pt-2">
                                <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                                        {t('channels')}
                                </h2>
                                <Link
                                        href={primaryAgent ? `/agents/${primaryAgent.id}/channels` : '/agents/new'}
                                        className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                >
                                        {t('openAgents')}
                                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                </Link>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Chat Link — a Vigent-native channel (public standalone chat page). */}
                                <Link
                                        href={primaryAgent ? `/agents/${primaryAgent.id}/channels?open=CHAT_LINK` : '/agents/new'}
                                        className="spatial-surface group flex flex-col gap-3 rounded-card p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none"
                                >
                                        <div className="flex items-center justify-between">
                                                <ChannelMark channel="CHAT_LINK" />
                                                <StatusChip tone={chatLinkCount > 0 ? 'ok' : 'neutral'} dot={chatLinkCount > 0}>
                                                {chatLinkCount > 0 ? t('connected') : t('notConnected')}
                                                </StatusChip>
                                        </div>
                                        <div>
                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                        {t('chatLinkName')}
                                                </p>
                                                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                                        {chatLinkCount > 0
                                                                ? `${chatLinkCount} ${t('connected').toLowerCase()}`
                                                                : t('chatLinkDesc')}
                                                </p>
                                        </div>
                                </Link>

                                {CHANNELS.map(({ type, name, available }) => {
                                        const count = counts.get(type) ?? 0
                                        const connected = count > 0
                                        return (
                                                <Link
                                                        key={type}
                                                        href={primaryAgent ? (type === 'INSTAGRAM' ? `/agents/${primaryAgent.id}/instagram` : `/agents/${primaryAgent.id}/channels?open=${type}`) : '/agents/new'}
                                                        className="spatial-surface group flex flex-col gap-3 rounded-card p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none"
                                                >
                                                        <div className="flex items-center justify-between">
                                                                <ChannelMark channel={type} />
                                                                <StatusChip tone={available && connected ? 'ok' : 'neutral'} dot={available && connected}>
                                                                {!available ? t('comingSoon') : connected ? t('connected') : t('notConnected')}
                                                                </StatusChip>
                                                        </div>
                                                        <div>
                                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                        {locale === 'fa' ? channelLabel(type, 'fa') : name}
                                                                </p>
                                                                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                                                        {available
                                                                                ? connected
                                                                                        ? `${count} ${t('connected').toLowerCase()}`
                                                                                        : t('manageInAgent')
                                                                                : t('comingSoon')}
                                                                </p>
                                                        </div>
                                                </Link>
                                        )
                                })}
                        </div>
                </div>
        )
}
