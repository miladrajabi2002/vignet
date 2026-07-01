import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { BlogEditor, type BlogPostData } from '@/components/blog/blog-editor'

export default async function NewBlogPostPage() {
	const user = await requireUser()
	const categories = await prisma.blogCategory.findMany({
		where: { workspaceId: user.workspaceId },
		orderBy: { name: 'asc' },
		select: { id: true, name: true },
	})

	const initial: BlogPostData = {
		title: '',
		slug: '',
		excerpt: null,
		content: '',
		coverImage: null,
		categoryId: null,
		status: 'DRAFT',
		seoTitle: null,
		seoDescription: null,
		seoKeywords: [],
		canonicalUrl: null,
		ogImage: null,
		featured: false,
		publishedAt: null,
	}

	return <BlogEditor initial={initial} categories={categories} isEdit={false} />
}
