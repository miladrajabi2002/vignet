import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { Eye, ArrowLeft, Flame, TrendingUp } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { TrendSpark } from '@/components/blog/trend-spark'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PopularPosts — server component that pulls the most-viewed published blog
 * posts and renders them as a simple horizontal row of three equal cards.
 * Sits on the homepage right before the pricing section, so visitors see
 * social proof (popular content) before being asked to upgrade.
 *
 * Returns null silently when there are fewer than 1 published posts.
 */
async function getWorkspaceId(): Promise<string | null> {
        const ws = await prisma.workspace.findFirst({
                orderBy: { createdAt: 'asc' },
                select: { id: true },
        })
        return ws?.id ?? null
}

/**
 * Fetch the popular posts, swallowing any DB error. This section is decorative
 * social-proof on the public homepage — a database hiccup must never take the
 * whole landing page down, so on failure we return an empty list (→ renders
 * nothing) instead of throwing.
 */
async function getPopularPosts() {
        try {
                const wsId = await getWorkspaceId()
                if (!wsId) return []
                return await prisma.blogPost.findMany({
                        where: { workspaceId: wsId, status: 'PUBLISHED' },
                        orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
                        take: 3,
                        select: {
                                id: true,
                                title: true,
                                slug: true,
                                excerpt: true,
                                content: true,
                                coverImage: true,
                                views: true,
                                publishedAt: true,
                                createdAt: true,
                                readingMinutes: true,
                                category: { select: { name: true, slug: true } },
                        },
                })
        } catch (err) {
                console.error('[PopularPosts] failed to load posts:', err)
                return []
        }
}

export async function PopularPosts() {
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
        const posts = await getPopularPosts()

        if (posts.length === 0) return null

        const isFa = locale === 'fa'

        return (
                <section id="popular" className="marketing-story-section bg-[var(--bg-base)] py-16 sm:py-20 lg:py-24">
                        <div className="mx-auto max-w-6xl px-6">
                                {/* Heading */}
                                <div className="mx-auto max-w-2xl text-center">
                                        <span className="marketing-eyebrow">
                                                {isFa ? 'پر بازدیدترین‌ها' : 'Most viewed'}
                                        </span>
                                        <h2 className="marketing-heading mx-auto mt-4">
                                                {isFa ? 'محبوب‌ترین مقالات' : 'Popular articles'}
                                        </h2>
                                        <p className="marketing-subtitle mx-auto mt-4">
                                                {isFa
                                                        ? 'راهنماها و تجربه‌های کاربردی درباره فروش، پشتیبانی و ایجنت‌های هوشمند.'
                                                        : 'Practical guides on sales, support and useful AI-agent workflows.'}
                                        </p>
                                </div>

                                {/* Three equal cards in a horizontal row */}
                                <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                        {posts.map((p, i) => (
										<PopularCard key={p.id} post={p} rank={i + 1} locale={locale} isFa={isFa} className={i === 2 ? 'hidden lg:flex' : ''} />
                                        ))}
                                </div>

                                {/* CTA to the full blog */}
                                <div className="mt-12 text-center">
                                        <Link
                                                href="/blog"
                                                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--border-hover)] px-5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--white-05)]"
                                        >
                                                {isFa ? 'مشاهده همه مقالات' : 'View all articles'}
                                                <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                                        </Link>
                                </div>
                        </div>
                </section>
        )
}

/* ───────────────────────────────────────────────────────────────────────
   Card sub-component — single uniform card layout for all ranks
   ─────────────────────────────────────────────────────────────────────── */

type PostPreview = {
        id: string
        title: string
        slug: string
        excerpt: string | null
        content: string
        coverImage: string | null
        views: number
        publishedAt: Date | null
        createdAt: Date
        readingMinutes: number
        category: { name: string; slug: string } | null
}

function RankBadge({ rank, isFa }: { rank: number; isFa: boolean }) {
        const labels = isFa
                ? ['داغ‌ترین مقاله', 'رتبه دوم', 'رتبه سوم']
                : ['Top read', '2nd most read', '3rd most read']
        const label = labels[rank - 1] ?? labels[2]

        if (rank === 1) {
                return (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--white)] px-2.5 py-1 text-[10px] font-semibold text-[var(--bg-base)]">
                                <Flame className="h-3 w-3" />
                                {label}
                        </span>
                )
        }
        return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                        <TrendingUp className="h-3 w-3" />
                        {label}
                </span>
        )
}

function ViewsLabel({ views, isFa }: { views: number; isFa: boolean }) {
        const formatted =
                views >= 1000
                        ? isFa
                                ? `${toPersianDigits((views / 1000).toFixed(1))}هزار`
                                : `${(views / 1000).toFixed(1)}k`
                : isFa
                        ? toPersianDigits(views)
                        : views.toLocaleString('en-US')

        return (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <Eye className="h-3 w-3" />
                        {isFa ? `${formatted} بازدید` : `${formatted} views`}
                </span>
        )
}

function PopularCard({
        post,
        rank,
	locale,
	isFa,
	className = '',
}: {
        post: PostPreview
        rank: number
        locale: 'fa' | 'en'
	isFa: boolean
	className?: string
}) {
        const excerpt = post.excerpt || deriveExcerpt(post.content)
        const time = relativeTime(post.publishedAt ?? post.createdAt, locale)

        return (
                <Link
                        href={`/blog/${post.slug}`}
						className={`group flex min-h-44 flex-row overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors duration-150 hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:min-h-0 sm:flex-col ${className}`}
                >
                        {post.coverImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                        src={post.coverImage}
                                        alt={post.title}
                                        loading="lazy"
                                        decoding="async"
										className="w-28 shrink-0 object-cover transition-transform duration-150 group-hover:scale-[1.02] sm:aspect-[3/2] sm:w-full"
                                />
                        )}
						<div className="min-w-0 flex flex-1 flex-col p-4 sm:p-5">
                                <div className="flex items-center justify-between gap-3">
                                        <RankBadge rank={rank} isFa={isFa} />
                                        {post.category && (
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)] rtl:tracking-normal">
                                                        {post.category.name}
                                                </span>
                                        )}
                                </div>
                                <h3 className="mt-3 line-clamp-2 text-base font-medium leading-snug text-[var(--text-primary)]">
                                        {post.title}
                                </h3>
								<p className="mt-2 hidden flex-1 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2 sm:block">
                                        {excerpt}
                                </p>
								<div className="mt-auto flex items-center justify-between gap-3 pt-3 sm:mt-4 sm:pt-0">
                                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                                                <ViewsLabel views={post.views} isFa={isFa} />
												<span className="hidden sm:inline">{time}</span>
												<span className="hidden sm:inline">
                                                        {isFa
                                                                ? `${toPersianDigits(post.readingMinutes)} دقیقه`
                                                                : `${post.readingMinutes} min`}
                                                </span>
                                        </div>
                                        <TrendSpark seed={post.id} />
                                </div>
                        </div>
                </Link>
        )
}
