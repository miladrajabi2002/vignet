import type { Metadata } from 'next'
import { getMainWorkspaceId as getWorkspaceId } from '@/lib/blog/workspace'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { SocialLinks } from '@/components/marketing/social-links'
import { PublicPostCard } from '@/components/blog/public-post-card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Without this the index inherited the site-default title and the homepage
 * description — a duplicate-title page that the sitemap advertises at priority
 * 0.8 with daily crawling, and no canonical.
 */
export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const title =
		locale === 'fa'
			? 'بلاگ ویجنت — هوش مصنوعی، فروش و پشتیبانی'
			: 'Vigent blog — AI, sales and customer support'
	const description =
		locale === 'fa'
			? 'مقاله‌ها و راهنماهای کاربردی درباره ایجنت‌های هوش مصنوعی فارسی، اتوماسیون فروش و پشتیبانی، CRM و ارتباط با مشتری در اینستاگرام، واتساپ و تلگرام.'
			: 'Practical articles and guides on Persian AI agents, sales and support automation, CRM, and customer conversations across Instagram, WhatsApp and Telegram.'
	return {
		title,
		description,
		alternates: { canonical: '/blog' },
		openGraph: { title, description, type: 'website', url: '/blog' },
	}
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
	const [featured, ...rest] = posts

	return (
		<div className="marketing-page-shell min-h-screen px-3 pb-24 pt-24 sm:px-5 sm:pt-28">
			<div className="mx-auto max-w-7xl">
			<header className="marketing-page-hero marketing-grid-dark relative mb-10 px-6 py-12 text-white sm:px-10 sm:py-16">
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

			{!featured ? (
				<div className="rounded-[1.5rem] border border-dashed border-black/15 bg-[#f7f7f5] p-16 text-center text-black/40">
					{locale === 'fa' ? 'هنوز پستی منتشر نشده است.' : 'No posts published yet.'}
				</div>
			) : (
				<div className="space-y-5">
					<PublicPostCard post={featured} locale={locale} featured />
					{rest.length > 0 && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rest.map((post) => <PublicPostCard key={post.id} post={post} locale={locale} />)}</div>}
				</div>
			)}
			</div>
		</div>
	)
}
