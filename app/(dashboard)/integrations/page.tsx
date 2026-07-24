import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import {
        Globe,
        Send,
        MessagesSquare,
        Radio,
        MessageCircle,
        Camera,
        ArrowRight,
        Link2,
        Plug,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
        StoreIntegrationsSection,
        type StoreIntegrationItem,
} from '@/components/integrations/store-integrations-section'
import { PageHeader } from '@/components/dashboard/page-header'

const CHANNELS: {
        type: ChannelType
        name: string
        icon: typeof Globe
        available: boolean
}[] = [
        { type: 'WEB_WIDGET', name: 'Web Widget', icon: Globe, available: true },
        { type: 'TELEGRAM', name: 'Telegram', icon: Send, available: true },
        { type: 'BALE', name: 'Bale', icon: MessagesSquare, available: true },
        { type: 'RUBIKA', name: 'Rubika', icon: Radio, available: true },
        { type: 'WHATSAPP', name: 'WhatsApp', icon: MessageCircle, available: true },
        { type: 'INSTAGRAM', name: 'Instagram', icon: Camera, available: true },
]

export default async function IntegrationsPage() {
        const user = await requireUser()
        const t = await getTranslations('integrations')

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

        // F2: load the workspace's store integrations + the last few sync-log entries
        // for each so the dashboard section can render without an extra round-trip.
        const storeIntegrationsRaw = await prisma.storeIntegration.findMany({
                where: { workspaceId: user.workspaceId },
                orderBy: { createdAt: 'desc' },
                include: {
                        syncLogs: {
                                orderBy: { createdAt: 'desc' },
                                take: 10,
                                select: {
                                        id: true,
                                        direction: true,
                                        entity: true,
                                        outcome: true,
                                        count: true,
                                        message: true,
                                        createdAt: true,
                                },
                        },
                        _count: { select: { orders: true, syncLogs: true } },
                },
        })

        // Strip encrypted credential ciphertext — only non-sensitive fields are visible.
        const storeIntegrations: StoreIntegrationItem[] = storeIntegrationsRaw.map(
                (row) => {
                        return {
                                id: row.id,
                                type: row.type,
                                storeUrl: row.storeUrl,
                                webhookSecret: row.webhookSecret,
                                pollIntervalMinutes: row.pollIntervalMinutes,
                                active: row.active,
                                lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
                                lastSyncStatus: row.lastSyncStatus,
                                lastSyncError: row.lastSyncError,
                                _count: {
                                        orders: row._count.orders,
                                        syncLogs: row._count.syncLogs,
                                },
                                syncLogs: row.syncLogs.map((l) => ({
                                        id: l.id,
                                        direction: l.direction,
                                        entity: l.entity,
                                        outcome: l.outcome,
                                        count: l.count,
                                        message: l.message,
                                        createdAt: l.createdAt.toISOString(),
                                })),
                        }
                },
        )

        return (
                <div className="mx-auto max-w-6xl space-y-6">
                        <PageHeader
                                icon={Plug}
                                title={t('title')}
                                subtitle={t('subtitle')}
                        />

                        <StoreIntegrationsSection integrations={storeIntegrations} />

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
                                        href={primaryAgent ? `/agents/${primaryAgent.id}/channels` : '/agents/new'}
                                        className="spatial-surface group flex flex-col gap-3 rounded-[1.5rem] p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none"
                                >
                                        <div className="flex items-center justify-between">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--white)] text-[var(--bg-base)]">
                                                        <Link2 className="h-5 w-5" />
                                                </div>
                                                <span
                                                        className={
                                                                chatLinkCount > 0
                                                                        ? 'inline-flex items-center gap-1.5 text-xs text-[var(--green)]'
                                                                        : 'text-xs text-[var(--text-muted)]'
                                                        }
                                                >
                                                        {chatLinkCount > 0
                                                                ? `● ${t('connected')}`
                                                                : t('notConnected')}
                                                </span>
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

                                {CHANNELS.map(({ type, name, icon: Icon, available }) => {
                                        const count = counts.get(type) ?? 0
                                        const connected = count > 0
                                        return (
                                                <Link
                                                        key={type}
                                                        href={primaryAgent ? (type === 'INSTAGRAM' ? `/agents/${primaryAgent.id}/instagram` : `/agents/${primaryAgent.id}/channels`) : '/agents/new'}
                                                        className="spatial-surface group flex flex-col gap-3 rounded-[1.5rem] p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none"
                                                >
                                                        <div className="flex items-center justify-between">
                                                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white shadow-[var(--shadow-control)]">
                                                                        <Icon className="h-5 w-5" />
                                                                </div>
                                                                <span
                                                                        className={
                                                                                available
                                                                                        ? connected
                                                                                                ? 'inline-flex items-center gap-1.5 text-xs text-[var(--green)]'
                                                                                                : 'text-xs text-[var(--text-muted)]'
                                                                                        : 'text-xs text-[var(--text-muted)]'
                                                                        }
                                                                >
                                                                        {!available
                                                                                ? t('comingSoon')
                                                                                : connected
                                                                                        ? `● ${t('connected')}`
                                                                                        : t('notConnected')}
                                                                </span>
                                                        </div>
                                                        <div>
                                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                        {name}
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
