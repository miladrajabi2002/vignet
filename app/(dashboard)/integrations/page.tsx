import { channelLabel } from '@/components/crm/channel-badge'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import type { ChannelType } from '@prisma/client'
import {
        ArrowRight,
        Plug,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { ChannelMark } from '@/components/ui/channel-mark'
import { StatusChip } from '@/components/ui/status-chip'
import { prisma } from '@/lib/prisma'
import {
        StoreIntegrationsSection,
        type StoreIntegrationItem,
} from '@/components/integrations/store-integrations-section'
import { PageHeader } from '@/components/dashboard/page-header'
import { StoreAccessPrompt } from '@/components/agents/store-access-prompt'
import { loadStoreAccessChoice } from '@/lib/agents/store-access-choice'
import type { PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'
import { getEffectivePlanDefs, planResourceLimit, recommendedUpgradePlan, type LimitedPlanResource } from '@/lib/billing/plans'

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

        // F2: load the workspace's store integrations + the last few sync-log entries
        // for each so the dashboard section can render without an extra round-trip.
        const storeIntegrationsRaw = await prisma.storeIntegration.findMany({
                where: { workspaceId: user.workspaceId },
                orderBy: { createdAt: 'desc' },
                include: {
                        syncLogs: {
                                // All events from the last 3 days (capped at 100).
                                orderBy: { createdAt: 'desc' },
                                where: { createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
                                take: 100,
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
                        _count: { select: { orders: { where: { deletedAt: null } }, syncLogs: true } },
                },
        })

        const [storeAccessChoice, productCapacity, orderCapacity, customerCapacity, planDefs] = await Promise.all([
                loadStoreAccessChoice(user.workspaceId),
                checkWorkspaceResourceCreateAllowed(user.workspaceId, 'products'),
                checkWorkspaceResourceCreateAllowed(user.workspaceId, 'orders'),
                checkWorkspaceResourceCreateAllowed(user.workspaceId, 'customers'),
                getEffectivePlanDefs(),
        ])
        const capacities = [
                ['products', productCapacity],
                ['orders', orderCapacity],
                ['customers', customerCapacity],
        ] as const
        const planLimits: PlanLimitInfo[] = capacities.flatMap(([resource, capacity]) => {
                if (capacity.allowed) return []
                const recommendedPlan = recommendedUpgradePlan(
                        planDefs,
                        capacity.plan,
                        resource as LimitedPlanResource,
                        capacity.used,
                )
                return [{
                        resource,
                        plan: capacity.plan,
                        used: capacity.used,
                        limit: capacity.limit,
                        recommendedPlan,
                        recommendedLimit: recommendedPlan
                                ? planResourceLimit(planDefs[recommendedPlan], resource)
                                : null,
                }]
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
                                connectedAt: row.connectedAt ? row.connectedAt.toISOString() : null,
                                lastWebhookAt: row.lastWebhookAt ? row.lastWebhookAt.toISOString() : null,
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

                        {/* A connected store whose access the owner has not chosen yet. */}
                        {storeAccessChoice.pending && <StoreAccessPrompt initial={storeAccessChoice} />}

                        <StoreIntegrationsSection
                                integrations={storeIntegrations}
                                planLimits={planLimits}
                                locale={locale}
                        />

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
                                                        href={primaryAgent ? (type === 'INSTAGRAM' ? `/agents/${primaryAgent.id}/instagram` : `/agents/${primaryAgent.id}/channels`) : '/agents/new'}
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
