import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, User, Phone, Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ConversationActions } from '@/components/crm/conversation-actions'
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
      status: true,
      rating: true,
      summary: true,
      createdAt: true,
      agent: { select: { name: true } },
      contact: { select: { name: true, phone: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, createdAt: true, contentType: true },
      },
    },
  })
  if (!conversation) notFound()

  const who = conversation.contact?.name || conversation.contact?.phone || t('anonymous')

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
                    : 'bg-white text-black',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <span
                  className={cn(
                    'mt-1 block text-[10px]',
                    isUser ? 'text-[var(--text-muted)]' : 'text-black/40',
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
    </div>
  )
}
