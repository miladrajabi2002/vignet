import { AlertTriangle, AlertOctagon, Activity } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  PageHeader,
  StatCard,
  Card,
  FilterPills,
  EmptyState,
  LevelBadge,
  AdminPagination,
  fa,
  fmtDate,
} from '../ui'
import { MiniTrend } from '@/components/admin/mini-trend'
import { Sparkline } from '@/components/admin/sparkline'
import { errorsDaily, errorsDailyBySource } from '@/lib/admin/charts'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminErrorsPage(
  props: {
    searchParams: Promise<{ level?: string; page?: string }>
  },
) {
  const searchParams = await props.searchParams
  const level =
    searchParams.level === 'warn' || searchParams.level === 'error'
      ? searchParams.level
      : undefined
  const page = Math.max(1, Number(searchParams.page) || 1)

  const where: Prisma.ErrorLogWhereInput = level ? { level } : {}
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since24hWhere = { createdAt: { gte: since24h } }

  const [
    errors,
    totalCount,
    errors24h,
    warns24h,
    errTrend7,
    sourceSparks,
  ] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        level: true,
        source: true,
        message: true,
        stack: true,
        workspaceId: true,
        createdAt: true,
      },
    }),
    prisma.errorLog.count({ where }),
    prisma.errorLog.count({ where: { ...since24hWhere, level: 'error' } }),
    prisma.errorLog.count({ where: { ...since24hWhere, level: 'warn' } }),
    errorsDaily(7),
    errorsDailyBySource(7),
  ])

  const hasNext = errors.length > PAGE_SIZE
  const items = hasNext ? errors.slice(0, PAGE_SIZE) : errors

  // 7-day totals.
  const weekTotal = errTrend7.reduce((s, p) => s + p.value, 0)
  // Top error sources by 7-day total — top 4.
  const topSources = [...sourceSparks.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    if (level) sp.set('level', level)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/admin/errors?${qs}` : '/admin/errors'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="خطاها"
        subtitle="لاگ خطاها و هشدارهای سیستم"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'خطاها' },
        ]}
        action={
          <FilterPills
            options={[
              { label: 'همه', href: '/admin/errors', active: !level },
              {
                label: 'خطا',
                href: '/admin/errors?level=error',
                active: level === 'error',
              },
              {
                label: 'هشدار',
                href: '/admin/errors?level=warn',
                active: level === 'warn',
              },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="کل خطاها"
          value={fa(totalCount)}
          icon={<AlertOctagon className="h-5 w-5" />}
          tone="danger"
        />
        <StatCard
          label="خطاهای ۲۴ ساعت"
          value={fa(errors24h)}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="هشدارهای ۲۴ ساعت"
          value={fa(warns24h)}
          icon={<Activity className="h-5 w-5" />}
          tone="info"
        />
      </div>

      {/* ─── Mini trends: 7-day error volume + top sources ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniTrend
          label="خطاهای ۷ روز اخیر"
          value={weekTotal}
          series={errTrend7.map((p) => p.value)}
          color="#ef4444"
          hint="میانگین روزانه" variant="light"
        />
        {topSources.map((s) => (
          <MiniTrend
            key={s.source}
            label={`منبع: ${s.source}`}
            value={s.total}
            series={s.series}
            color="#f59e0b"
            hint="۷ روز اخیر" variant="light"
          />
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-8 w-8" />}>
          خطایی ثبت نشده است
        </EmptyState>
      ) : (
        <Card pad={false} className="divide-y divide-zinc-100">
          {items.map((e) => {
            const spark = sourceSparks.get(e.source ?? 'unknown')
            return (
              <details key={e.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <LevelBadge level={e.level} />
                  <span className="text-xs text-zinc-500">{e.source ?? '—'}</span>
                  {spark && (
                    <span className="hidden sm:inline-block">
                      <Sparkline data={spark.series} color="#ef4444" width={64} height={20} />
                    </span>
                  )}
                  <span className="ms-auto text-[11px] text-zinc-400">
                    {fmtDate(e.createdAt)}
                  </span>
                </summary>
                <p className="mt-2 text-sm text-zinc-700">{e.message}</p>
                {e.workspaceId ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    workspace: {e.workspaceId}
                  </p>
                ) : null}
                {e.stack ? (
                  <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
                    {e.stack}
                  </pre>
                ) : null}
              </details>
            )
          })}
        </Card>
      )}

      <AdminPagination page={page} hasNext={hasNext} makeHref={makeHref} />
    </div>
  )
}
