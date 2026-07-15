import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Bot, BrainCircuit, Cable, MessageSquare, WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { TrendChart } from '@/components/admin/trend-chart'
import { PageHeader, StatCard, Card, Badge, fa, fmtDate } from '../../ui'

export const dynamic = 'force-dynamic'

const CHANNEL_LABEL: Record<string, string> = {
  TELEGRAM: 'تلگرام', WHATSAPP: 'واتساپ', INSTAGRAM: 'اینستاگرام',
  RUBIKA: 'روبیکا', BALE: 'بله', WEB_WIDGET: 'ویجت وب', API: 'API', CHAT_LINK: 'لینک چت',
}

export default async function AdminAgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  const since = new Date(Date.now() - 30 * 86_400_000)
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true, name: true, description: true, active: true, model: true, language: true,
      temperature: true, maxTokens: true, handoffEnabled: true, updatedAt: true,
      workspace: { select: { name: true, plan: true } },
      channels: { select: { id: true, type: true, active: true, lastInboundAt: true } },
      knowledgeBases: { select: { id: true, name: true, status: true, updatedAt: true } },
      conversations: {
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }], take: 8,
        select: { id: true, status: true, channel: true, messageCount: true, lastMessageAt: true, createdAt: true, contact: { select: { name: true, phone: true } } },
      },
      _count: { select: { conversations: true, knowledgeBases: true, channels: true } },
    },
  })
  if (!agent) notFound()

  const [dailyRows, usage] = await Promise.all([
    prisma.$queryRaw<{ d: string; c: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Tehran'), 'YYYY-MM-DD') AS d, count(*) AS c
      FROM "Conversation" WHERE "agentId" = ${agentId} AND "createdAt" >= ${new Date(Date.now() - 7 * 86_400_000)}
      GROUP BY 1 ORDER BY 1`,
    prisma.usageLog.aggregate({ where: { agentId, date: { gte: since }, status: 'CAPTURED' }, _sum: { chargedIRR: true, cost: true }, _count: { _all: true } }),
  ])
  const byDay = new Map(dailyRows.map((row) => [row.d, Number(row.c)]))
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000)
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    return { day: new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'short' }).format(date), value: byDay.get(key) ?? 0 }
  })
  const readyKnowledge = agent.knowledgeBases.filter((item) => item.status === 'READY').length

  return (
    <div className="space-y-5">
      <PageHeader
        title={agent.name}
        subtitle={`${agent.workspace.name} · جزئیات عملکرد و پیکربندی ایجنت`}
        action={<Link href="/admin/agents" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"><ArrowRight className="h-4 w-4" /> بازگشت</Link>}
      />

      <div className="relative overflow-hidden rounded-[28px] bg-black p-5 text-white sm:p-6">
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-white/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative grid h-16 w-16 place-items-center rounded-3xl border border-white/15 bg-white/10"><Bot className="h-8 w-8" /><span className="absolute inset-0 rounded-3xl border border-white/10 motion-safe:animate-ping" /></div>
          <div className="flex-1"><div className="flex items-center gap-2"><h2 className="text-xl font-black">{agent.name}</h2><span className="rounded-full border border-white/20 px-2 py-1 text-[10px]">{agent.active ? 'فعال' : 'غیرفعال'}</span></div><p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">{agent.description || 'توضیحی برای این ایجنت ثبت نشده است.'}</p></div>
          <div className="grid grid-cols-2 gap-2 text-xs text-white/65"><span>مدل: {agent.model || 'پیش‌فرض'}</span><span>زبان: {agent.language}</span><span>دمـا: {fa(agent.temperature)}</span><span>حد پاسخ: {fa(agent.maxTokens)}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کل گفتگو" value={fa(agent._count.conversations)} icon={<MessageSquare className="h-5 w-5" />} />
        <StatCard label="دانش آماده" value={`${fa(readyKnowledge)} / ${fa(agent._count.knowledgeBases)}`} icon={<BrainCircuit className="h-5 w-5" />} />
        <StatCard label="اتصال‌ها" value={fa(agent._count.channels)} icon={<Cable className="h-5 w-5" />} />
        <StatCard label="هزینه ۳۰ روز" value={`${fa(usage._sum.chargedIRR ?? 0)} ریال`} sub={`${fa(usage._count._all)} درخواست AI`} icon={<WalletCards className="h-5 w-5" />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
        <TrendChart title="گفتگوهای ۷ روز اخیر" data={trend} color="#18181b" height={220} />
        <Card><h2 className="mb-4 text-sm font-bold text-zinc-900">اتصال‌ها و دانش</h2><div className="space-y-2">{agent.channels.map((channel) => <div key={channel.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs"><span>{CHANNEL_LABEL[channel.type] ?? channel.type}</span><Badge tone="muted">{channel.active ? 'فعال' : 'غیرفعال'}</Badge></div>)}{agent.knowledgeBases.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs"><span className="truncate">{item.name}</span><Badge tone="muted">{item.status}</Badge></div>)}</div></Card>
      </div>

      <Card><h2 className="mb-4 text-sm font-bold text-zinc-900">آخرین گفتگوهای این ایجنت</h2><div className="divide-y divide-zinc-100">{agent.conversations.length ? agent.conversations.map((conversation) => <Link key={conversation.id} href={`/admin/conversations/${conversation.id}`} className="flex min-h-14 items-center gap-3 rounded-xl px-2 text-xs transition-colors hover:bg-zinc-50"><MessageSquare className="h-4 w-4 text-zinc-400" /><div className="min-w-0 flex-1"><div className="truncate font-semibold text-zinc-800">{conversation.contact?.name || conversation.contact?.phone || 'مخاطب ناشناس'}</div><div className="mt-1 text-zinc-400">{CHANNEL_LABEL[conversation.channel] ?? conversation.channel} · {fa(conversation.messageCount)} پیام</div></div><span className="text-zinc-400">{fmtDate(conversation.lastMessageAt ?? conversation.createdAt)}</span></Link>) : <p className="py-8 text-center text-xs text-zinc-400">گفتگویی ثبت نشده است</p>}</div></Card>
    </div>
  )
}
