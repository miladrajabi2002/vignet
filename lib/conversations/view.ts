import { prisma } from '@/lib/prisma'
import { analyzeSalesConversation } from '@/lib/ai/sales-intelligence'
import { currentSessionMessages } from '@/lib/conversations/session'
import { inboundSourceLabel, readInboundSource } from '@/lib/conversations/source'
import { channelAvatarFor, channelHandleFor, contactDisplayName } from '@/lib/crm/display'
import { contactAvatarSrc } from '@/lib/crm/avatar'

/**
 * One conversation as the operator sees it: thread, customer identity on that
 * channel, the latest handoff alert and the sales reading. Shared by the inbox
 * pane and the conversation's own page so both always show the same thing.
 */
export async function loadConversationView(params: {
        conversationId: string
        workspaceId: string
        locale: 'fa' | 'en'
        anonymousLabel: string
}) {
        const conversation = await prisma.conversation.findFirst({
                where: { id: params.conversationId, workspaceId: params.workspaceId },
                select: {
                        id: true,
                        channel: true,
                        externalId: true,
                        status: true,
                        handedOff: true,
                        rating: true,
                        summary: true,
                        createdAt: true,
                        workspace: { select: { businessType: true, language: true } },
                        agent: { select: { id: true, name: true, language: true, roleTemplate: true } },
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
                        salesInsight: true,
                        messages: {
                                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                                select: {
                                        id: true,
                                        role: true,
                                        content: true,
                                        createdAt: true,
                                        contentType: true,
                                        unanswered: true,
                                        metadata: true,
                                },
                        },
                },
        })
        if (!conversation) return null

        // Historical conversations remain useful immediately, even before the
        // bounded inbox backfill has persisted their first snapshot.
        const insight = conversation.salesInsight ?? {
                ...analyzeSalesConversation({
                        messages: currentSessionMessages(conversation.messages),
                        businessType: conversation.workspace.businessType,
                        language: conversation.agent.language || conversation.workspace.language,
                        roleTemplate: conversation.agent.roleTemplate,
                }),
                handoffRecommended: false,
                analyzedAt: conversation.messages.at(-1)?.createdAt ?? conversation.createdAt,
        }

        // The per-channel handle and avatar, so the header shows the identity the
        // visitor is using on that platform.
        const handle = channelHandleFor({ channel: conversation.channel, ...conversation.contact })
        const avatar = contactAvatarSrc({
                contactId: conversation.contact?.id,
                channel: conversation.channel,
                rawUrl: channelAvatarFor({ channel: conversation.channel, ...conversation.contact }),
        })
        // Instagram DMs only carry a sender id, so the name falls back per channel
        // ("کاربر اینستاگرام") instead of "ناشناس" until the visitor types a name.
        const who = contactDisplayName({
                name: conversation.contact?.name,
                phone: conversation.contact?.phone,
                handle,
                channel: conversation.channel,
                channelId: conversation.contact ? conversation.channel : null,
                anonymousLabel: params.anonymousLabel,
        })

        const latestAlert = conversation.handoffAlerts[0] ?? null
        const handoffAlert = latestAlert
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

        const latestInbound = [...conversation.messages].reverse().find((message) => message.role === 'USER')
        const sourceLabel = latestInbound
                ? inboundSourceLabel(readInboundSource(latestInbound.metadata), params.locale)
                : null

        return {
                conversation,
                insight,
                handle,
                avatar,
                who,
                handoffAlert,
                sourceLabel,
                attention: conversation.handedOff && conversation.status !== 'RESOLVED',
                threadMessages: conversation.messages.map((m) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        createdAt: m.createdAt.toISOString(),
                        contentType: m.contentType,
                        metadata: m.metadata as Record<string, unknown> | null,
                })),
        }
}
