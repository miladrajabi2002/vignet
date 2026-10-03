import Link from 'next/link'
import { ArrowUpLeft, Bot, BrainCircuit, MessageSquare, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { conversationsDailyByAgent } from '@/lib/admin/charts'
import { Sparkline } from '@/components/admin/sparkline'
import { PageHeader, StatCard, Card, EmptyState, Toolbar, fa, fmtDate } from '../ui'
import { StatusChip } from '@/components/ui/status-chip'
import { CHART_ACCENT } from '@/components/admin/chart-palette'
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
            select: { conversations: { where: { deletedAt: null } }, channels: true, knowledgeBases: true },
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
    <div className="space-y-6">
      <PageHeader
        title="ایجنت‌ها"
        subtitle="عملکرد، دانش و وضعیت هر ایجنت هوش مصنوعی در یک نگاه"
        icon={Bot}
      />

      <Toolbar>
        <AdminUsersSearchForm defaultQuery={q} placeholder="جستجوی نام ایجنت یا کسب‌وکار…" ariaLabel="جستجوی ایجنت‌ها" basePath="/admin/agents" />
      </Toolbar>

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard label="کل ایجنت‌ها" value={fa(totalAgents)} icon={<Bot className="h-5 w-5" />} />
        <StatCard label="ایجنت فعال" value={fa(activeAgents)} icon={<Sparkles className="h-5 w-5" />} tone="success" />
        <StatCard label="گفتگو در ۷ روز" value={fa(conversations7d)} icon={<MessageSquare className="h-5 w-5" />} tone="info" />
        <StatCard label="منبع دانش آماده" value={fa(readyKnowledge)} icon={<BrainCircuit className="h-5 w-5" />} />
      </div>

      {agents.length === 0 ? (
        <EmptyState icon={<Bot className="h-8 w-8" />}>{q ? `ایجنتی برای «${q}» پیدا نشد` : 'ایجنتی ساخته نشده است'}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {agents.map((agent) => {
            const trend = trends.get(agent.id)?.series ?? new Array(7).fill(0)
            return (
              <Link key={agent.id} href={`/admin/agents/${agent.id}`} className="group rounded-card outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
                <Card className="h-full space-y-4 transition-[border-color,box-shadow] duration-200 group-hover:border-[var(--border-hover)] group-hover:shadow-[var(--elev-2)]">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-[#111] text-white">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-bold text-[var(--text-primary)]">{agent.name}</h2>
                        <StatusChip tone={agent.active ? 'ok' : 'neutral'} dot className="shrink-0">{agent.active ? 'فعال' : 'غیرفعال'}</StatusChip>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{agent.workspace.name}</p>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 shrink-0 text-[var(--text-hint)] transition-colors group-hover:text-[var(--signal)]" aria-hidden />
                  </div>

                  <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--border-subtle)] rounded-control bg-[var(--bg-surface)] py-3 text-center">
                    <div><dd className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{fa(agent._count.conversations)}</dd><dt className="mt-1 text-[12px] text-[var(--text-muted)]">کل گفتگو</dt></div>
                    <div><dd className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{fa(agent._count.knowledgeBases)}</dd><dt className="mt-1 text-[12px] text-[var(--text-muted)]">منبع دانش</dt></div>
                    <div><dd className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{fa(agent._count.channels)}</dd><dt className="mt-1 text-[12px] text-[var(--text-muted)]">اتصال</dt></div>
                  </dl>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[12px] text-[var(--text-muted)]">روند ۷ روز اخیر</p>
                      <Sparkline data={trend} color={CHART_ACCENT} width={126} height={30} />
                    </div>
                    <div className="min-w-0 text-end text-[12px] leading-5 text-[var(--text-muted)]">
                      <div dir="auto" className="truncate">{agent.model || 'مدل پیش‌فرض'}</div>
                      <div>به‌روزرسانی {fmtDate(agent.updatedAt)}</div>
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
