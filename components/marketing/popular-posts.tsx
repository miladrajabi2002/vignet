import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { Eye, ArrowLeft } from 'lucide-react'
import { relativeTime } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PopularPosts — server component that pulls the most-viewed published blog
 * posts and renders them as a compact ranking grid. Sits on the homepage
 * right before the pricing section, so visitors see social proof (popular
 * content) before being asked to upgrade.
 *
 * Returns null silently when there are no posts yet, so the homepage stays
 * clean on a fresh install.
 */
async function getWorkspaceId(): Promise<string | null> {
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}

export async function PopularPosts() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const wsId = await getWorkspaceId()

	if (!wsId) return null

	const posts = await prisma.blogPost.findMany({
		where: { workspaceId: wsId, status: 'PUBLISHED' },
		orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
		take: 4,
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

	if (posts.length === 0) return null

	const isFa = locale === 'fa'

	return (
		<section id="popular" className="bg-[var(--bg-base)] py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-6">
				{/* Heading */}
				<div className="mx-auto max-w-2xl text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] tracking-wide text-[var(--text-secondary)]">
						<Eye className="h-3.5 w-3.5" />
						{isFa ? 'پر بازدیدترین‌ها' : 'Most viewed'}
					</span>
					<h2 className="mt-5 text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
						{isFa ? 'محبوب‌ترین مقالات' : 'Popular articles'}
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">
						{isFa
							? 'پربازدیدترین مطالب ویجنت که دیگران خوانده‌اند — تجربه کاربران واقعی با هوش مصنوعی.'
							: 'The most-read Vigent articles — real stories from teams using AI agents.'}
					</p>
				</div>

				{/* Grid: first post spans two columns on large screens for emphasis */}
				<div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
					{/* Featured #1 — large card */}
					{posts[0] && (
						<PopularCard post={posts[0]} rank={1} large locale={locale} isFa={isFa} />
					)}

					{/* Smaller #2–#4 stack on the right (or below on mobile) */}
					<div className="flex flex-col gap-5">
						{posts.slice(1, 4).map((p, i) => (
							<PopularCard key={p.id} post={p} rank={i + 2} locale={locale} isFa={isFa} />
						))}
					</div>
				</div>

				{/* CTA to the full blog */}
				<div className="mt-12 text-center">
					<Link
						href="/blog"
						className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hover)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--white-05)]"
					>
						{isFa ? 'مشاهده همه مقالات' : 'View all articles'}
						<ArrowLeft className="h-4 w-4 rtl:rotate-180" />
					</Link>
				</div>
			</div>
		</section>
	)
}

/* ───────────────────────────────────────────────────────────────────────
   Card sub-components
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

function RankBadge({ rank }: { rank: number }) {
	return (
		<span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--white)] px-2 text-xs font-semibold text-[var(--bg-base)]">
			{toPersianDigits(String(rank).padStart(2, '0'))}
		</span>
	)
}

function ViewsLabel({ views, isFa }: { views: number; isFa: boolean }) {
	const formatted =
		views >= 1000
			? isFa
				? `${toPersianDigits((views / 1000).toFixed(1))}هزار`
				: `${(views / 1000).toFixed(1)}k`
			: toPersianDigits(views)

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
	large = false,
	locale,
	isFa,
}: {
	post: PostPreview
	rank: number
	large?: boolean
	locale: 'fa' | 'en'
	isFa: boolean
}) {
	const excerpt = post.excerpt || deriveExcerpt(post.content)
	const time = relativeTime(post.publishedAt ?? post.createdAt, locale)

	if (large) {
		return (
			<Link
				href={`/blog/${post.slug}`}
				className="group relative flex flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
			>
				{post.coverImage && (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={post.coverImage}
						alt={post.title}
						className="aspect-[3/2] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
					/>
				)}
				<div className="flex flex-1 flex-col p-6 sm:p-8">
					<div className="flex items-center justify-between gap-3">
						<RankBadge rank={rank} />
						{post.category && (
							<span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
								{post.category.name}
							</span>
						)}
					</div>
					<h3 className="mt-4 text-2xl font-medium leading-tight text-[var(--text-primary)] sm:text-3xl">
						{post.title}
					</h3>
					<p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">
						{excerpt}
					</p>
					<div className="mt-5 flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
						<ViewsLabel views={post.views} isFa={isFa} />
						<span>{time}</span>
						<span>
							{isFa
								? `${toPersianDigits(post.readingMinutes)} دقیقه مطالعه`
								: `${post.readingMinutes} min read`}
						</span>
					</div>
				</div>
			</Link>
		)
	}

	// Compact horizontal card
	return (
		<Link
			href={`/blog/${post.slug}`}
			className="group flex gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-all duration-300 hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
		>
			{post.coverImage && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={post.coverImage}
					alt={post.title}
					className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block"
				/>
			)}
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-center gap-2">
					<RankBadge rank={rank} />
					{post.category && (
						<span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
							{post.category.name}
						</span>
					)}
				</div>
				<h3 className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-primary)]">
					{post.title}
				</h3>
				<div className="mt-auto flex items-center gap-3 pt-2 text-[11px] text-[var(--text-muted)]">
					<ViewsLabel views={post.views} isFa={isFa} />
					<span>{time}</span>
				</div>
			</div>
		</Link>
	)
}
