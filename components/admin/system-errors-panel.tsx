import Link from 'next/link'
import { Activity, AlertOctagon, AlertTriangle, ChevronDown, Radar } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  AdminPagination,
  Card,
  EmptyState,
  FilterPills,
  LevelBadge,
  StatCard,
  Toolbar,
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
import { AdminUsersSearchForm } from '@/components/admin/admin-users-search-form'

const PAGE_SIZE = 50

export async function SystemErrorsPanel({ level, page, query }: { level?: string; page?: string; query?: string }) {
  const activeLevel = ['debug', 'info', 'warn', 'error'].includes(level ?? '') ? level : undefined
  const activeQuery = query?.trim().slice(0, 200) ?? ''
  const activePage = Math.max(1, Number(page) || 1)
  const hiddenWorkspaceIds = await getAdminHiddenWorkspaceIds()
  const reportingScope: Prisma.ErrorLogWhereInput = hiddenWorkspaceIds.length
    ? { OR: [{ workspaceId: null }, { workspaceId: { notIn: hiddenWorkspaceIds } }] }
    : {}
  // Scope + search, without the level: the level pills show a count each.
  const searchFilters: Prisma.ErrorLogWhereInput[] = [reportingScope]
  if (activeQuery) {
    searchFilters.push({
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
  const where: Prisma.ErrorLogWhereInput = { AND: activeLevel ? [...searchFilters, { level: activeLevel }] : searchFilters }
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [errors, levelCounts, allLogCount, errors24h, errTrend7, errTrend30, errorTrend7, sourceSparks] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (activePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: { id: true, level: true, source: true, message: true, stack: true, workspaceId: true, metadata: true, createdAt: true },
    }),
    prisma.errorLog.groupBy({ by: ['level'], where: { AND: searchFilters }, _count: { _all: true } }),
    prisma.errorLog.count({ where: reportingScope }),
    prisma.errorLog.count({ where: { AND: [reportingScope, { createdAt: { gte: since24h }, level: 'error' }] } }),
    errorsDaily(7),
    errorsDaily(30),
    errorsDailyByLevel('error', 7),
    errorsDailyBySource(7),
  ])

  const hasNext = errors.length > PAGE_SIZE
  const items = hasNext ? errors.slice(0, PAGE_SIZE) : errors
  const countByLevel = new Map(levelCounts.map((row) => [row.level, row._count._all]))
  const searchCount = levelCounts.reduce((sum, row) => sum + row._count._all, 0)
  const matchCount = activeLevel ? (countByLevel.get(activeLevel) ?? 0) : searchCount
  const isFiltered = Boolean(activeLevel || activeQuery)
  const weekTotal = errTrend7.reduce((sum, point) => sum + point.value, 0)
  const topSources = [...sourceSparks.values()].sort((a, b) => b.total - a.total).slice(0, 4)
  const topSource = topSources[0]
  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (activeLevel) params.set('errorLevel', activeLevel)
    if (activeQuery) params.set('errorQuery', activeQuery)
    if (nextPage > 1) params.set('errorPage', String(nextPage))
    const query = params.toString()
    return `${query ? `/admin/system?${query}` : '/admin/system'}#error-list`
  }
  const filterHref = (nextLevel?: string) => {
    const params = new URLSearchParams()
    if (nextLevel) params.set('errorLevel', nextLevel)
    if (activeQuery) params.set('errorQuery', activeQuery)
    const value = params.toString()
    return `${value ? `/admin/system?${value}` : '/admin/system'}#error-list`
  }
  const levelOptions = [
    { label: `همه · ${fa(searchCount)}`, href: filterHref(), active: !activeLevel },
    ...([['error', 'خطا'], ['warn', 'هشدار'], ['info', 'اطلاعات'], ['debug', 'دیباگ']] as const).map(([value, label]) => ({
      label: `${label} · ${fa(countByLevel.get(value) ?? 0)}`,
      href: filterHref(value),
      active: activeLevel === value,
    })),
  ]

  return (
    <section id="errors" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[14rem]">
          <h2 className="ui-h3">لاگ‌ها و خطاهای سیستم</h2>
          <p className="ui-caption">بررسی رخدادها، منبع خطا و stack برای دیباگ مستقیم</p>
        </div>
        <ClearErrorLogsButton disabled={allLogCount === 0} />
      </div>

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard label="کل رخدادها" value={fa(allLogCount)} icon={<AlertOctagon className="h-5 w-5" />} series={errTrend30.map((point) => point.value)} />
        <StatCard label="خطاهای ۲۴ ساعت" value={fa(errors24h)} tone={errors24h > 0 ? 'danger' : 'success'} icon={<AlertTriangle className="h-5 w-5" />} series={errorTrend7.map((point) => point.value)} />
        <StatCard label="رخدادهای ۷ روز اخیر" value={fa(weekTotal)} tone="info" icon={<Activity className="h-5 w-5" />} series={errTrend7.map((point) => point.value)} />
        <StatCard label="منبع پرتکرار" value={topSource?.source ?? 'بدون خطا'} sub={topSource ? `${fa(topSource.total)} رخداد در ۷ روز` : 'رخدادی ثبت نشده است'} tone={topSource ? 'warning' : 'success'} icon={<Radar className="h-5 w-5" />} series={topSource?.series ?? []} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart title="روند رخدادهای ۳۰ روز اخیر" subtitle={`${fa(weekTotal)} رخداد در ۷ روز اخیر`} data={errTrend30} variant="area" height={230} />
        <BarList title="منابع پرتکرار خطا" subtitle="رتبه‌بندی بر اساس رخدادهای ۷ روز اخیر" data={topSources.map((source) => ({ label: source.source, value: source.total }))} color={CHART_ACCENT} />
      </div>

      {/* Search and level sit directly on the list they filter; the links
          above land here, not on the charts. */}
      <div id="error-list" className="scroll-mt-24 space-y-3">
        <Toolbar className="flex-wrap">
          <AdminUsersSearchForm
            defaultQuery={activeQuery}
            placeholder="جستجو در پیام، منبع، workspace یا شناسه…"
            ariaLabel="جستجوی لاگ‌ها"
            basePath="/admin/system"
            queryParam="errorQuery"
            pageParam="errorPage"
          />
          <div className="admin-scroll hidden max-w-full overflow-x-auto md:block">
            <FilterPills options={levelOptions} />
          </div>
          <div className="md:hidden">
            <AdminFilterSheet groups={[{ label: 'سطح رخداد', options: levelOptions }]} clearHref={filterHref()} activeCount={activeLevel ? 1 : 0} title="فیلتر سطح" description="سطح رخداد را انتخاب کنید" />
          </div>
        </Toolbar>

        <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[12px] text-[var(--text-muted)]">
          <span>{fa(matchCount)} رخداد{isFiltered ? ' با این فیلتر' : ''}</span>
          {isFiltered && <Link href="/admin/system#error-list" className="ui-link !text-[12px]">حذف فیلترها</Link>}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-8 w-8" />}>{isFiltered ? 'رخدادی با این جستجو یا سطح پیدا نشد' : 'رخدادی ثبت نشده است'}</EmptyState>
        ) : (
          <Card pad={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
            {items.map((error) => {
              const spark = sourceSparks.get(error.source ?? 'unknown')
              return (
                <details key={error.id} className="group open:bg-[var(--bg-surface)]">
                  {/* The message is in the summary so the list can be scanned
                      without opening every row. */}
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <LevelBadge level={error.level} />
                        <span dir="ltr" className="min-w-0 truncate text-[12px] font-medium text-[var(--text-secondary)]">{error.source ?? '—'}</span>
                        {spark && <span className="hidden lg:inline-block"><Sparkline data={spark.series} color="#111111" width={64} height={20} /></span>}
                        <span className="ms-auto shrink-0 text-[12px] text-[var(--text-muted)]">{fmtDate(error.createdAt)}</span>
                      </div>
                      <p dir="auto" className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-[var(--text-primary)] [overflow-wrap:anywhere] group-open:line-clamp-none">{error.message}</p>
                    </div>
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                  </summary>
                  <div className="space-y-2 px-4 pb-4">
                    <div className="flex flex-col gap-x-4 gap-y-1 font-mono text-[12px] text-[var(--text-muted)] [overflow-wrap:anywhere] sm:flex-row sm:flex-wrap" dir="ltr">
                      <span>event: {error.id}</span>
                      <time dateTime={error.createdAt.toISOString()}>{error.createdAt.toISOString()}</time>
                      {error.workspaceId && <span>workspace: {error.workspaceId}</span>}
                    </div>
                    {error.metadata && (
                      <div>
                        <p className="mb-1 text-[12px] font-semibold text-[var(--text-muted)]">متادیتای رخداد</p>
                        <pre dir="ltr" className="admin-scroll max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-control border border-[var(--border-subtle)] bg-white p-3 text-left text-xs leading-relaxed text-[var(--text-secondary)]">
                          {JSON.stringify(error.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    {error.stack && <pre dir="ltr" className="admin-scroll max-h-60 overflow-auto rounded-control bg-[#111] p-3 text-left text-xs leading-relaxed text-white/75">{error.stack}</pre>}
                  </div>
                </details>
              )
            })}
          </Card>
        )}

        <AdminPagination page={activePage} hasNext={hasNext} makeHref={makeHref} />
      </div>
    </section>
  )
}
