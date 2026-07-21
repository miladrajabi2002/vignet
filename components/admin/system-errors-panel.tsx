import { Activity, AlertOctagon, AlertTriangle, Radar } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  AdminPagination,
  Card,
  EmptyState,
  FilterPills,
  LevelBadge,
  StatCard,
  fa,
  fmtDate,
} from '@/app/admin/(dash)/ui'
import { Sparkline } from '@/components/admin/sparkline'
import { BarList, TrendChart } from '@/components/admin/trend-chart'
import { errorsDaily, errorsDailyByLevel, errorsDailyBySource } from '@/lib/admin/charts'
import { getAdminHiddenWorkspaceIds } from '@/lib/admin/reporting-scope'
import { ClearErrorLogsButton } from '@/components/admin/clear-error-logs-button'

const PAGE_SIZE = 50

export async function SystemErrorsPanel({ level, page }: { level?: string; page?: string }) {
  const activeLevel = level === 'warn' || level === 'error' ? level : undefined
  const activePage = Math.max(1, Number(page) || 1)
  const hiddenWorkspaceIds = await getAdminHiddenWorkspaceIds()
  const reportingScope: Prisma.ErrorLogWhereInput = hiddenWorkspaceIds.length
    ? { OR: [{ workspaceId: null }, { workspaceId: { notIn: hiddenWorkspaceIds } }] }
    : {}
  const where: Prisma.ErrorLogWhereInput = activeLevel
    ? { AND: [reportingScope, { level: activeLevel }] }
    : reportingScope
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [errors, totalCount, allLogCount, errors24h, errTrend7, errTrend30, errorTrend7, sourceSparks] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (activePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: { id: true, level: true, source: true, message: true, stack: true, workspaceId: true, createdAt: true },
    }),
    prisma.errorLog.count({ where }),
    prisma.errorLog.count({ where: reportingScope }),
    prisma.errorLog.count({ where: { AND: [reportingScope, { createdAt: { gte: since24h }, level: 'error' }] } }),
    errorsDaily(7),
    errorsDaily(30),
    errorsDailyByLevel('error', 7),
    errorsDailyBySource(7),
  ])

  const hasNext = errors.length > PAGE_SIZE
  const items = hasNext ? errors.slice(0, PAGE_SIZE) : errors
  const weekTotal = errTrend7.reduce((sum, point) => sum + point.value, 0)
  const topSources = [...sourceSparks.values()].sort((a, b) => b.total - a.total).slice(0, 4)
  const topSource = topSources[0]
  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (activeLevel) params.set('errorLevel', activeLevel)
    if (nextPage > 1) params.set('errorPage', String(nextPage))
    const query = params.toString()
    return `${query ? `/admin/system?${query}` : '/admin/system'}#errors`
  }

  return (
    <section id="errors" className="scroll-mt-24 space-y-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-950">لاگ‌ها و خطاهای سیستم</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">بررسی رخدادها، منبع خطا و stack برای دیباگ مستقیم</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="overflow-x-auto">
            <FilterPills options={[
              { label: 'همه', href: '/admin/system#errors', active: !activeLevel },
              { label: 'خطا', href: '/admin/system?errorLevel=error#errors', active: activeLevel === 'error' },
              { label: 'هشدار', href: '/admin/system?errorLevel=warn#errors', active: activeLevel === 'warn' },
            ]} />
          </div>
          <ClearErrorLogsButton disabled={allLogCount === 0} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="کل رخدادها" value={fa(totalCount)} icon={<AlertOctagon className="h-5 w-5" />} series={errTrend30.map((point) => point.value)} />
        <StatCard label="خطاهای ۲۴ ساعت" value={fa(errors24h)} icon={<AlertTriangle className="h-5 w-5" />} series={errorTrend7.map((point) => point.value)} />
        <StatCard label="رخدادهای ۷ روز اخیر" value={fa(weekTotal)} icon={<Activity className="h-5 w-5" />} series={errTrend7.map((point) => point.value)} />
        <StatCard label="منبع پرتکرار" value={topSource?.source ?? 'بدون خطا'} sub={topSource ? `${fa(topSource.total)} رخداد در ۷ روز` : 'رخدادی ثبت نشده است'} icon={<Radar className="h-5 w-5" />} series={topSource?.series ?? []} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <TrendChart title="روند رخدادهای ۳۰ روز اخیر" subtitle={`${fa(weekTotal)} رخداد در ۷ روز اخیر`} data={errTrend30} color="#18181b" variant="area" height={230} />
        <BarList title="منابع پرتکرار خطا" subtitle="رتبه‌بندی بر اساس رخدادهای ۷ روز اخیر" data={topSources.map((source) => ({ label: source.source, value: source.total }))} color="#3f3f46" />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-8 w-8" />}>رخدادی ثبت نشده است</EmptyState>
      ) : (
        <Card pad={false} className="divide-y divide-zinc-100 overflow-hidden">
          {items.map((error) => {
            const spark = sourceSparks.get(error.source ?? 'unknown')
            return (
              <details key={error.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <LevelBadge level={error.level} />
                  <span className="text-xs text-zinc-500">{error.source ?? '—'}</span>
                  {spark && <span className="hidden sm:inline-block"><Sparkline data={spark.series} color="#18181b" width={64} height={20} /></span>}
                  <span className="ms-auto text-[11px] text-zinc-400">{fmtDate(error.createdAt)}</span>
                </summary>
                <p className="mt-2 text-sm text-zinc-700">{error.message}</p>
                {error.workspaceId && <p className="mt-1 text-xs text-zinc-400">workspace: {error.workspaceId}</p>}
                {error.stack && <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">{error.stack}</pre>}
              </details>
            )
          })}
        </Card>
      )}

      <AdminPagination page={activePage} hasNext={hasNext} makeHref={makeHref} />
    </section>
  )
}
