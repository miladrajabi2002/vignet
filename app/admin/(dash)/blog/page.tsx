import { FileText, CheckCircle2, PencilLine, Eye } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { AdminBlogManager } from '@/components/blog/admin-blog-manager'
import { getLocale } from 'next-intl/server'
import { PageHeader, StatCard, Card, fa } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

  const [posts, categories, totalPosts, publishedCount, draftCount, viewsAgg] =
    await Promise.all([
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
    ])

  const totalViews = viewsAgg._sum.views ?? 0

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
