import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getWorkspaceId(): Promise<string | null> {
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
	const entries: MetadataRoute.Sitemap = [
		{ url: `${base}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
		{
			url: `${base}/blog`,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 0.8,
		},
		{
			url: `${base}/docs`,
			lastModified: new Date(),
			changeFrequency: 'weekly',
			priority: 0.6,
		},
	]

	const wsId = await getWorkspaceId()
	if (wsId) {
		const [posts, categories] = await Promise.all([
			prisma.blogPost.findMany({
				where: { workspaceId: wsId, status: 'PUBLISHED' },
				select: { slug: true, updatedAt: true },
			}),
			prisma.blogCategory.findMany({
				where: { workspaceId: wsId },
				select: { slug: true, updatedAt: true },
			}),
		])
		for (const p of posts) {
			entries.push({
				url: `${base}/blog/${p.slug}`,
				lastModified: p.updatedAt,
				changeFrequency: 'monthly',
				priority: 0.7,
			})
		}
		for (const c of categories) {
			entries.push({
				url: `${base}/blog/category/${c.slug}`,
				lastModified: c.updatedAt,
				changeFrequency: 'weekly',
				priority: 0.5,
			})
		}
	}

	return entries
}
