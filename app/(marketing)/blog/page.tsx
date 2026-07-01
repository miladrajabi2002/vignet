import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { SocialLinks } from '@/components/marketing/social-links'

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

	const featured = posts.find((p) => p.featured) ?? posts[0]
	const rest = featured ? posts.filter((p) => p.id !== featured.id) : []

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<header className="mb-10 text-center">
				<h1 className="text-4xl font-light text-[var(--text-primary)] sm:text-5xl">
					{locale === 'fa' ? 'بلاگ ویجنت' : 'Vigent Blog'}
				</h1>
				<p className="mt-3 text-[var(--text-secondary)]">
					{locale === 'fa'
						? 'مقالات و آموزش‌های هوش مصنوعی، چت‌بات‌ها و اتوماسیون فروش'
						: 'Articles and tutorials on AI, chatbots, and sales automation'}
				</p>
				{/* Social follow bar — right under the blog header */}
				<div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-4 sm:flex-row sm:justify-between sm:text-start">
					<div>
						<p className="text-sm font-medium text-[var(--text-primary)]">
							{locale === 'fa' ? 'ما را دنبال کنید' : 'Follow us'}
						</p>
						<p className="mt-0.5 text-xs text-[var(--text-muted)]">
							{locale === 'fa'
								? 'جدیدترین مقالات در اینستاگرام و تلگرام'
								: 'Latest articles on Instagram and Telegram'}
						</p>
					</div>
					<SocialLinks variant="default" />
				</div>
			</header>

			{categories.length > 0 && (
				<div className="mb-8 flex flex-wrap justify-center gap-2">
					<Link
						href={`/blog`}
						className="rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-primary)]"
					>
						{locale === 'fa' ? 'همه' : 'All'}
					</Link>
					{categories.map((c) => (
						<Link
							key={c.id}
							href={`/blog/category/${c.slug}`}
							className="rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
						>
							{c.name}
						</Link>
					))}
				</div>
			)}

			{posts.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-[var(--border-default)] p-16 text-center text-[var(--text-muted)]">
					{locale === 'fa' ? 'هنوز پستی منتشر نشده است.' : 'No posts published yet.'}
				</div>
			) : (
				<>
					{featured && (
						<article className="mb-12 overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
							{featured.coverImage && (
								<Link href={`/blog/${featured.slug}`} className="block">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={featured.coverImage}
										alt={featured.title}
										className="aspect-[3/2] w-full object-cover"
									/>
								</Link>
							)}
							<div className="p-6 sm:p-8">
								{featured.category && (
									<Link
										href={`/blog/category/${featured.category.slug}`}
										className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]"
									>
										{featured.category.name}
									</Link>
								)}
								<h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)] sm:text-3xl">
									<Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
								</h2>
								<p className="mt-3 text-[var(--text-secondary)]">
									{featured.excerpt || deriveExcerpt(featured.content)}
								</p>
								<div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-muted)]">
									<span className="inline-flex items-center gap-1">
										<Calendar className="h-3.5 w-3.5" />
										{relativeTime(featured.publishedAt ?? featured.createdAt, locale)}
									</span>
									<span className="inline-flex items-center gap-1">
										<Clock className="h-3.5 w-3.5" />
										{locale === 'fa'
											? `${toPersianDigits(featured.readingMinutes)} دقیقه مطالعه`
											: `${featured.readingMinutes} min read`}
									</span>
								</div>
								<Link
									href={`/blog/${featured.slug}`}
									className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)] hover:gap-2 transition-all"
								>
									{locale === 'fa' ? 'ادامه مطلب' : 'Read more'}
									<ArrowLeft className="h-4 w-4 rtl:rotate-180" />
								</Link>
							</div>
						</article>
					)}

					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{rest.map((p) => (
							<article
								key={p.id}
								className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-hover)]"
							>
								{p.coverImage && (
									<Link href={`/blog/${p.slug}`} className="block">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={p.coverImage}
											alt={p.title}
											className="aspect-[3/2] w-full object-cover"
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
									<div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
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
								</div>
							</article>
						))}
					</div>
				</>
			)}
		</div>
	)
}
