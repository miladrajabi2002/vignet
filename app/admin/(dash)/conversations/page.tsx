import { MessageCircle, MessagesSquare, Headset } from 'lucide-react'
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
import { MiniTrend } from '@/components/admin/mini-trend'
import { conversationsDaily, conversationsDailyByChannel } from '@/lib/admin/charts'

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
}

// Sparkline colors per channel — distinct but harmonious.
const CHANNEL_COLOR: Record<string, string> = {
  TELEGRAM: '#3b82f6',
  WHATSAPP: '#22c55e',
  INSTAGRAM: '#ec4899',
  RUBIKA: '#f59e0b',
  BALE: '#06b6d4',
  WEB_WIDGET: '#18181b',
  API: '#a855f7',
}

export default async function AdminConversationsPage(
  props: {
    searchParams: Promise<{ page?: string }>
  },
) {
  const searchParams = await props.searchParams
  const page = Math.max(1, Number(searchParams.page) || 1)

  const [rows, totalCount, openCount, handedOffCount, convTrend7, channelSparks] =
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
          workspace: { select: { name: true } },
          contact: { select: { name: true, phone: true } },
        },
      }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { status: 'OPEN' } }),
      prisma.conversation.count({ where: { status: 'HANDED_OFF' } }),
      conversationsDaily(7),
      conversationsDailyByChannel(7),
    ])

  const hasNext = rows.length > PAGE_SIZE
  const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows

  // 7-day total from the trend series.
  const weekTotal = convTrend7.reduce((s, p) => s + p.value, 0)
  // Channel breakdown sorted by 7-day total desc — top 4 channels.
  const topChannels = [...channelSparks.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  return (
    <div className="space-y-6">
      <PageHeader
        title="مکالمات"
        subtitle="تاریخچه تمام مکالمات پلتفرم"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'مکالمات' },
        ]}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="کل مکالمات"
          value={fa(totalCount)}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="default"
        />
        <StatCard
          label="مکالمات باز"
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

      {/* ─── Mini trends: 7-day conversation volume + top channels ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniTrend
          label="مکالمات ۷ روز اخیر"
          value={weekTotal}
          series={convTrend7.map((p) => p.value)}
          color="#3b82f6"
          hint="میانگین روزانه" variant="light"
        />
        {topChannels.map((ch) => (
          <MiniTrend
            key={ch.channel}
            label={`کانال ${CHANNEL_LABEL[ch.channel] ?? ch.channel}`}
            value={ch.total}
            series={ch.series}
            color={CHANNEL_COLOR[ch.channel] ?? '#18181b'}
            hint="۷ روز اخیر" variant="light"
          />
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="h-8 w-8" />}>
          مکالمه‌ای ثبت نشده است
        </EmptyState>
      ) : (
        <TableShell>
          <thead className="border-b border-zinc-200 bg-zinc-50/60">
            <tr>
              <Th>کسب‌وکار</Th>
              <Th>ایجنت</Th>
              <Th>مخاطب</Th>
              <Th>کانال</Th>
              <Th>وضعیت</Th>
              <Th>پیام‌ها</Th>
              <Th>آخرین فعالیت</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((c) => {
              const status = STATUS_META[c.status] ?? {
                label: c.status,
                tone: 'default' as const,
              }
              return (
                <tr key={c.id} className="transition-colors hover:bg-zinc-50/60">
                  <Td className="font-medium text-zinc-900">{c.workspace.name}</Td>
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
