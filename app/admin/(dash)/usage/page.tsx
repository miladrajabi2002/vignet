import { Gauge, ArrowDownToLine, ArrowUpFromLine, Coins, DollarSign } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { TrendChart, BarList } from '@/components/admin/trend-chart'
import { usageTokensDaily } from '@/lib/admin/charts'
import {
  PageHeader,
  StatCard,
  Panel,
  EmptyState,
  Progress,
  Badge,
  fa,
  fmtUSD,
} from '../ui'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  CHAT: 'چت',
  EMBEDDING: 'امبدینگ',
  TTS: 'تبدیل متن به گفتار',
  STT: 'تبدیل گفتار به متن',
}

export default async function AdminUsagePage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const where = { date: { gte: since } }

  const [totals, byType, byModel, callCount, tokenTrend] = await Promise.all([
    prisma.usageLog.aggregate({
      where,
      _sum: { promptTokens: true, completionTokens: true, cost: true },
    }),
    prisma.usageLog.groupBy({
      by: ['type'],
      where,
      _sum: { promptTokens: true, completionTokens: true },
      _count: { _all: true },
    }),
    prisma.usageLog.groupBy({
      by: ['model'],
      where,
      _sum: { promptTokens: true, completionTokens: true },
      _count: { _all: true },
      orderBy: { _count: { model: 'desc' } },
      take: 10,
    }),
    prisma.usageLog.count({ where }),
    usageTokensDaily(14),
  ])

  const totalPrompt = totals._sum.promptTokens ?? 0
  const totalCompletion = totals._sum.completionTokens ?? 0
  const totalTokens = totalPrompt + totalCompletion
  const totalCost = totals._sum.cost ?? 0

  const maxTypeTokens = Math.max(
    1,
    ...byType.map((r) => (r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0)),
  )

  const typeRows = byType
    .map((r) => ({
      type: r.type,
      label: TYPE_LABEL[r.type] ?? r.type,
      count: r._count._all,
      tokens: (r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0),
    }))
    .sort((a, b) => b.tokens - a.tokens)

  const modelRows = byModel
    .map((r) => ({
      label: r.model ?? 'نامشخص',
      value: (r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0),
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-6">
      <PageHeader
        title="مصرف و توکن"
        subtitle="آمار مصرف AI — ۳۰ روز اخیر"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'مصرف' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="کل درخواست‌ها"
          value={fa(callCount)}
          icon={<Gauge className="h-5 w-5" />}
          tone="default"
        />
        <StatCard
          label="توکن ورودی"
          value={fa(totalPrompt)}
          icon={<ArrowDownToLine className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="توکن خروجی"
          value={fa(totalCompletion)}
          icon={<ArrowUpFromLine className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="کل توکن"
          value={fa(totalTokens)}
          icon={<Coins className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="هزینه کل"
          value={fmtUSD(totalCost)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="default"
        />
      </div>

      <TrendChart
        title="مصرف توکن ۱۴ روز اخیر"
        subtitle="مجموع توکن ورودی و خروجی روزانه"
        data={tokenTrend}
        color="#a855f7"
        variant="area"
      />

      <Panel title="به تفکیک نوع" subtitle="سهم هر نوع درخواست از مصرف">
        {typeRows.length === 0 ? (
          <EmptyState>داده‌ای ثبت نشده است</EmptyState>
        ) : (
          <div className="divide-y divide-zinc-100">
            {typeRows.map((r) => (
              <div
                key={r.type}
                className="flex flex-wrap items-center gap-2 py-3"
              >
                <span className="w-32 shrink-0 text-sm font-medium text-zinc-900">
                  {r.label}
                </span>
                <Badge tone="muted">{fa(r.count)} درخواست</Badge>
                <span className="ms-auto w-24 shrink-0 text-end text-xs text-zinc-500">
                  {fa(r.tokens)} توکن
                </span>
                <div className="w-full">
                  <Progress value={r.tokens} max={maxTypeTokens} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <BarList
        title="به تفکیک مدل"
        subtitle="پرکاربردترین مدل‌ها بر اساس توکن"
        data={modelRows}
        color="#18181b"
        formatter={(v) => `${Number(v).toLocaleString('fa-IR')} توکن`}
      />
    </div>
  )
}
