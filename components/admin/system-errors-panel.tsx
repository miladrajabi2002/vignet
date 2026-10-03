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
import { CHART_ACCENT } from '@/components/admin/chart-palette'
import { errorsDaily, errorsDailyByLevel, errorsDailyBySource } from '@/lib/admin/charts'
import { getAdminHiddenWorkspaceIds } from '@/lib/admin/reporting-scope'
import { ClearErrorLogsButton } from '@/components/admin/clear-error-logs-button'
import { AdminFilterSheet } from '@/components/admin/admin-filter-sheet'

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
        { metadata: { path: ['smsAttemptId'], string_contains: activeQuery } },
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
  const levelOptions = [
    { label: 'همه', href: filterHref(), active: !activeLevel },
    { label: 'خطا', href: filterHref('error'), active: activeLevel === 'error' },
    { label: 'هشدار', href: filterHref('warn'), active: activeLevel === 'warn' },
    { label: 'اطلاعات', href: filterHref('info'), active: activeLevel === 'info' },
    { label: 'دیباگ', href: filterHref('debug'), active: activeLevel === 'debug' },
  ]

  return (
    <section id="errors" className="scroll-mt-24 space-y-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="ui-h3">لاگ‌ها و خطاهای سیستم</h2>
          <p className="ui-caption">بررسی رخدادها، منبع خطا و stack برای دیباگ مستقیم</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form action="/admin/system" method="get" className="flex min-w-0 flex-1 items-end gap-2 sm:flex-initial">
            <div className="min-w-0 flex-1 sm:w-72">
              <label htmlFor="error-log-search" className="ui-field-label">
                جست‌وجو در پیام، منبع یا workspace
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  id="error-log-search"
                  name="errorQuery"
                  defaultValue={activeQuery}
                  maxLength={200}
                  placeholder="مثلاً sms:activation یا attempt id"
                  className="input pe-3 ps-9 text-[13px]"
                />
              </div>
            </div>
            {activeLevel ? <input type="hidden" name="errorLevel" value={activeLevel} /> : null}
            <button type="submit" className="admin-primary-button shrink-0 text-[13px]">
              جست‌وجو
            </button>
          </form>
          <div className="hidden overflow-x-auto md:block">
            <FilterPills options={levelOptions} />
          </div>
          <div className="md:hidden">
            <AdminFilterSheet groups={[{ label: 'سطح رخداد', options: levelOptions }]} clearHref={filterHref()} activeCount={activeLevel ? 1 : 0} title="فیلتر سطح" />
          </div>
          <ClearErrorLogsButton disabled={allLogCount === 0} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard label="کل رخدادها" value={fa(totalCount)} icon={<AlertOctagon className="h-5 w-5" />} series={errTrend30.map((point) => point.value)} />
        <StatCard label="خطاهای ۲۴ ساعت" value={fa(errors24h)} tone={errors24h > 0 ? 'danger' : 'success'} icon={<AlertTriangle className="h-5 w-5" />} series={errorTrend7.map((point) => point.value)} />
        <StatCard label="رخدادهای ۷ روز اخیر" value={fa(weekTotal)} tone="info" icon={<Activity className="h-5 w-5" />} series={errTrend7.map((point) => point.value)} />
        <StatCard label="منبع پرتکرار" value={topSource?.source ?? 'بدون خطا'} sub={topSource ? `${fa(topSource.total)} رخداد در ۷ روز` : 'رخدادی ثبت نشده است'} tone={topSource ? 'warning' : 'success'} icon={<Radar className="h-5 w-5" />} series={topSource?.series ?? []} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart title="روند رخدادهای ۳۰ روز اخیر" subtitle={`${fa(weekTotal)} رخداد در ۷ روز اخیر`} data={errTrend30} variant="area" height={230} />
        <BarList title="منابع پرتکرار خطا" subtitle="رتبه‌بندی بر اساس رخدادهای ۷ روز اخیر" data={topSources.map((source) => ({ label: source.source, value: source.total }))} color={CHART_ACCENT} />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-8 w-8" />}>رخدادی ثبت نشده است</EmptyState>
      ) : (
        <Card pad={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
          {items.map((error) => {
            const spark = sourceSparks.get(error.source ?? 'unknown')
            return (
              <details key={error.id} className="group px-4 py-3 open:bg-[var(--bg-surface)]">
                <summary className="flex min-h-8 cursor-pointer list-none flex-wrap items-center gap-2">
                  <LevelBadge level={error.level} />
                  <span className="text-xs text-[var(--text-muted)]">{error.source ?? '—'}</span>
                  {spark && <span className="hidden sm:inline-block"><Sparkline data={spark.series} color="#111111" width={64} height={20} /></span>}
                  <span className="ms-auto text-[12px] text-[var(--text-muted)]">{fmtDate(error.createdAt)}</span>
                </summary>
                <p className="mt-2 break-words text-[13px] leading-6 text-[var(--text-primary)]">{error.message}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-[var(--text-muted)]" dir="ltr">
                  <span>event: {error.id}</span>
                  <time dateTime={error.createdAt.toISOString()}>{error.createdAt.toISOString()}</time>
                </div>
                {error.workspaceId && <p className="mt-1 text-xs text-[var(--text-muted)]">workspace: {error.workspaceId}</p>}
                {error.metadata && (
                  <div className="mt-2">
                    <p className="mb-1 text-[12px] font-semibold text-[var(--text-muted)]">متادیتای رخداد</p>
                    <pre dir="ltr" className="admin-scroll max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-control border border-[var(--border-subtle)] bg-white p-3 text-left text-xs leading-relaxed text-[var(--text-secondary)]">
                      {JSON.stringify(error.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                {error.stack && <pre dir="ltr" className="mt-2 max-h-60 overflow-auto rounded-control bg-[#111] p-3 text-left text-xs leading-relaxed text-white/75">{error.stack}</pre>}
              </details>
            )
          })}
        </Card>
      )}

      <AdminPagination page={activePage} hasNext={hasNext} makeHref={makeHref} />
    </section>
  )
}
