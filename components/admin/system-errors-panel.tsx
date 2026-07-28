import { Activity, AlertOctagon, AlertTriangle, Radar, Search } from 'lucide-react'
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

export async function SystemErrorsPanel({ level, page, query }: { level?: string; page?: string; query?: string }) {
  const activeLevel = ['debug', 'info', 'warn', 'error'].includes(level ?? '') ? level : undefined
  const activeQuery = query?.trim().slice(0, 200) ?? ''
  const activePage = Math.max(1, Number(page) || 1)
  const hiddenWorkspaceIds = await getAdminHiddenWorkspaceIds()
  const reportingScope: Prisma.ErrorLogWhereInput = hiddenWorkspaceIds.length
    ? { OR: [{ workspaceId: null }, { workspaceId: { notIn: hiddenWorkspaceIds } }] }
    : {}
  const filters: Prisma.ErrorLogWhereInput[] = [reportingScope]
  if (activeLevel) filters.push({ level: activeLevel })
  if (activeQuery) {
    filters.push({
      OR: [
        { source: { contains: activeQuery, mode: 'insensitive' } },
        { message: { contains: activeQuery, mode: 'insensitive' } },
        { workspaceId: { contains: activeQuery, mode: 'insensitive' } },
        { metadata: { path: ['requestId'], string_contains: activeQuery } },
        { metadata: { path: ['phone'], string_contains: activeQuery } },
        { metadata: { path: ['otpCode'], string_contains: activeQuery } },
      ],
    })
  }
  const where: Prisma.ErrorLogWhereInput = { AND: filters }
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [errors, totalCount, allLogCount, errors24h, errTrend7, errTrend30, errorTrend7, sourceSparks] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (activePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: { id: true, level: true, source: true, message: true, stack: true, workspaceId: true, metadata: true, createdAt: true },
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
    if (activeQuery) params.set('errorQuery', activeQuery)
    if (nextPage > 1) params.set('errorPage', String(nextPage))
    const query = params.toString()
    return `${query ? `/admin/system?${query}` : '/admin/system'}#errors`
  }
  const filterHref = (nextLevel?: string) => {
    const params = new URLSearchParams()
    if (nextLevel) params.set('errorLevel', nextLevel)
    if (activeQuery) params.set('errorQuery', activeQuery)
    const value = params.toString()
    return `${value ? `/admin/system?${value}` : '/admin/system'}#errors`
  }

  return (
    <section id="errors" className="scroll-mt-24 space-y-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-950">لاگ‌ها و خطاهای سیستم</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">بررسی رخدادها، منبع خطا و stack برای دیباگ مستقیم</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form action="/admin/system" method="get" className="flex min-w-0 flex-1 items-end gap-2 sm:flex-initial">
            <div className="min-w-0 flex-1 sm:w-72">
              <label htmlFor="error-log-search" className="mb-1 block text-[11px] font-medium text-zinc-600">
                جست‌وجو در پیام، منبع یا workspace
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  id="error-log-search"
                  name="errorQuery"
                  defaultValue={activeQuery}
                  maxLength={200}
                  placeholder="مثلاً auth:otp یا request id"
                  className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pe-3 ps-9 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </div>
            {activeLevel ? <input type="hidden" name="errorLevel" value={activeLevel} /> : null}
            <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2">
              جست‌وجو
            </button>
          </form>
          <div className="overflow-x-auto">
            <FilterPills options={[
              { label: 'همه', href: filterHref(), active: !activeLevel },
              { label: 'خطا', href: filterHref('error'), active: activeLevel === 'error' },
              { label: 'هشدار', href: filterHref('warn'), active: activeLevel === 'warn' },
              { label: 'اطلاعات', href: filterHref('info'), active: activeLevel === 'info' },
              { label: 'دیباگ', href: filterHref('debug'), active: activeLevel === 'debug' },
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
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-500" dir="ltr">
                  <span>event: {error.id}</span>
                  <time dateTime={error.createdAt.toISOString()}>{error.createdAt.toISOString()}</time>
                </div>
                {error.workspaceId && <p className="mt-1 text-xs text-zinc-400">workspace: {error.workspaceId}</p>}
                {error.metadata && (
                  <div className="mt-2">
                    <p className="mb-1 text-[11px] font-semibold text-zinc-500">متادیتای رخداد</p>
                    <pre dir="ltr" className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                      {JSON.stringify(error.metadata, null, 2)}
                    </pre>
                  </div>
                )}
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
