import { Gauge, Wallet, DollarSign } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { TrendChart, BarList } from '@/components/admin/trend-chart'
import { usageChargesDaily } from '@/lib/admin/charts'
import { RangeSwitch, type RangeKind } from '@/components/admin/range-switch'
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
  SUMMARY: 'خلاصه‌سازی',
  LEARNING: 'یادگیری',
  VIGENTO_DRAFT: 'ساخت ایجنت با ویجنتو',
  VIGENTO_ASSISTANT: 'دستیار ویجنتو',
}

function parseRange(value?: string): RangeKind {
  if (value === '7d' || value === 'monthly') return value
  return '30d'
}

export default async function AdminUsagePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range)
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 365
  const rangeLabel = range === '7d' ? '۷ روز' : range === '30d' ? '۳۰ روز' : '۱۲ ماه'
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const where = { date: { gte: since } }

  const [totals, byType, byModel, callCount, chargeTrend] = await Promise.all([
    prisma.usageLog.aggregate({
      where,
      _sum: { chargedIRR: true, cost: true },
    }),
    prisma.usageLog.groupBy({
      by: ['type'],
      where,
      _sum: { chargedIRR: true },
      _count: { _all: true },
    }),
    prisma.usageLog.groupBy({
      by: ['model'],
      where,
      _sum: { chargedIRR: true },
      _count: { _all: true },
      orderBy: { _count: { model: 'desc' } },
      take: 10,
    }),
    prisma.usageLog.count({ where }),
    usageChargesDaily(days),
  ])

  const totalChargedIRR = totals._sum.chargedIRR ?? 0
  const totalCost = totals._sum.cost ?? 0

  const maxTypeCharge = Math.max(
    1,
    ...byType.map((r) => r._sum.chargedIRR ?? 0),
  )

  const typeRows = byType
    .map((r) => ({
      type: r.type,
      label: TYPE_LABEL[r.type] ?? r.type,
      count: r._count._all,
      chargeIRR: r._sum.chargedIRR ?? 0,
    }))
    .sort((a, b) => b.chargeIRR - a.chargeIRR)

  const modelRows = byModel
    .map((r) => ({
      label: r.model ?? 'نامشخص',
      value: Math.round((r._sum.chargedIRR ?? 0) / 10),
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-6">
      <PageHeader
        title="مصرف و هزینه AI"
        subtitle={`تصویر مالی درخواست‌های هوش مصنوعی در ${rangeLabel} اخیر`}
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'مصرف' },
        ]}
        action={<RangeSwitch current={range} basePath="/admin/usage" />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="کل درخواست‌ها"
          value={fa(callCount)}
          icon={<Gauge className="h-5 w-5" />}
          tone="default"
        />
         <StatCard
           label="مبلغ کسرشده"
           value={`${Math.round(totalChargedIRR / 10).toLocaleString('fa-IR')} تومان`}
           icon={<Wallet className="h-5 w-5" />}
           tone="success"
         />
        <StatCard
          label="هزینه کل"
          value={fmtUSD(totalCost)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="default"
        />
      </div>

      <TrendChart
         title={`مبلغ مصرف‌شده ${rangeLabel} اخیر`}
         subtitle="مجموع مبلغ کسرشده از اعتبار روزانه"
         data={chargeTrend.map((point) => ({ ...point, value: Math.round(point.value / 10) }))}
        color="#18181b"
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
                   {fa(Math.round(r.chargeIRR / 10))} تومان
                </span>
                <div className="w-full">
                   <Progress value={r.chargeIRR} max={maxTypeCharge} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <BarList
        title="به تفکیک مدل"
         subtitle="پرکاربردترین مدل‌ها بر اساس مبلغ مصرف‌شده"
        data={modelRows}
        color="#18181b"
         format="number"
      />
    </div>
  )
}
