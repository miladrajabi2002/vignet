import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { BlogEditor, type BlogPostData } from '@/components/blog/blog-editor'

export default async function EditBlogPostPage({
	params,
}: {
	params: { postId: string }
}) {
	const user = await requireUser()

	const [post, categories] = await Promise.all([
		prisma.blogPost.findFirst({
			where: { id: params.postId, workspaceId: user.workspaceId },
		}),
		prisma.blogCategory.findMany({
			where: { workspaceId: user.workspaceId },
			orderBy: { name: 'asc' },
			select: { id: true, name: true },
		}),
	])
	if (!post) notFound()

	const initial: BlogPostData = {
		id: post.id,
		title: post.title,
		slug: post.slug,
		excerpt: post.excerpt,
		content: post.content,
		coverImage: post.coverImage,
		categoryId: post.categoryId,
		status: post.status,
		seoTitle: post.seoTitle,
		seoDescription: post.seoDescription,
		seoKeywords: post.seoKeywords,
		canonicalUrl: post.canonicalUrl,
		ogImage: post.ogImage,
		featured: post.featured,
		publishedAt: post.publishedAt?.toISOString() ?? null,
	}

	return <BlogEditor initial={initial} categories={categories} isEdit />
}
