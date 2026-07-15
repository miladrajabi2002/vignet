import { Bot, Cpu, Plug, MessageSquare, TriangleAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  EmptyState,
  fa,
  fmtDate,
} from '../ui'

export const dynamic = 'force-dynamic'

const SILENT_AFTER_MS = 48 * 60 * 60 * 1000 // a channel silent >48h is suspect

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

type Health = { dot: string; label: string }

function channelHealth(active: boolean, lastInboundAt: Date | null): Health {
  if (!active) return { dot: 'bg-zinc-300', label: 'غیرفعال' }
  if (!lastInboundAt)
    return { dot: 'bg-amber-500', label: 'بدون پیام' }
  const silent = Date.now() - lastInboundAt.getTime() > SILENT_AFTER_MS
  return silent
    ? { dot: 'bg-amber-500', label: 'سکوت >۴۸ ساعت' }
    : { dot: 'bg-emerald-500', label: 'سالم' }
}

export default async function AdminAgentsPage() {
  const silentSince = new Date(Date.now() - SILENT_AFTER_MS)
  const [agents, totalAgents, activeAgents, channelCount, activeChannelCount, silentChannelCount] = await Promise.all([
    prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        active: true,
        createdAt: true,
        workspace: { select: { name: true } },
        _count: { select: { conversations: true } },
        channels: {
          select: { id: true, type: true, active: true, lastInboundAt: true },
        },
      },
    }),
    prisma.agent.count(),
    prisma.agent.count({ where: { active: true } }),
    prisma.agentChannel.count(),
    prisma.agentChannel.count({ where: { active: true } }),
    prisma.agentChannel.count({
      where: {
        active: true,
        OR: [
          { lastInboundAt: { lt: silentSince } },
          { lastInboundAt: null, createdAt: { lt: silentSince } },
        ],
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="ایجنت‌ها و کانال‌ها"
        subtitle="وضعیت ایجنت‌ها و کانال‌های متصل"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'ایجنت‌ها' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="کل ایجنت‌ها"
          value={fa(totalAgents)}
          icon={<Bot className="h-5 w-5" />}
          tone="default"
        />
        <StatCard
          label="ایجنت‌های فعال"
          value={fa(activeAgents)}
          icon={<Cpu className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="کانال‌های فعال"
          value={`${fa(activeChannelCount)} / ${fa(channelCount)}`}
          icon={<Plug className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="کانال نیازمند بررسی"
          value={fa(silentChannelCount)}
          sub="فعال اما بدون ورودی بیش از ۴۸ ساعت"
          icon={<TriangleAlert className="h-5 w-5" />}
          tone={silentChannelCount > 0 ? 'warning' : 'success'}
        />
      </div>

      {agents.length === 0 ? (
        <EmptyState icon={<Bot className="h-8 w-8" />}>
          ایجنتی ساخته نشده است
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  {a.name}
                </span>
                <span className="text-xs text-zinc-500">
                  · {a.workspace.name}
                </span>
                <Badge tone={a.active ? 'success' : 'muted'}>
                  {a.active ? 'فعال' : 'غیرفعال'}
                </Badge>
                <span className="ms-auto inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {fa(a._count.conversations)} مکالمه
                </span>
              </div>

              {a.channels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {a.channels.map((ch) => {
                    const health = channelHealth(ch.active, ch.lastInboundAt)
                    return (
                      <span
                        key={ch.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600"
                        title={health.label}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                        {CHANNEL_LABEL[ch.type] ?? ch.type}
                        <span className="text-[11px] text-zinc-400">
                          {ch.lastInboundAt ? fmtDate(ch.lastInboundAt) : 'بدون پیام'}
                        </span>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">بدون کانال متصل</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
