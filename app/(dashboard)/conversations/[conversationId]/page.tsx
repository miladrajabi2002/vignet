import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, User, Phone, Sparkles } from 'lucide-react'
import type { ChannelType } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationActions } from '@/components/crm/conversation-actions'
import { OperatorReply } from '@/components/crm/operator-reply'
import {
        ConversationPanel,
        type HandoffAlertProp,
} from '@/components/crm/conversation-panel'
import { isMessengerType } from '@/lib/channels/registry'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'

export default async function ConversationThreadPage({
  params,
}: {
  params: { conversationId: string }
}) {
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
      contact: { select: { name: true, phone: true } },
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

  const who = conversation.contact?.name || conversation.contact?.phone || t('anonymous')
  const canDeliver =
    isMessengerType(conversation.channel) && !!conversation.externalId

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
    conversation.status === 'HANDED_OFF' ||
    (handoffAlertProp != null && handoffAlertProp.state !== 'resolved')

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col space-y-4">
      <Link
        href="/conversations"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('title')}
      </Link>

      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[var(--text-primary)]">{who}</span>
            <ChannelBadge type={conversation.channel} />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{conversation.agent.name}</span>
            {conversation.contact?.phone && (
              <span dir="ltr" className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {conversation.contact.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {showPanel && (
        <ConversationPanel
          conversationId={conversation.id}
          status={conversation.status}
          contactName={conversation.contact?.name ?? null}
          contactPhone={conversation.contact?.phone ?? null}
          channel={conversation.channel}
          agentName={conversation.agent.name}
          summary={conversation.summary}
          handoffAlert={handoffAlertProp}
          connectedChannels={connectedChannels}
          canDeliver={canDeliver}
          locale={locale}
        />
      )}

      <ConversationActions
        conversationId={conversation.id}
        status={conversation.status}
        rating={conversation.rating}
      />

      {conversation.summary && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <Sparkles className="h-3.5 w-3.5" />
            {t('summary')}
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            {conversation.summary}
          </p>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        {conversation.messages.map((m) => {
          const isUser = m.role === 'USER'
          if (m.role === 'SYSTEM') return null
          const isOperator =
            !!m.metadata &&
            typeof m.metadata === 'object' &&
            (m.metadata as Record<string, unknown>).operator === true
          return (
            <div
              key={m.id}
              className={cn('flex', isUser ? 'justify-start' : 'justify-end')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                  isUser
                    ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]'
                    : 'bg-[var(--white)] text-[var(--bg-base)]',
                )}
              >
                {isOperator && (
                  <span className="mb-0.5 block text-[10px] font-medium opacity-60">
                    {t('operatorBadge')}
                  </span>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <span
                  className={cn(
                    'mt-1 block text-[10px]',
                    isUser ? 'text-[var(--text-muted)]' : 'text-[var(--bg-base)] opacity-40',
                  )}
                >
                  {formatDateTime(m.createdAt, locale)}
                </span>
              </div>
            </div>
          )
        })}
        {conversation.messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">{t('noMessages')}</p>
        )}
      </div>

      {/* When the panel is shown, it already renders the OperatorReply box; */}
      {/* otherwise show the standalone reply box below. */}
      {!showPanel && (
        <OperatorReply conversationId={conversation.id} canDeliver={canDeliver} />
      )}
    </div>
  )
}
