import { prisma } from '@/lib/prisma'
import { TrendChart } from '@/components/admin/trend-chart'
import { usageTokensDaily } from '@/lib/admin/charts'

export const dynamic = 'force-dynamic'

const fa = (n: number) => n.toLocaleString('fa-IR')

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">مصرف و درخواست‌ها</h1>
        <p className="mt-1 text-sm text-zinc-500">۳۰ روز اخیر</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="کل درخواست‌ها" value={fa(callCount)} />
        <Stat label="توکن ورودی" value={fa(totalPrompt)} />
        <Stat label="توکن خروجی" value={fa(totalCompletion)} />
        <Stat label="کل توکن" value={fa(totalPrompt + totalCompletion)} />
      </div>

      <TrendChart title="مصرف توکن ۱۴ روز اخیر" data={tokenTrend} color="#a78bfa" variant="area" />

      <Section title="به تفکیک نوع">
        {byType.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-zinc-800">
            {byType.map((r) => (
              <Row
                key={r.type}
                label={r.type}
                count={r._count._all}
                tokens={(r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="به تفکیک مدل (پرکاربردترین)">
        {byModel.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-zinc-800">
            {byModel.map((r) => (
              <Row
                key={r.model ?? 'unknown'}
                label={r.model ?? '—'}
                count={r._count._all}
                tokens={(r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <span className="text-xs text-zinc-500">{label}</span>
      <p className="mt-2 text-xl font-light text-zinc-100">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-2 text-sm font-medium text-zinc-300">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, count, tokens }: { label: string; count: number; tokens: number }) {
  return (
    <div className="flex items-center gap-2 py-2.5 text-sm">
      <span className="text-zinc-300">{label}</span>
      <span className="ms-auto text-xs text-zinc-500">{fa(count)} درخواست</span>
      <span className="w-28 text-end text-xs text-zinc-500">{fa(tokens)} توکن</span>
    </div>
  )
}

function Empty() {
  return <p className="py-6 text-center text-sm text-zinc-600">داده‌ای ثبت نشده</p>
}
