import Link from 'next/link'
import { Eye, MessageCircle, MessagesSquare, Headset } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  PageHeader,
  StatCard,
  Badge,
  EmptyState,
  Th,
  Td,
  TableShell,
  AdminPagination,
  fa,
  fmtDate,
  Toolbar,
} from '../ui'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'
import { displayPhone } from '@/lib/phone'
import { AdminConversationFilters } from '@/components/admin/admin-conversation-filters'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const STATUS_META: Record<
  string,
  { label: string; tone: 'info' | 'success' | 'warning' }
> = {
  OPEN: { label: 'باز', tone: 'info' },
  RESOLVED: { label: 'بسته‌شده', tone: 'success' },
  HANDED_OFF: { label: 'تحویل به اپراتور', tone: 'warning' },
}

const CHANNEL_LABEL: Record<string, string> = {
  TELEGRAM: 'تلگرام',
  WHATSAPP: 'واتساپ',
  INSTAGRAM: 'اینستاگرام',
  RUBIKA: 'روبیکا',
  BALE: 'بله',
  WEB_WIDGET: 'ویجت وب',
  API: 'API',
  CHAT_LINK: 'لینک چت',
}

const VALID_STATUSES = ['OPEN', 'RESOLVED', 'HANDED_OFF'] as const
const VALID_CHANNELS = ['TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'RUBIKA', 'BALE', 'WEB_WIDGET', 'API', 'CHAT_LINK'] as const

export default async function AdminConversationsPage(
  props: {
    searchParams: Promise<{ page?: string; q?: string; status?: string; channel?: string }>
  },
) {
  const searchParams = await props.searchParams
  const page = Math.max(1, Number(searchParams.page) || 1)
  const q = searchParams.q?.trim() ?? ''
  const statusFilter = VALID_STATUSES.includes(searchParams.status as (typeof VALID_STATUSES)[number])
    ? searchParams.status as (typeof VALID_STATUSES)[number]
    : undefined
  const channelFilter = VALID_CHANNELS.includes(searchParams.channel as (typeof VALID_CHANNELS)[number])
    ? searchParams.channel as (typeof VALID_CHANNELS)[number]
    : undefined

  const where: Prisma.ConversationWhereInput = {
    ...ADMIN_VISIBLE_RELATED_WHERE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(channelFilter ? { channel: channelFilter } : {}),
    ...(q ? {
      OR: [
        { agent: { name: { contains: q, mode: 'insensitive' } } },
        { contact: { name: { contains: q, mode: 'insensitive' } } },
        { contact: { phone: { contains: q } } },
        { workspace: { name: { contains: q, mode: 'insensitive' } } },
        { workspace: { owner: { name: { contains: q, mode: 'insensitive' } } } },
        { workspace: { owner: { phone: { contains: q } } } },
        { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
      ],
    } : {}),
  }

  const [rows, totalCount, matchedCount, openCount, resolvedCount, handedOffCount, channelGroups] =
    await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          channel: true,
          status: true,
          messageCount: true,
          lastMessageAt: true,
          createdAt: true,
          agent: { select: { name: true } },
          workspace: {
            select: {
              name: true,
              owner: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
          contact: { select: { name: true, phone: true } },
        },
      }),
      prisma.conversation.count({ where: ADMIN_VISIBLE_RELATED_WHERE }),
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'OPEN' } }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'RESOLVED' } }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'HANDED_OFF', handedOff: true } }),
      // Available channels with live counts for the filter dropdown.
      prisma.conversation.groupBy({
        by: ['channel'],
        where: ADMIN_VISIBLE_RELATED_WHERE,
        _count: { _all: true },
      }),
    ])

  const hasNext = rows.length > PAGE_SIZE
  const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows

  const buildHref = (overrides: { status?: string; channel?: string; page?: number }) => {
    const params = new URLSearchParams()
    const nextStatus = overrides.status !== undefined ? overrides.status : statusFilter
    const nextChannel = overrides.channel !== undefined ? overrides.channel : channelFilter
    const nextPage = overrides.page ?? 1
    if (q) params.set('q', q)
    if (nextStatus) params.set('status', nextStatus)
    if (nextChannel) params.set('channel', nextChannel)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    return query ? `/admin/conversations?${query}` : '/admin/conversations'
  }

  // Channels sorted by usage — only ones that actually have conversations.
  const availableChannels = channelGroups
    .map((g) => ({ channel: g.channel, count: g._count._all }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      <PageHeader
        title="گفتگوها"
        subtitle="تاریخچه تمام گفتگوهای پلتفرم"
        icon={MessagesSquare}
      />

      {/* Search + filters — same UX as the user dashboard conversations tab:
          desktop = inline selects, mobile = search + bottom-sheet. */}
      <Toolbar className="block md:p-3">
        <AdminConversationFilters
          statusOptions={[
            { key: 'ALL', label: 'همه', count: totalCount },
            { key: 'HANDED_OFF', label: 'تحویل به اپراتور', count: handedOffCount },
            { key: 'OPEN', label: 'باز', count: openCount },
            { key: 'RESOLVED', label: 'بسته‌شده', count: resolvedCount },
          ]}
          channelOptions={[
            { key: 'ALL', label: 'همه', count: totalCount },
            ...availableChannels.map((c) => ({
              key: c.channel,
              label: CHANNEL_LABEL[c.channel] ?? c.channel,
              count: c.count,
            })),
          ]}
          activeStatus={statusFilter}
          activeChannel={channelFilter}
          query={q}
          resultCount={matchedCount}
        />
      </Toolbar>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 max-lg:[&>*:first-child]:col-span-2">
        <StatCard
          label="کل گفتگوها"
          value={fa(totalCount)}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="default"
        />
        <StatCard
          label="گفتگوهای باز"
          value={fa(openCount)}
          icon={<MessageCircle className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="تحویل به اپراتور"
          value={fa(handedOffCount)}
          icon={<Headset className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="h-8 w-8" />}>
          گفتگویی با این فیلترها یافت نشد
        </EmptyState>
      ) : (
        <>
        <div className="grid gap-3 md:hidden">
          {items.map((conversation) => {
            const user = conversation.workspace.owner
            const status = STATUS_META[conversation.status] ?? { label: conversation.status, tone: 'default' as const }
            return (
              <article key={conversation.id} className="admin-record">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--text-primary)]">{conversation.contact?.name || displayPhone(conversation.contact?.phone) || 'مخاطب ناشناس'}</p>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">ایجنت: {conversation.agent.name}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <dl className="admin-record-facts">
                  <div><dt>کانال</dt><dd><Badge tone="muted">{CHANNEL_LABEL[conversation.channel] ?? conversation.channel}</Badge></dd></div>
                  <div><dt>تعداد پیام</dt><dd className="font-bold tabular-nums text-[var(--text-primary)]">{fa(conversation.messageCount)}</dd></div>
                  <div className="col-span-2"><dt>کاربر پنل</dt><dd className="truncate font-medium text-[var(--text-secondary)]">{user ? (user.name || displayPhone(user.phone)) : conversation.workspace.name}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[var(--text-muted)]">{fmtDate(conversation.lastMessageAt ?? conversation.createdAt)}</span>
                  <Link href={`/admin/conversations/${conversation.id}`} className="admin-toolbar-button min-h-11 text-[var(--text-primary)]"><Eye className="h-4 w-4" /> مشاهده گفتگو</Link>
                </div>
              </article>
            )
          })}
        </div>
        <div className="hidden md:block">
        <TableShell>
          <thead>
            <tr>
              <Th>کاربر</Th>
              <Th>ایجنت</Th>
              <Th>مخاطب</Th>
              <Th>کانال</Th>
              <Th>وضعیت</Th>
              <Th>پیام‌ها</Th>
              <Th>آخرین فعالیت</Th>
              <Th>مشاهده</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const user = c.workspace.owner
              const status = STATUS_META[c.status] ?? {
                label: c.status,
                tone: 'default' as const,
              }
              return (
                <tr key={c.id}>
                  <Td>
                    {user ? (
                      <Link href={`/admin/users/${user.id}`} className="font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--signal-strong)]">
                        {user.name || displayPhone(user.phone)}
                      </Link>
                    ) : (
                      <span className="text-[var(--text-muted)]">{c.workspace.name}</span>
                    )}
                  </Td>
                  <Td>{c.agent.name}</Td>
                  <Td className="text-[var(--text-secondary)]">
                    {c.contact?.name || displayPhone(c.contact?.phone) || '—'}
                  </Td>
                  <Td>
                    <Badge tone="muted">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Td>
                  <Td className="tabular-nums text-[var(--text-secondary)]">
                    {fa(c.messageCount)}
                  </Td>
                  <Td className="text-[var(--text-muted)]">
                    {fmtDate(c.lastMessageAt ?? c.createdAt)}
                  </Td>
                  <Td>
                    <Link href={`/admin/conversations/${c.id}`} aria-label="مشاهده گفتگو" className="admin-toolbar-button min-h-9 shadow-none"><Eye className="h-4 w-4" /> گفتگو</Link>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
        </div>
        </>
      )}

      <AdminPagination
        page={page}
        hasNext={hasNext}
        makeHref={(nextPage) => buildHref({ page: nextPage })}
      />
    </div>
  )
}
