import Link from 'next/link'
import { ArrowUpLeft, Bot, BrainCircuit, MessageSquare, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { conversationsDailyByAgent } from '@/lib/admin/charts'
import { Sparkline } from '@/components/admin/sparkline'
import { PageHeader, StatCard, Card, Badge, EmptyState, fa, fmtDate } from '../ui'
import {
  ADMIN_VISIBLE_KNOWLEDGE_WHERE,
  ADMIN_VISIBLE_RELATED_WHERE,
} from '@/lib/admin/reporting-scope'
import { AdminUsersSearchForm } from '@/components/admin/admin-users-search-form'

export const dynamic = 'force-dynamic'

export default async function AdminAgentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? ''
  const since = new Date(Date.now() - 7 * 86_400_000)
  const [agents, totalAgents, activeAgents, conversations7d, readyKnowledge, trends] =
    await Promise.all([
      prisma.agent.findMany({
        where: {
          ...ADMIN_VISIBLE_RELATED_WHERE,
          ...(q ? { OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { workspace: { name: { contains: q, mode: 'insensitive' } } },
          ] } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          model: true,
          updatedAt: true,
          workspace: { select: { name: true } },
          _count: {
            select: { conversations: true, channels: true, knowledgeBases: true },
          },
        },
      }),
      prisma.agent.count({ where: ADMIN_VISIBLE_RELATED_WHERE }),
      prisma.agent.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, active: true } }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: since } } }),
      prisma.knowledgeBase.count({ where: { ...ADMIN_VISIBLE_KNOWLEDGE_WHERE, status: 'READY' } }),
      conversationsDailyByAgent(7),
    ])

  return (
    <div className="space-y-5">
      <PageHeader
        title="ایجنت‌ها"
        subtitle="عملکرد، دانش و وضعیت هر ایجنت هوش مصنوعی در یک نگاه"
      />

      <div className="sticky top-20 z-20 rounded-2xl border border-black/[0.07] bg-white/90 p-2 shadow-[var(--shadow-soft)] backdrop-blur-xl md:static md:bg-white/72">
        <AdminUsersSearchForm defaultQuery={q} placeholder="جستجوی نام ایجنت یا کسب‌وکار…" ariaLabel="جستجوی ایجنت‌ها" basePath="/admin/agents" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کل ایجنت‌ها" value={fa(totalAgents)} icon={<Bot className="h-5 w-5" />} />
        <StatCard label="ایجنت فعال" value={fa(activeAgents)} icon={<Sparkles className="h-5 w-5" />} />
        <StatCard label="گفتگو در ۷ روز" value={fa(conversations7d)} icon={<MessageSquare className="h-5 w-5" />} />
        <StatCard label="منبع دانش آماده" value={fa(readyKnowledge)} icon={<BrainCircuit className="h-5 w-5" />} />
      </div>

      {agents.length === 0 ? (
        <EmptyState icon={<Bot className="h-8 w-8" />}>{q ? `ایجنتی برای «${q}» پیدا نشد` : 'ایجنتی ساخته نشده است'}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {agents.map((agent) => {
            const trend = trends.get(agent.id)?.series ?? new Array(7).fill(0)
            return (
              <Link key={agent.id} href={`/admin/agents/${agent.id}`} className="group outline-none">
                <Card className="relative h-full overflow-hidden p-0 transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-black/20 group-hover:shadow-lg group-hover:shadow-black/[0.04] group-focus-visible:ring-2 group-focus-visible:ring-black/25">
                  <div className="absolute left-0 top-0 h-24 w-24 rounded-full bg-black/[0.035] blur-2xl transition-transform duration-500 group-hover:scale-150" />
                  <div className="relative space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white">
                        <Bot className="h-5 w-5" />
                        {agent.active && <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-500 motion-safe:animate-pulse" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-bold text-zinc-950">{agent.name}</h2>
                          <Badge tone="muted">{agent.active ? 'فعال' : 'غیرفعال'}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{agent.workspace.name}</p>
                      </div>
                      <ArrowUpLeft className="h-4 w-4 text-zinc-400 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>

                    <p className="line-clamp-2 min-h-10 text-xs leading-5 text-zinc-600">
                      {agent.description || 'برای این ایجنت هنوز توضیحی ثبت نشده است.'}
                    </p>

                    <div className="grid grid-cols-3 divide-x divide-x-reverse divide-zinc-100 rounded-2xl border border-zinc-100 bg-zinc-50/70 py-3 text-center">
                      <div><div className="text-sm font-bold text-zinc-900">{fa(agent._count.conversations)}</div><div className="mt-1 text-[10px] text-zinc-500">کل گفتگو</div></div>
                      <div><div className="text-sm font-bold text-zinc-900">{fa(agent._count.knowledgeBases)}</div><div className="mt-1 text-[10px] text-zinc-500">منبع دانش</div></div>
                      <div><div className="text-sm font-bold text-zinc-900">{fa(agent._count.channels)}</div><div className="mt-1 text-[10px] text-zinc-500">اتصال</div></div>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-400">روند ۷ روز اخیر</p>
                        <Sparkline data={trend} color="#18181b" width={126} height={30} />
                      </div>
                      <div className="text-left text-[10px] leading-5 text-zinc-400">
                        <div>{agent.model || 'مدل پیش‌فرض'}</div>
                        <div>به‌روزرسانی {fmtDate(agent.updatedAt)}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
