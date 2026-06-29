import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Building2,
  Bot,
  MessagesSquare,
  AlertTriangle,
} from 'lucide-react'
import { LevelBadge, fmtDate } from './ui'
import { TrendChart } from '@/components/admin/trend-chart'
import { conversationsDaily, errorsDaily } from '@/lib/admin/charts'

export const dynamic = 'force-dynamic'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminOverviewPage() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    workspaceCount,
    activeAgents,
    conversationsToday,
    errors24h,
    recentErrors,
    recentConversations,
    convTrend,
    errTrend,
  ] = await Promise.all([
    prisma.workspace.count(),
    prisma.agent.count({ where: { active: true } }),
    prisma.conversation.count({ where: { createdAt: { gte: startOfToday() } } }),
    prisma.errorLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, source: true, message: true, level: true, createdAt: true },
    }),
    prisma.conversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        channel: true,
        createdAt: true,
        agent: { select: { name: true } },
        workspace: { select: { name: true } },
      },
    }),
    conversationsDaily(14),
    errorsDaily(14),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light">نمای کلی</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="کسب‌وکارها" value={workspaceCount} icon={<Building2 className="h-4 w-4" />} />
        <Stat label="ایجنت‌های فعال" value={activeAgents} icon={<Bot className="h-4 w-4" />} />
        <Stat
          label="مکالمات امروز"
          value={conversationsToday}
          icon={<MessagesSquare className="h-4 w-4" />}
        />
        <Stat
          label="خطاهای ۲۴ ساعت"
          value={errors24h}
          tone={errors24h > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="مکالمات ۱۴ روز اخیر" data={convTrend} color="#34d399" />
        <TrendChart title="خطاهای ۱۴ روز اخیر" data={errTrend} color="#f87171" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="آخرین خطاها" href="/admin/errors" linkLabel="همه خطاها">
          {recentErrors.length === 0 ? (
            <Empty>خطایی ثبت نشده</Empty>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {recentErrors.map((e) => (
                <li key={e.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <LevelBadge level={e.level} />
                    <span className="text-xs text-zinc-500">{e.source ?? '—'}</span>
                    <span className="ms-auto text-[11px] text-zinc-600">
                      {fmtDate(e.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-300">{e.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="آخرین مکالمات" href="/admin/conversations" linkLabel="همه مکالمات">
          {recentConversations.length === 0 ? (
            <Empty>مکالمه‌ای نیست</Empty>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {recentConversations.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2.5">
                  <span className="text-sm text-zinc-300">{c.agent.name}</span>
                  <span className="text-xs text-zinc-500">· {c.workspace.name}</span>
                  <span className="ms-auto text-[11px] text-zinc-600">{fmtDate(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-light ${
          tone === 'danger' && value > 0 ? 'text-red-400' : 'text-zinc-100'
        }`}
      >
        {value.toLocaleString('fa-IR')}
      </p>
    </div>
  )
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string
  href: string
  linkLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        <Link href={href} className="text-xs text-emerald-400 hover:underline">
          {linkLabel}
        </Link>
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-zinc-600">{children}</p>
}
