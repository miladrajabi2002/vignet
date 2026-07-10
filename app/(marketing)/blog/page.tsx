import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { Calendar, Clock } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { SocialLinks } from '@/components/marketing/social-links'
import { TrendSpark } from '@/components/blog/trend-spark'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public blog index — shows published posts from the first workspace (single-tenant demo).
// In a multi-tenant setup, you'd resolve workspace by domain.
async function getWorkspaceId(): Promise<string | null> {
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}

export default async function PublicBlogIndexPage() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
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
		<div className="mx-auto max-w-7xl px-5 pb-24 pt-32 sm:px-8 sm:pt-36">
			<header className="marketing-grid-dark relative mb-12 overflow-hidden rounded-[2rem] bg-black px-6 py-12 text-white sm:px-10 sm:py-16">
				<div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
				<div>
				<p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">Vigent Journal</p>
				<h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
					{locale === 'fa' ? 'بلاگ ویجنت' : 'Vigent Blog'}
				</h1>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-[15px]">
					{locale === 'fa'
						? 'مقالات و آموزش‌های هوش مصنوعی، چت‌بات‌ها و اتوماسیون فروش'
						: 'Articles and tutorials on AI, chatbots, and sales automation'}
				</p>
				</div>
				<div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-5 py-5 backdrop-blur-sm">
					<div>
						<p className="text-sm font-medium text-white">
							{locale === 'fa' ? 'ما را دنبال کنید' : 'Follow us'}
						</p>
						<p className="mt-1 text-xs leading-5 text-white/40">
							{locale === 'fa'
								? 'جدیدترین مقالات در اینستاگرام و تلگرام'
								: 'Latest articles on Instagram and Telegram'}
						</p>
					</div>
					<SocialLinks variant="default" className="mt-4 [&_a]:border-white/15 [&_a]:text-white/60" />
				</div>
				</div>
			</header>

			{categories.length > 0 && (
				<div className="mb-8 flex flex-wrap justify-start gap-2">
					<Link
						href={`/blog`}
						className="inline-flex min-h-10 items-center rounded-full bg-black px-4 text-xs text-white"
					>
						{locale === 'fa' ? 'همه' : 'All'}
					</Link>
					{categories.map((c) => (
						<Link
							key={c.id}
							href={`/blog/category/${c.slug}`}
							className="inline-flex min-h-10 items-center rounded-full border border-black/10 bg-white px-4 text-xs text-black/55 transition-colors hover:border-black/20 hover:text-black"
						>
							{c.name}
						</Link>
					))}
				</div>
			)}

			{posts.length === 0 ? (
				<div className="rounded-[1.5rem] border border-dashed border-black/15 bg-[#f7f7f5] p-16 text-center text-black/40">
					{locale === 'fa' ? 'هنوز پستی منتشر نشده است.' : 'No posts published yet.'}
				</div>
			) : (
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{posts.map((p) => (
						<article
							key={p.id}
							className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-black/10 bg-white transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
						>
							{p.coverImage && (
								<Link href={`/blog/${p.slug}`} className="block">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={p.coverImage}
										alt={p.title}
										loading="lazy"
										decoding="async"
										className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
									/>
								</Link>
							)}
							<div className="flex flex-1 flex-col p-5">
								{p.category && (
									<Link
										href={`/blog/category/${p.category.slug}`}
										className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
									>
										{p.category.name}
									</Link>
								)}
								<h3 className="mt-1.5 font-medium text-[var(--text-primary)]">
									<Link href={`/blog/${p.slug}`}>{p.title}</Link>
								</h3>
								<p className="mt-2 flex-1 text-sm text-[var(--text-secondary)] line-clamp-3">
									{p.excerpt || deriveExcerpt(p.content)}
								</p>
								<div className="mt-3 flex items-center justify-between gap-3">
									<div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
										<span className="inline-flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{relativeTime(p.publishedAt ?? p.createdAt, locale)}
										</span>
										<span className="inline-flex items-center gap-1">
											<Clock className="h-3 w-3" />
											{locale === 'fa'
												? `${toPersianDigits(p.readingMinutes)} دقیقه`
												: `${p.readingMinutes} min`}
										</span>
									</div>
									<TrendSpark seed={p.id} />
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</div>
	)
}
