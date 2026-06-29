import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { MessagesSquare, User } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { relativeTime } from '@/lib/format'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 50

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('conversations')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const page = Math.max(1, Number(searchParams.page) || 1)

  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1, // one extra row tells us whether a next page exists
    select: {
      id: true,
      channel: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      agent: { select: { name: true } },
      contact: { select: { name: true, phone: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, role: true },
      },
    },
  })

  const hasNext = conversations.length > PAGE_SIZE
  const pageItems = hasNext ? conversations.slice(0, PAGE_SIZE) : conversations

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      {pageItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
          <MessagesSquare className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('empty')}</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
          {pageItems.map((c) => {
            const last = c.messages[0]
            const when = c.lastMessageAt ?? c.createdAt
            const who = c.contact?.name || c.contact?.phone || t('anonymous')
            return (
              <Link
                key={c.id}
                href={`/conversations/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {who}
                    </span>
                    <ChannelBadge type={c.channel} />
                  </div>
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    {last
                      ? `${last.role === 'ASSISTANT' ? '↩ ' : ''}${last.content}`
                      : c.agent.name}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                  {relativeTime(when, locale)}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        hasNext={hasNext}
        makeHref={(p) => `/conversations?page=${p}`}
      />
    </div>
  )
}
