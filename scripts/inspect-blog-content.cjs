// Inspect existing blog posts, categories and showcase entries (read-only).
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
        const ws = await p.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } })
        console.log('WORKSPACE:', ws?.id, ws?.name)

        const cats = await p.blogCategory.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true, slug: true } })
        console.log('\nCATEGORIES:', JSON.stringify(cats, null, 1))

        const posts = await p.blogPost.findMany({
                where: { workspaceId: ws.id },
                orderBy: { publishedAt: 'asc' },
                select: {
                        title: true, slug: true, status: true, publishedAt: true, views: true,
                        readingMinutes: true, excerpt: true, seoTitle: true, seoDescription: true,
                        seoKeywords: true, coverImage: true, categoryId: true, featured: true,
                },
        })
        console.log('\nPOSTS (' + posts.length + '):')
        for (const post of posts) {
                console.log(JSON.stringify({
                        slug: post.slug,
                        title: post.title,
                        status: post.status,
                        publishedAt: post.publishedAt?.toISOString?.() ?? post.publishedAt,
                        views: post.views,
                        readingMinutes: post.readingMinutes,
                        hasExcerpt: !!post.excerpt,
                        excerptLen: post.excerpt?.length ?? 0,
                        seoTitle: post.seoTitle ?? null,
                        seoDescription: post.seoDescription ?? null,
                        keywords: post.seoKeywords?.length ?? 0,
                        coverImage: post.coverImage ?? null,
                        category: cats.find((c) => c.id === post.categoryId)?.slug ?? null,
                        featured: post.featured,
                }))
        }

        const showcase = await p.showcaseEntry.findMany({ orderBy: { sortOrder: 'asc' } })
        console.log('\nSHOWCASE (' + showcase.length + '):')
        for (const s of showcase) {
                console.log(JSON.stringify({ name: s.name, handle: s.handle, url: s.url, channels: s.channels, quote: s.quote, metricValue: s.metricValue, metricLabel: s.metricLabel, active: s.active, featured: s.featured, hasImage: !!s.imageUrl }))
        }
}

main().finally(() => p.$disconnect())
