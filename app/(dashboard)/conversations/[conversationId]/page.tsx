import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { User, Phone, Sparkles } from 'lucide-react'
import type { ChannelType } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationActions } from '@/components/crm/conversation-actions'
import { BackButton } from '@/components/dashboard/back-button'
import {
        ConversationThread,
        type ThreadMessage,
} from '@/components/crm/conversation-thread'
import {
        ConversationPanel,
        type HandoffAlertProp,
} from '@/components/crm/conversation-panel'
import { isMessengerType } from '@/lib/channels/registry'
import { contactDisplayName } from '@/lib/crm/display'
import { inboundSourceLabel, readInboundSource } from '@/lib/conversations/source'

export default async function ConversationThreadPage(props: {
        params: Promise<{ conversationId: string }>
}) {
        const params = await props.params
        const user = await requireUser()
        const t = await getTranslations('conversations')
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

        const conversation = await prisma.conversation.findFirst({
                where: { id: params.conversationId, workspaceId: user.workspaceId },
                select: {
                        id: true,
                        channel: true,
                        externalId: true,
                        status: true,
                        rating: true,
                        summary: true,
                        createdAt: true,
                        agentId: true,
                        agent: { select: { id: true, name: true } },
                        contact: {
                                select: {
                                        id: true,
                                        name: true,
                                        phone: true,
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
                                },
                        },
                        handoffAlerts: {
                                orderBy: { createdAt: 'desc' },
                                take: 1,
                                select: {
                                        id: true,
                                        reason: true,
                                        state: true,
                                        createdAt: true,
                                        contactName: true,
                                        contactPhone: true,
                                        summary: true,
                                },
                        },
                        messages: {
                                orderBy: { createdAt: 'asc' },
                                select: {
                                        id: true,
                                        role: true,
                                        content: true,
                                        createdAt: true,
                                        contentType: true,
                                        metadata: true,
                                },
                        },
                },
        })
        if (!conversation) notFound()

        // Load the agent's active messenger channels so the panel can show
        // "go to Telegram/Bale/Rubika" indicators when a handoff is active.
        const agentChannels = await prisma.agentChannel.findMany({
                where: { agentId: conversation.agent.id, active: true },
                select: { type: true },
        })
        const connectedChannels: ChannelType[] = agentChannels
                .map((c) => c.type)
                .filter((c): c is ChannelType => isMessengerType(c))

        const canDeliver = isMessengerType(conversation.channel) && !!conversation.externalId

        // Pick the per-channel avatar + handle for the contact based on the
        // conversation's channel so the header reflects the same identity the
        // visitor is using on that platform.
        const contactAvatarUrl =
                conversation.channel === 'TELEGRAM'
                        ? conversation.contact?.telegramAvatarUrl ?? null
                        : conversation.channel === 'BALE'
                                ? conversation.contact?.baleAvatarUrl ?? null
                                : conversation.channel === 'RUBIKA'
                                        ? conversation.contact?.rubikaAvatarUrl ?? null
                                        : conversation.channel === 'WHATSAPP'
                                                ? conversation.contact?.whatsappAvatarUrl ?? null
                                                : conversation.channel === 'INSTAGRAM'
                                                        ? conversation.contact?.instagramAvatarUrl ?? null
                                                        : null
        const contactHandle =
                conversation.channel === 'TELEGRAM'
                        ? conversation.contact?.telegramUsername ?? null
                        : conversation.channel === 'BALE'
                                ? conversation.contact?.baleUsername ?? null
                                : conversation.channel === 'RUBIKA'
                                        ? conversation.contact?.rubikaUsername ?? null
                                        : conversation.channel === 'WHATSAPP'
                                                ? conversation.contact?.whatsappName ?? null
                                                : conversation.channel === 'INSTAGRAM'
                                                        ? conversation.contact?.instagramUsername ?? null
                                                        : null

        // Resolve the contact's display name with a per-channel fallback so
        // Instagram DMs (which only carry a sender id) show "کاربر اینستاگرام"
        // instead of "ناشناس" until the visitor types their name.
        const who = contactDisplayName({
                name: conversation.contact?.name,
                phone: conversation.contact?.phone,
                handle: contactHandle,
                channel: conversation.channel,
                channelId: conversation.contact ? (conversation.channel as string) : null,
                anonymousLabel: t('anonymous'),
        })

        const latestAlert = conversation.handoffAlerts[0] ?? null
        const handoffAlertProp: HandoffAlertProp | null = latestAlert
                ? {
                                id: latestAlert.id,
                                reason: latestAlert.reason,
                                state: latestAlert.state as 'open' | 'claimed' | 'resolved',
                                createdAt: latestAlert.createdAt.toISOString(),
                                contactName: latestAlert.contactName,
                                contactPhone: latestAlert.contactPhone,
                                summary: latestAlert.summary,
                        }
                : null

        const showPanel =
                conversation.status !== 'RESOLVED' &&
                (conversation.status === 'HANDED_OFF' ||
                        (handoffAlertProp != null && handoffAlertProp.state !== 'resolved'))

        const latestInboundSource = [...conversation.messages]
                .reverse()
                .find((message) => message.role === 'USER')
        const latestInboundSourceLabel = latestInboundSource
                ? inboundSourceLabel(readInboundSource(latestInboundSource.metadata), locale)
                : null

        return (
                <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
                        <BackButton href="/conversations" label={t('title')} className="w-fit self-start shrink-0" />

                        <div className="spatial-surface flex shrink-0 items-center gap-3 rounded-[1.5rem] p-4 sm:p-5">
                                {contactAvatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                                src={contactAvatarUrl}
                                                alt={who}
                                                width={40}
                                                height={40}
                                                decoding="async"
                                                referrerPolicy="no-referrer"
                                                className="h-10 w-10 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
                                        />
                                ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
                                                <User className="h-5 w-5" />
                                        </div>
                                )}
                                <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                                {conversation.contact?.id ? <Link href={`/contacts/${conversation.contact.id}`} className="truncate text-xl font-bold tracking-tight text-[var(--text-primary)] hover:underline">{who}</Link> : <span className="truncate text-xl font-bold tracking-tight text-[var(--text-primary)]">{who}</span>}
                                                <ChannelBadge type={conversation.channel} />
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                <span>{conversation.agent.name}</span>
                                                {contactHandle && (
                                                        <span dir="ltr" className="inline-flex items-center gap-1">
                                                                @
                                                                {contactHandle}
                                                        </span>
                                                )}
                                                {conversation.contact?.phone && (
                                                        <span dir="ltr" className="inline-flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {conversation.contact.phone}
                                                        </span>
                                                )}
                                        </div>
                                </div>
                        </div>

                        <div className="grid min-h-[calc(100dvh-11rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
                          <ConversationThread
                                key={conversation.id}
                                initialMessages={conversation.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(), contentType: m.contentType, metadata: m.metadata as Record<string, unknown> | null })) as ThreadMessage[]}
                                conversationId={conversation.id}
                                canDeliver={canDeliver}
                                locale={locale}
                          />
                          <aside className="space-y-3">
                        {showPanel && (
                                <ConversationPanel
                                        status={conversation.status}
                                        contactName={conversation.contact?.name ?? null}
                                        contactPhone={conversation.contact?.phone ?? null}
                                        channel={conversation.channel}
                                        agentName={conversation.agent.name}
                                        summary={conversation.summary}
                                        handoffAlert={handoffAlertProp}
                                        connectedChannels={connectedChannels}
                                        locale={locale}
                                />
                        )}

                        <ConversationActions
                                conversationId={conversation.id}
                                status={conversation.status}
                                rating={conversation.rating}
                        />

                        {conversation.summary && (
                                <div className="spatial-surface shrink-0 rounded-[1.5rem] p-4">
                                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                {t('summary')}
                                                {latestInboundSourceLabel && (
                                                        <span className="rounded-full bg-black/[0.045] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                                                {latestInboundSourceLabel}
                                                        </span>
                                                )}
                                        </div>
                                        <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                                                {conversation.summary}
                                        </p>
                                </div>
                        )}

                          </aside>
                        </div>
                </div>
        )
}
