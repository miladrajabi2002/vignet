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
import { loadConversationView } from '@/lib/conversations/view'
import { isInstagramCommentThread } from '@/lib/channels/delivery-errors'

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
        const { conversation, insight, handle, avatar, who, handoffAlert, sourceLabel, attention } = view
        const meta = [
                conversation.agent.name,
                handle ? `@${handle}` : null,
                conversation.contact?.phone ? displayPhone(conversation.contact.phone) : null,
        ].filter(Boolean)

        return (
                <div className="mx-auto flex h-full max-w-7xl flex-col gap-3">
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
                                                <ChannelBadge type={conversation.channel} />
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
                                                handoff={handoffAlert ? { at: handoffAlert.createdAt, reason: handoffAlert.reason } : null}
                                        />
                                }
                                details={
                                        <div className="overflow-hidden rounded-card border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-[var(--elev-1)]">
                                                <ConversationDetails
                                                        locale={locale}
                                                        conversationId={conversation.id}
                                                        status={conversation.status}
                                                        rating={conversation.rating}
                                                        summary={conversation.summary}
                                                        channel={conversation.channel}
                                                        agentName={conversation.agent.name}
                                                        sourceLabel={sourceLabel}
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
