import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Bot, BrainCircuit, Cable, MessageSquare, WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'
import { TrendChart } from '@/components/admin/trend-chart'
import { CHART_ACCENT } from '@/components/admin/chart-palette'
import { StatusChip } from '@/components/ui/status-chip'
import { PageHeader, StatCard, Panel, Badge, fa, fmtDate, fmtIRR } from '../../ui'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'
import { displayPhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'

const CHANNEL_LABEL: Record<string, string> = {
  TELEGRAM: 'تلگرام', WHATSAPP: 'واتساپ', INSTAGRAM: 'اینستاگرام',
  RUBIKA: 'روبیکا', BALE: 'بله', WEB_WIDGET: 'ویجت وب', API: 'API', CHAT_LINK: 'لینک چت',
}

const KNOWLEDGE_STATUS_LABEL: Record<string, string> = {
  READY: 'آماده', PROCESSING: 'در حال پردازش', PENDING: 'در صف', ERROR: 'خطا',
}

export default async function AdminAgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  const since = new Date(Date.now() - 30 * 86_400_000)
  const agent = await prisma.agent.findFirst({
    where: { ...ADMIN_VISIBLE_RELATED_WHERE, id: agentId },
    select: {
      id: true, name: true, description: true, active: true, model: true, language: true,
      handoffEnabled: true, updatedAt: true,
      workspace: { select: { name: true, plan: true } },
      channels: { select: { id: true, type: true, active: true, lastInboundAt: true } },
      knowledgeBases: { select: { id: true, name: true, status: true, updatedAt: true } },
      conversations: {
        where: { deletedAt: null },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }], take: 8,
        select: { id: true, status: true, channel: true, messageCount: true, lastMessageAt: true, createdAt: true, contact: { select: { name: true, phone: true } } },
      },
      _count: { select: { conversations: { where: { deletedAt: null } }, knowledgeBases: true, channels: true } },
    },
  })
  if (!agent) notFound()

  const [dailyRows, usage] = await Promise.all([
    prisma.$queryRaw<{ d: string; c: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Tehran'), 'YYYY-MM-DD') AS d, count(*) AS c
      FROM "Conversation" WHERE "agentId" = ${agentId} AND "createdAt" >= ${new Date(Date.now() - 7 * 86_400_000)} AND "deletedAt" IS NULL
      GROUP BY 1 ORDER BY 1`,
    prisma.usageLog.aggregate({ where: { agentId, date: { gte: since }, status: 'CAPTURED' }, _sum: { chargedIRR: true, cost: true }, _count: { _all: true } }),
  ])
  const byDay = new Map(dailyRows.map((row) => [row.d, Number(row.c)]))
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000)
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    return { day: new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, { timeZone: 'Asia/Tehran', weekday: 'short' }).format(date), value: byDay.get(key) ?? 0 }
  })
  const readyKnowledge = agent.knowledgeBases.filter((item) => item.status === 'READY').length

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.name}
        subtitle={`${agent.workspace.name} · جزئیات عملکرد و پیکربندی ایجنت`}
        back={{ href: '/admin/agents', label: 'ایجنت‌ها' }}
        icon={Bot}
        action={(
          <>
            <StatusChip tone={agent.active ? 'ok' : 'neutral'} dot>{agent.active ? 'فعال' : 'غیرفعال'}</StatusChip>
            <Badge tone="muted">مدل: <bdi dir="ltr">{agent.model || 'پیش‌فرض'}</bdi></Badge>
            <Badge tone="muted">زبان: {agent.language}</Badge>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard label="کل گفتگو" value={fa(agent._count.conversations)} icon={<MessageSquare className="h-5 w-5" />} tone="info" />
        <StatCard label="دانش آماده" value={`${fa(readyKnowledge)} / ${fa(agent._count.knowledgeBases)}`} icon={<BrainCircuit className="h-5 w-5" />} />
        <StatCard label="اتصال‌ها" value={fa(agent._count.channels)} icon={<Cable className="h-5 w-5" />} />
        <StatCard label="هزینه ۳۰ روز" value={fmtIRR(usage._sum.chargedIRR ?? 0)} sub={`${fa(usage._count._all)} درخواست AI`} icon={<WalletCards className="h-5 w-5" />} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <TrendChart title="گفتگوهای ۷ روز اخیر" data={trend} color={CHART_ACCENT} height={220} />
        <Panel title="اتصال‌ها و دانش">
          {agent.channels.length === 0 && agent.knowledgeBases.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-muted)]">اتصال یا منبع دانشی ثبت نشده است</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {agent.channels.map((channel) => (
                <li key={channel.id} className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-[var(--text-secondary)]">
                  <span className="flex min-w-0 items-center gap-2"><Cable className="h-4 w-4 shrink-0 text-[var(--text-hint)]" aria-hidden /><span className="truncate">{CHANNEL_LABEL[channel.type] ?? channel.type}</span></span>
                  <Badge tone={channel.active ? 'success' : 'muted'}>{channel.active ? 'فعال' : 'غیرفعال'}</Badge>
                </li>
              ))}
              {agent.knowledgeBases.map((item) => (
                <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-[var(--text-secondary)]">
                  <span className="flex min-w-0 items-center gap-2"><BrainCircuit className="h-4 w-4 shrink-0 text-[var(--text-hint)]" aria-hidden /><span className="truncate">{item.name}</span></span>
                  <Badge tone={item.status === 'READY' ? 'success' : 'muted'}>{KNOWLEDGE_STATUS_LABEL[item.status] ?? item.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="آخرین گفتگوهای این ایجنت">
        {agent.conversations.length ? (
          <ul className="-mx-2 divide-y divide-[var(--border-subtle)]">
            {agent.conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link href={`/admin/conversations/${conversation.id}`} className="flex min-h-14 items-center gap-3 rounded-control px-2 text-xs transition-colors hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
                  <MessageSquare className="h-4 w-4 shrink-0 text-[var(--text-hint)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{conversation.contact?.name || displayPhone(conversation.contact?.phone) || 'مخاطب ناشناس'}</div>
                    <div className="mt-0.5 text-[var(--text-muted)]">{CHANNEL_LABEL[conversation.channel] ?? conversation.channel} · {fa(conversation.messageCount)} پیام</div>
                  </div>
                  <span className="shrink-0 text-[var(--text-muted)]">{fmtDate(conversation.lastMessageAt ?? conversation.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-xs text-[var(--text-muted)]">گفتگویی ثبت نشده است</p>
        )}
      </Panel>
    </div>
  )
}
