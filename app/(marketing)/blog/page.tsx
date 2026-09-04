import type { Metadata } from 'next'
import { getMainWorkspaceId as getWorkspaceId } from '@/lib/blog/workspace'
import { prisma } from '@/lib/prisma'
import { SocialLinks } from '@/components/marketing/social-links'
import { PublicBlogIndex } from '@/components/blog/public-blog-index'

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
                        <header className="marketing-page-hero marketing-grid-dark relative mb-10 px-6 py-12 text-white sm:px-10 sm:py-16">
                                <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
                                <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">Vigent Journal</p>
                                <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                                        بلاگ ویجنت
                                </h1>
                                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-[15px]">
                                        مقالات و آموزش‌های هوش مصنوعی، چت‌بات‌ها و اتوماسیون فروش
                                </p>
                                </div>
                                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-5 py-5 backdrop-blur-sm">
                                        <div>
                                                <p className="text-sm font-medium text-white">ما را دنبال کنید</p>
                                                <p className="mt-1 text-xs leading-5 text-white/40">
                                                        جدیدترین مقالات در اینستاگرام و تلگرام
                                                </p>
                                        </div>
                                        <SocialLinks variant="default" className="mt-4 [&_a]:border-white/15 [&_a]:text-white/60" />
                                </div>
                                </div>
                        </header>

                        <PublicBlogIndex posts={posts} categories={categories} locale="fa" />
                        </div>
                </div>
        )
}
