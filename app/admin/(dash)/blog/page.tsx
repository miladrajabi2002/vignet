import { FileText, CheckCircle2, PencilLine, Eye } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminBlogManager } from '@/components/blog/admin-blog-manager'
import { TrendChart } from '@/components/admin/trend-chart'
import { CHART_ACCENT } from '@/components/admin/chart-palette'
import { getLocale } from 'next-intl/server'
import { PageHeader, StatCard, Card, Panel, fa } from '../ui'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'
import { lastNTehranDayKeys } from '@/lib/blog/daily-views'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  // Last 7 Tehran calendar days (oldest → newest) as UTC-midnight keys.
  const dayKeys = lastNTehranDayKeys(7)

  const [
    posts,
    categories,
    totalPosts,
    publishedCount,
    draftCount,
    viewsAgg,
    topPostsByViews,
    dailyViewsRaw,
  ] = await Promise.all([
    prisma.blogPost.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        category: { select: { name: true, slug: true } },
        workspace: { select: { id: true, name: true } },
      },
      take: 200,
    }),
    prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
    prisma.blogPost.count({ where: { status: 'DRAFT' } }),
    prisma.blogPost.aggregate({ _sum: { views: true } }),
    // Top 5 most-viewed published posts for the BarList.
    prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { views: 'desc' },
      take: 5,
      select: { title: true, views: true },
    }),
    // Real page views per day over the last 7 days (beacon-aggregated).
    prisma.blogPostDailyView.groupBy({
      by: ['day'],
      where: { day: { gte: dayKeys[0] } },
      _sum: { count: true },
    }),
  ])

  const totalViews = viewsAgg._sum.views ?? 0

  // Map the grouped rows onto the fixed 7-day window (oldest → newest).
  const viewsByDay = new Map<string, number>()
  for (const row of dailyViewsRaw) {
    viewsByDay.set(row.day.toISOString().slice(0, 10), row._sum.count ?? 0)
  }
  const dayStrings = dayKeys.map((d) => d.toISOString().slice(0, 10))
  const series = dayStrings.map((day) => viewsByDay.get(day) ?? 0)
  const weekViewsTotal = series.reduce((a, b) => a + b, 0)

  // Best day of the window — "which day got the most views, and how much".
  const bestIdx = series.reduce((best, v, i) => (v > series[best] ? i : best), 0)
  const bestDayFmt = new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const viewsSubtitle =
    weekViewsTotal === 0
      ? 'هنوز بازدیدی در ۷ روز اخیر ثبت نشده است'
      : `مجموع ${fa(weekViewsTotal)} بازدید · بیشترین: ${bestDayFmt.format(dayKeys[bestIdx])} با ${fa(series[bestIdx])} بازدید`

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت بلاگ"
        subtitle="مدیریت مقالات، دسته‌بندی‌ها و انتشار"
        icon={FileText}
      />

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard
          label="کل مقالات"
          value={fa(totalPosts)}
          icon={<FileText className="h-5 w-5" />}
          tone="default"
        />
        <StatCard
          label="منتشر شده"
          value={fa(publishedCount)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="پیش‌نویس"
          value={fa(draftCount)}
          icon={<PencilLine className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="کل بازدید"
          value={fa(totalViews)}
          icon={<Eye className="h-5 w-5" />}
          tone="info"
        />
      </div>

      {/* ─── Compact charts: 7-day real views + top viewed posts ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="بازدید ۷ روز اخیر"
          subtitle={viewsSubtitle}
          data={dayStrings.map((day, i) => ({ day, value: series[i] }))}
          color={CHART_ACCENT}
          variant="bar"
          height={200}
        />
        <Panel title="پربازدیدترین مقالات">
          {topPostsByViews.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--text-muted)]">
              پست منتشرشده‌ای وجود ندارد
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {topPostsByViews.map((p, i) => (
                <li key={i} className="flex min-h-10 items-center gap-2.5 py-1.5 text-[13px]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-chip bg-[var(--bg-muted)] text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {fa(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{p.title}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                    {fa(p.views)}
                  </span>
                  <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Card pad={false} className="overflow-hidden">
        <AdminBlogManager
          initialPosts={posts.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            status: p.status,
            views: p.views,
            featured: p.featured,
            workspace: p.workspace,
            category: p.category,
            updatedAt: p.updatedAt.toISOString(),
            publishedAt: p.publishedAt?.toISOString() ?? null,
            excerpt: p.excerpt,
            content: p.content,
            coverImage: p.coverImage,
            categoryId: p.categoryId,
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            seoKeywords: p.seoKeywords,
            canonicalUrl: p.canonicalUrl,
            ogImage: p.ogImage,
          }))}
          initialCategories={categories}
          locale={locale}
        />
      </Card>
    </div>
  )
}
