import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationHeaderActions } from '@/components/crm/conversation-actions'
import { ConversationDetails } from '@/components/crm/conversation-details'
import { BackButton } from '@/components/dashboard/back-button'
import {
        ConversationThread,
        type ThreadMessage,
} from '@/components/crm/conversation-thread'
import { displayPhone } from '@/lib/phone'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { SalesInsightBadge } from '@/components/crm/sales-insight'
import { ConversationStatusBadge } from '@/components/crm/conversation-status-badge'
import { ConversationMobileLayout } from '@/components/crm/conversation-mobile-layout'
import { ConversationPaymentBanner } from '@/components/payments/payment-review'
import { loadConversationView } from '@/lib/conversations/view'
import { isInstagramCommentThread } from '@/lib/channels/delivery-errors'
import { prisma } from '@/lib/prisma'
import { getGatewayUsage, getPlatformGatewaySettings } from '@/lib/payments/card/platform'
import type { ComposerTools } from '@/components/crm/operator-reply'

export default async function ConversationThreadPage(props: {
        params: Promise<{ conversationId: string }>
}) {
        const params = await props.params
        const user = await requireUser()
        const t = await getTranslations('conversations')
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
        const fa = locale === 'fa'

        const view = await loadConversationView({
                conversationId: params.conversationId,
                workspaceId: user.workspaceId,
                locale,
                anonymousLabel: t('anonymous'),
        })
        if (!view) notFound()
        const { conversation, insight, handle, avatar, who, handoffAlert, sourceTag, attention, liveSummary } = view
        // What the composer's helpers need: a live card-to-card gateway, and products.
        const [gateway, platform, activeCards, products] = await Promise.all([
                prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { plan: true, payGatewayEnabled: true, payGatewaySuspendedAt: true, payGatewayCapOverride: true } }),
                getPlatformGatewaySettings(),
                prisma.payCard.count({ where: { workspaceId: user.workspaceId, active: true, deletedAt: null } }),
                prisma.product.count({ where: { workspaceId: user.workspaceId, active: true, deletedAt: null } }),
        ])
        const usage = gateway?.payGatewayEnabled && !gateway.payGatewaySuspendedAt && activeCards ? await getGatewayUsage(user.workspaceId, gateway.plan, gateway.payGatewayCapOverride) : null
        const tools: ComposerTools = {
                payment: !platform.enabled || gateway?.payGatewaySuspendedAt || usage?.reached ? 'GATEWAY_PAUSED' : !gateway?.payGatewayEnabled ? 'GATEWAY_OFF' : !activeCards ? 'NO_CARD' : null,
                products: products ? null : 'NO_PRODUCTS',
        }
        const meta = [
                conversation.agent.name,
                handle ? `@${handle}` : null,
                conversation.contact?.phone ? displayPhone(conversation.contact.phone) : null,
        ].filter(Boolean)

        return (
                <div className="mx-auto flex h-full max-w-none flex-col gap-3">
                        <BackButton href="/conversations" label={t('title')} className="w-fit self-start shrink-0" />

                        <div className="spatial-surface flex shrink-0 items-center gap-3 rounded-card p-3 sm:p-4">
                                <ContactAvatar src={avatar} alt={who} size="md" loading="eager" />
                                <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                {conversation.contact?.id ? (
                                                        <Link href={`/contacts/${conversation.contact.id}`} dir="auto" className="min-w-0 truncate text-lg font-bold tracking-tight text-[var(--text-primary)] hover:underline">{who}</Link>
                                                ) : (
                                                        <span dir="auto" className="min-w-0 truncate text-lg font-bold tracking-tight text-[var(--text-primary)]">{who}</span>
                                                )}
                                                <ChannelBadge type={conversation.channel} label={sourceTag} />
                                                {attention && <ConversationStatusBadge status="HANDED_OFF" label={fa ? 'نیاز به اپراتور' : 'Needs operator'} attention />}
                                                <span className="hidden sm:inline-flex"><SalesInsightBadge insight={insight} locale={locale} compactOnMobile /></span>
                                        </div>
                                        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                                                {meta.map((item, index) => (
                                                        <span key={index}>
                                                                {index > 0 && ' · '}
                                                                <bdi dir={index === 0 ? 'auto' : 'ltr'}>{item}</bdi>
                                                        </span>
                                                ))}
                                        </p>
                                </div>
                                <ConversationHeaderActions conversationId={conversation.id} status={conversation.status} />
                        </div>

                        <ConversationPaymentBanner workspaceId={user.workspaceId} conversationId={conversation.id} locale={locale} />

                        <ConversationMobileLayout
                                locale={locale}
                                thread={
                                        <ConversationThread
                                                key={conversation.id}
                                                initialMessages={view.threadMessages as ThreadMessage[]}
                                                conversationId={conversation.id}
                                                locale={locale}
                                                channel={conversation.channel}
                                                commentThread={conversation.channel === 'INSTAGRAM' && isInstagramCommentThread(conversation.externalId)}
                                                tools={tools}
                                                handoff={handoffAlert ? { at: handoffAlert.createdAt, reason: handoffAlert.reason } : null}
                                        />
                                }
                                details={
                                        <div className="overflow-hidden rounded-card border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-[var(--elev-1)]">
                                                <ConversationDetails
                                                        locale={locale}
                                                        conversationId={conversation.id}
                                                        status={conversation.status}
                                                        summary={conversation.summary ?? liveSummary}
                                                        channel={conversation.channel}
                                                        agentName={conversation.agent.name}
                                                        sourceTag={sourceTag}
                                                        contact={conversation.contact ? { id: conversation.contact.id, name: conversation.contact.name, phone: conversation.contact.phone } : null}
                                                        handle={handle}
                                                        handoffAlert={handoffAlert}
                                                        insight={insight}
                                                        copyLabel={t('copy')}
                                                        copiedLabel={t('copied')}
                                                />
                                        </div>
                                }
                        />
                </div>
        )
}
