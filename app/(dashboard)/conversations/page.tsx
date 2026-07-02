import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { MessagesSquare, User, Clock, Filter, RefreshCw } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { MetricsExplainer } from '@/components/dashboard/metrics-explainer'
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

      <MetricsExplainer
        title={
          locale === 'fa'
            ? 'این لیست چگونه مرتب می‌شود؟'
            : 'How is this list ordered?'
        }
        items={[
          {
            icon: Clock,
            term:
              locale === 'fa' ? 'ترتیب نمایش: ' : 'Sort order: ',
            body:
              locale === 'fa'
                ? 'گفتگوها بر اساس زمان آخرین پیام مرتب می‌شوند (جدیدترین اول). گفتگوهایی که هنوز پیام ندارند بر اساس زمان ایجاد مرتب می‌شوند.'
                : 'Conversations are ordered by the time of their last message (newest first). Conversations with no messages yet are ordered by creation time.',
          },
          {
            icon: Filter,
            term:
              locale === 'fa' ? 'محصولات نمایش: ' : 'What is shown: ',
            body:
              locale === 'fa'
                ? 'هر ردیف یک گفتگو است — شامل نام یا شماره مشتری، کانال، آخرین پیام (پیش‌نمایش کوتاه)، نام ایجنت و زمان نسبی. برای دیدن کل گفتگو روی ردیف کلیک کنید.'
                : 'Each row is one conversation — showing the customer name or phone, channel, last message (short preview), agent name, and relative time. Click a row to see the full thread.',
          },
          {
            icon: RefreshCw,
            term:
              locale === 'fa' ? 'به‌روزرسانی: ' : 'Live updates: ',
            body:
              locale === 'fa'
                ? 'این صفحه به‌صورت لحظه‌ای به‌روز نمی‌شود. برای دیدن گفتگوهای جدید، صفحه را refresh کنید. وضعیت گفتگو (باز، کامل، تحویل‌شده) در صفحه جزئیات قابل تغییر است.'
                : 'This page does not update in real time. Refresh to see new conversations. Conversation status (open, resolved, handed off) can be changed on the detail page.',
          },
        ]}
      />
    </div>
  )
}
