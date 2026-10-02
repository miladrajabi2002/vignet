import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationHeaderActions } from '@/components/crm/conversation-actions'
import { ConversationDetails } from '@/components/crm/conversation-details'
import { ConversationThread, type ThreadMessage } from '@/components/crm/conversation-thread'
import { ConversationStatusBadge } from '@/components/crm/conversation-status-badge'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { SalesInsightText } from '@/components/crm/sales-insight'
import { InboxPaneFrame } from '@/components/crm/inbox-pane'
import { displayPhone } from '@/lib/phone'
import { loadConversationView } from '@/lib/conversations/view'

/**
 * The selected conversation inside the three-pane inbox: thread in the middle,
 * customer summary beside it. It shows what /conversations/[id] shows, without
 * leaving the list.
 */
export async function InboxConversationPane({
        conversationId,
        workspaceId,
        locale,
}: {
        conversationId: string
        workspaceId: string
        locale: 'fa' | 'en'
}) {
        const t = await getTranslations('conversations')
        const fa = locale === 'fa'
        const view = await loadConversationView({ conversationId, workspaceId, locale, anonymousLabel: t('anonymous') })

        if (!view) {
                return (
                        <div className="grid min-h-0 place-items-center p-8 text-center text-sm text-[var(--text-muted)]">
                                {fa ? 'این گفتگو دیگر در دسترس نیست. از فهرست یکی را انتخاب کنید.' : 'This conversation is no longer available. Pick one from the list.'}
                        </div>
                )
        }

        const { conversation, insight, handle, avatar, who, handoffAlert, sourceLabel, attention } = view
        const meta = [
                conversation.agent.name,
                handle ? `@${handle}` : null,
                conversation.contact?.phone ? displayPhone(conversation.contact.phone) : null,
        ].filter(Boolean)
        const strip = conversation.summary ?? handoffAlert?.summary ?? insight.recommendedAction

        return (
                <InboxPaneFrame
                        locale={locale}
                        header={
                                <div className="flex min-w-0 items-center gap-2.5">
                                        <ContactAvatar src={avatar} alt={who} />
                                        <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-center gap-2">
                                                        {conversation.contact?.id ? (
                                                                <Link href={`/contacts/${conversation.contact.id}`} dir="auto" className="min-w-0 truncate text-[15px] font-bold text-[var(--text-primary)] hover:underline">{who}</Link>
                                                        ) : (
                                                                <span dir="auto" className="min-w-0 truncate text-[15px] font-bold text-[var(--text-primary)]">{who}</span>
                                                        )}
                                                        {attention && (
                                                                <span className="hidden shrink-0 2xl:inline-flex">
                                                                        <ConversationStatusBadge status="HANDED_OFF" label={fa ? 'نیاز به اپراتور' : 'Needs operator'} attention />
                                                                </span>
                                                        )}
                                                </div>
                                                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                                        <ChannelBadge type={conversation.channel} />
                                                        <p className="min-w-0 truncate text-[12px] text-[var(--text-muted)]">
                                                                {meta.map((item, index) => (
                                                                        <span key={index}>
                                                                                {index > 0 && ' · '}
                                                                                <bdi dir={index === 0 ? 'auto' : 'ltr'}>{item}</bdi>
                                                                        </span>
                                                                ))}
                                                        </p>
                                                </div>
                                        </div>
                                        <ConversationHeaderActions
                                                key={conversation.id}
                                                conversationId={conversation.id}
                                                status={conversation.status}
                                                fullPageHref={`/conversations/${conversation.id}`}
                                        />
                                </div>
                        }
                        strip={strip ? (
                                <>
                                        <span dir="auto" className="min-w-0 flex-1 truncate text-start">{strip}</span>
                                        {insight.leadType !== 'UNCLEAR' && <SalesInsightText insight={insight} locale={locale} />}
                                </>
                        ) : null}
                        thread={
                                <ConversationThread
                                        key={conversation.id}
                                        embedded
                                        initialMessages={view.threadMessages as ThreadMessage[]}
                                        conversationId={conversation.id}
                                        locale={locale}
                                        handoff={handoffAlert ? { at: handoffAlert.createdAt, reason: handoffAlert.reason } : null}
                                />
                        }
                        details={
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
                        }
                />
        )
}
