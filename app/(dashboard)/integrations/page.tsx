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
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
        StoreIntegrationsSection,
        type StoreIntegrationItem,
} from '@/components/integrations/store-integrations-section'

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

        const groups = await prisma.agentChannel.groupBy({
                by: ['type'],
                where: { agent: { workspaceId: user.workspaceId }, active: true },
                _count: { _all: true },
        })
        const counts = new Map<ChannelType, number>(
                groups.map((g) => [g.type, g._count._all]),
        )

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

        // Strip encrypted credential ciphertext from the payload we hand to the
        // client — only non-sensitive fields (consumerKey, etc.) are visible.
        const storeIntegrations: StoreIntegrationItem[] = storeIntegrationsRaw.map(
                (row) => {
                        const visible: Record<string, unknown> = {}
                        if (row.credentials && typeof row.credentials === 'object') {
                                for (const [k, v] of Object.entries(
                                        row.credentials as Record<string, unknown>,
                                )) {
                                        if (k.endsWith('Enc')) continue
                                        visible[k] = v
                                }
                        }
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
                <div className="mx-auto max-w-5xl space-y-6">
                        <div>
                                <h1 className="text-2xl font-light text-[var(--text-primary)]">
                                        {t('title')}
                                </h1>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                        {t('subtitle')}
                                </p>
                        </div>

                        <div className="flex items-center justify-between">
                                <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                                        {t('channels')}
                                </h2>
                                <Link
                                        href="/agents"
                                        className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                >
                                        {t('openAgents')}
                                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                </Link>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {CHANNELS.map(({ type, name, icon: Icon, available }) => {
                                        const count = counts.get(type) ?? 0
                                        const connected = count > 0
                                        return (
                                                <div
                                                        key={type}
                                                        className="flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
                                                >
                                                        <div className="flex items-center justify-between">
                                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-primary)]">
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
                                                </div>
                                        )
                                })}
                        </div>

                        <StoreIntegrationsSection integrations={storeIntegrations} />
                </div>
        )
}
