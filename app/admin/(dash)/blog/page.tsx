import { FileText, CheckCircle2, PencilLine, Eye } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminBlogManager } from '@/components/blog/admin-blog-manager'
import { MiniTrend } from '@/components/admin/mini-trend'
import { getLocale } from 'next-intl/server'
import { PageHeader, StatCard, Card, Panel, fa } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const since7d = new Date(Date.now() - 7 * 86_400_000)

  const [
    posts,
    categories,
    totalPosts,
    publishedCount,
    draftCount,
    viewsAgg,
    topPostsByViews,
    publishedLast7dRaw,
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
    // Posts published per day over the last 7 days — for the sparkline.
    prisma.blogPost.findMany({
      where: { publishedAt: { gte: since7d } },
      select: { publishedAt: true },
    }),
  ])

  const totalViews = viewsAgg._sum.views ?? 0

  // Build the 7-day "published posts" series (oldest → newest).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayBuckets = new Array(7).fill(0)
  for (const p of publishedLast7dRaw) {
    if (!p.publishedAt) continue
    const d = new Date(p.publishedAt)
    d.setHours(0, 0, 0, 0)
    const idx = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
    if (idx >= 0 && idx < 7) dayBuckets[6 - idx] += 1
  }
  const publishedWeekTotal = dayBuckets.reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت بلاگ"
        subtitle="مدیریت مقالات، دسته‌بندی‌ها و انتشار"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'بلاگ' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      {/* ─── Compact charts: publish trend + top viewed posts ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniTrend
          label="پست‌های منتشرشده ۷ روز اخیر"
          value={publishedWeekTotal}
          series={dayBuckets}
          color="#22c55e"
          hint="بر اساس تاریخ انتشار"
          className="lg:col-span-1"
        />
        <Panel title="پربازدیدترین مقالات">
          {topPostsByViews.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400">
              پست منتشرشده‌ای وجود ندارد
            </p>
          ) : (
            <ul className="space-y-2.5">
              {topPostsByViews.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-bold text-zinc-600">
                    {fa(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700">{p.title}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-900">
                    {fa(p.views)}
                  </span>
                  <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
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
