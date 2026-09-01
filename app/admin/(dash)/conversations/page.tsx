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
} from '../ui'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'
import { displayPhone } from '@/lib/phone'
import { AdminUsersSearchForm } from '@/components/admin/admin-users-search-form'
import { AdminFilterSheet } from '@/components/admin/admin-filter-sheet'
import { FilterPills } from '../ui'

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
        { workspace: { owner: { name: { contains: q, mode: 'insensitive' } } } },
        { workspace: { owner: { phone: { contains: q } } } },
      ],
    } : {}),
  }

  const [rows, totalCount, openCount, handedOffCount] =
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
              owner: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
          contact: { select: { name: true, phone: true } },
        },
      }),
      prisma.conversation.count({ where: ADMIN_VISIBLE_RELATED_WHERE }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'OPEN' } }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'HANDED_OFF', handedOff: true } }),
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
  const statusPills = [
    { label: 'همه', href: buildHref({ status: '' }), active: !statusFilter },
    ...VALID_STATUSES.map((value) => ({ label: STATUS_META[value].label, href: buildHref({ status: value }), active: statusFilter === value })),
  ]
  const channelPills = [
    { label: 'همه', href: buildHref({ channel: '' }), active: !channelFilter },
    ...VALID_CHANNELS.map((value) => ({ label: CHANNEL_LABEL[value], href: buildHref({ channel: value }), active: channelFilter === value })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="گفتگوها"
        subtitle="تاریخچه تمام گفتگوهای پلتفرم"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'گفتگوها' },
        ]}
      />

      <div className="sticky top-20 z-20 flex gap-2 rounded-[1.35rem] border border-black/[0.07] bg-white/90 p-2 shadow-[var(--shadow-soft)] backdrop-blur-xl md:static md:bg-white/72">
        <AdminUsersSearchForm
          defaultQuery={q}
          placeholder="جستجوی کاربر، مخاطب یا ایجنت…"
          ariaLabel="جستجوی گفتگوها"
          basePath="/admin/conversations"
        />
        <div className="hidden min-w-0 flex-1 gap-2 overflow-x-auto md:flex">
          <FilterPills options={statusPills} />
          <FilterPills options={channelPills} />
        </div>
        <div className="md:hidden">
          <AdminFilterSheet
            title="فیلتر"
            description="وضعیت و کانال گفتگو را انتخاب کنید"
            groups={[{ label: 'وضعیت', options: statusPills }, { label: 'کانال', options: channelPills }]}
            activeCount={(statusFilter ? 1 : 0) + (channelFilter ? 1 : 0)}
            clearHref={q ? `/admin/conversations?q=${encodeURIComponent(q)}` : '/admin/conversations'}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          گفتگویی ثبت نشده است
        </EmptyState>
      ) : (
        <>
        <div className="grid gap-3 md:hidden">
          {items.map((conversation) => {
            const user = conversation.workspace.owner
            const status = STATUS_META[conversation.status] ?? { label: conversation.status, tone: 'default' as const }
            return (
              <article key={conversation.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-950">{conversation.contact?.name || displayPhone(conversation.contact?.phone) || 'مخاطب ناشناس'}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">ایجنت: {conversation.agent.name}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                  <div><dt className="text-zinc-400">کانال</dt><dd className="mt-1"><Badge tone="muted">{CHANNEL_LABEL[conversation.channel] ?? conversation.channel}</Badge></dd></div>
                  <div><dt className="text-zinc-400">تعداد پیام</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900">{fa(conversation.messageCount)}</dd></div>
                  <div className="col-span-2"><dt className="text-zinc-400">کاربر پنل</dt><dd className="mt-1 truncate font-medium text-zinc-700">{user ? (user.name || displayPhone(user.phone)) : '—'}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <span className="text-[11px] text-zinc-400">{fmtDate(conversation.lastMessageAt ?? conversation.createdAt)}</span>
                  <Link href={`/admin/conversations/${conversation.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-bold text-zinc-900"><Eye className="h-4 w-4" /> مشاهده گفتگو</Link>
                </div>
              </article>
            )
          })}
        </div>
        <div className="hidden md:block">
        <TableShell>
          <thead className="border-b border-zinc-200 bg-zinc-50/60">
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
          <tbody className="divide-y divide-zinc-100">
            {items.map((c) => {
              const user = c.workspace.owner
              const status = STATUS_META[c.status] ?? {
                label: c.status,
                tone: 'default' as const,
              }
              return (
                <tr key={c.id} className="transition-colors hover:bg-zinc-50/60">
                  <Td>
                    {user ? (
                      <Link href={`/admin/users/${user.id}`} className="font-medium text-zinc-900 hover:underline">
                        {user.name || displayPhone(user.phone)}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>{c.agent.name}</Td>
                  <Td className="text-zinc-600">
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
                  <Td className="tabular-nums text-zinc-600">
                    {fa(c.messageCount)}
                  </Td>
                  <Td className="text-zinc-500">
                    {fmtDate(c.lastMessageAt ?? c.createdAt)}
                  </Td>
                  <Td>
                    <Link href={`/admin/conversations/${c.id}`} aria-label="مشاهده گفتگو" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/[0.08] px-3 text-xs font-semibold text-black/65 transition-[background-color,transform] hover:bg-black/[0.04] active:scale-[.97]"><Eye className="h-4 w-4" /> گفتگو</Link>
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
