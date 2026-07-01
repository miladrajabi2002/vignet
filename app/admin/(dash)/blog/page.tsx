import { prisma } from '@/lib/prisma'
import { AdminBlogManager } from '@/components/blog/admin-blog-manager'
import { getLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export default async function AdminBlogPage() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'

	const [posts, categories] = await Promise.all([
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
	])

	return (
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
	)
}
