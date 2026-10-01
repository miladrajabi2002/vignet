import type { Metadata } from 'next'
import { getMainWorkspaceId as getWorkspaceId } from '@/lib/blog/workspace'
import { prisma } from '@/lib/prisma'
import { SocialLinks } from '@/components/marketing/social-links'
import { PublicBlogIndex } from '@/components/blog/public-blog-index'
import { MarketingHeroPill } from '@/components/marketing/animated-pill'
import { toSearchablePublicPost } from '@/lib/blog/public-post'

// ISR: the index re-renders at most every 5 minutes (publishing a post via the
// admin API revalidates it immediately). Post content is Persian, so the page
// is fa-only by design — /en/blog redirects to /blog in middleware instead of
// pretending to be an English URL.
export const revalidate = 300

/**
 * Without this the index inherited the site-default title and the homepage
 * description — a duplicate-title page that the sitemap advertises at priority
 * 0.8 with daily crawling, and no canonical.
 */
export async function generateMetadata(): Promise<Metadata> {
        // Static-renderable: no cookies()/headers() here (that would force
        // dynamic rendering and defeat the ISR cache).
        const title = 'بلاگ ویجنت — هوش مصنوعی، فروش و پشتیبانی'
        const description =
                'مقاله‌ها و راهنماهای کاربردی درباره ایجنت‌های هوش مصنوعی فارسی، اتوماسیون فروش و پشتیبانی، CRM و ارتباط با مشتری در اینستاگرام و تلگرام.'
        return {
                title,
                description,
                alternates: { canonical: '/blog' },
                openGraph: { title, description, type: 'website', url: '/blog' },
        }
}


export default async function PublicBlogIndexPage() {
        const wsId = await getWorkspaceId()

        const [posts, categories] = await Promise.all([
                wsId
                        ? prisma.blogPost.findMany({
                                        where: { workspaceId: wsId, status: 'PUBLISHED' },
                                        orderBy: { publishedAt: 'desc' },
                                        include: { category: { select: { name: true, slug: true } } },
                                        take: 30,
                                })
                        : [],
                wsId
                        ? prisma.blogCategory.findMany({
                                        where: { workspaceId: wsId },
                                        orderBy: { name: 'asc' },
                                        select: { id: true, name: true, slug: true },
                                })
                        : [],
        ])
        return (
                <div className="marketing-page-shell min-h-screen px-3 pb-24 pt-24 sm:px-5 sm:pt-28">
                        <div className="mx-auto max-w-7xl">
                        <header className="relative mb-10 border-b border-black/[0.08] px-1 pb-9 pt-2 sm:px-2 sm:pb-12 sm:pt-4">
                                <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
                                <div>
                                <MarketingHeroPill>Vigent Journal</MarketingHeroPill>
                                <h1 className="mt-5 text-4xl font-bold leading-[1.3] text-vg-ink sm:text-5xl lg:text-6xl">
                                        بلاگ ویجنت
                                </h1>
                                <p className="mt-4 max-w-2xl text-[15px] leading-8 text-vg-sub sm:text-[17px]">
                                        مقالات و آموزش‌های هوش مصنوعی، چت‌بات‌ها و اتوماسیون فروش
                                </p>
                                </div>
                                <div className="rounded-card border border-black/[0.08] bg-white px-5 py-5 shadow-[var(--elev-1)]">
                                        <div>
                                                <p className="text-sm font-bold text-vg-ink">ما را دنبال کنید</p>
                                                <p className="mt-1 text-[13px] leading-6 text-vg-cap">
                                                        جدیدترین مقالات در اینستاگرام و تلگرام
                                                </p>
                                        </div>
                                        <SocialLinks variant="default" className="mt-4" />
                                </div>
                                </div>
                        </header>

                        <PublicBlogIndex posts={posts.map(toSearchablePublicPost)} categories={categories} locale="fa" />
                        </div>
                </div>
        )
}
