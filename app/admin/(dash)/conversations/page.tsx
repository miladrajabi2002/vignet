import Link from 'next/link'
import { Eye, MessageCircle, MessagesSquare, Headset } from 'lucide-react'
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

export default async function AdminConversationsPage(
  props: {
    searchParams: Promise<{ page?: string }>
  },
) {
  const searchParams = await props.searchParams
  const page = Math.max(1, Number(searchParams.page) || 1)

  const [rows, totalCount, openCount, handedOffCount] =
    await Promise.all([
      prisma.conversation.findMany({
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
              users: {
                orderBy: { createdAt: 'asc' },
                take: 1,
                select: { id: true, name: true, phone: true },
              },
            },
          },
          contact: { select: { name: true, phone: true } },
        },
      }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { status: 'OPEN' } }),
      prisma.conversation.count({ where: { status: 'HANDED_OFF', handedOff: true } }),
    ])

  const hasNext = rows.length > PAGE_SIZE
  const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows

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
              const user = c.workspace.users[0]
              const status = STATUS_META[c.status] ?? {
                label: c.status,
                tone: 'default' as const,
              }
              return (
                <tr key={c.id} className="transition-colors hover:bg-zinc-50/60">
                  <Td>
                    {user ? (
                      <Link href={`/admin/users/${user.id}`} className="font-medium text-zinc-900 hover:underline">
                        {user.name || user.phone}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>{c.agent.name}</Td>
                  <Td className="text-zinc-600">
                    {c.contact?.name || c.contact?.phone || '—'}
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
      )}

      <AdminPagination
        page={page}
        hasNext={hasNext}
        makeHref={(p) =>
          p > 1 ? `/admin/conversations?page=${p}` : '/admin/conversations'
        }
      />
    </div>
  )
}
