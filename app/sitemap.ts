import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { SOLUTIONS } from '@/lib/marketing/solutions'

// Stays dynamic (a static sitemap would need the DB at build time), but the
// DB reads below are cached for an hour — crawlers hit sitemaps aggressively.
export const dynamic = 'force-dynamic'

/**
 * The platform's own blog workspace. Explicit via PLATFORM_WORKSPACE_ID; the
 * oldest workspace is only a fallback for single-tenant installs (relying on
 * it alone would index a random tenant's posts once tenants publish blogs).
 */
async function getWorkspaceId(): Promise<string | null> {
	const explicit = process.env.PLATFORM_WORKSPACE_ID
	if (explicit) return explicit
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}

const getBlogEntries = unstable_cache(
	async () => {
		const wsId = await getWorkspaceId()
		if (!wsId) return { posts: [], categories: [] }
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
		return { posts, categories }
	},
	['sitemap-blog-entries'],
	{ revalidate: 3600 },
)

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

	for (const s of SOLUTIONS) {
		entries.push({
			url: `${base}/solutions/${s.slug}`,
			lastModified: new Date(),
			changeFrequency: 'monthly',
			priority: 0.8,
		})
	}

	// Blog URLs come from the hourly cache — a DB failure degrades to the
	// static entries instead of 500ing the whole sitemap.
	try {
		const { posts, categories } = await getBlogEntries()
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
	} catch (e) {
		console.error('[sitemap] blog entries unavailable:', e)
	}

	return entries
}
