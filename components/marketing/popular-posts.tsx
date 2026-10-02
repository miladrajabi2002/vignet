import Image from 'next/image'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { BookOpen, Eye, Flame, TrendingUp } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { relativeTime } from '@/lib/format'
import { TrendSpark } from '@/components/blog/trend-spark'
import { BlogImage } from '@/components/blog/blog-image'
import { blogImageSources } from '@/lib/blog/image-variants'
import { Container, ForwardArrow, SectionHead, btnGhost, toSiteLocale, type SiteLocale } from '@/components/marketing/site/ui'
import { cn } from '@/lib/utils'

/**
 * Homepage "most viewed" blog row. Server rendered from a 5-minute cache; a
 * database hiccup renders nothing instead of breaking the landing page.
 * Desktop cards show the (lazy, device-sized WebP) cover; phones get a lighter swipe row
 * without images.
 */
const loadPopularPosts = unstable_cache(async () => {
	const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
	if (!workspace) return []
	return prisma.blogPost.findMany({
		where: { workspaceId: workspace.id, status: 'PUBLISHED' },
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
		},
	})
}, ['marketing-popular-posts-v2'], { revalidate: 300, tags: ['marketing-popular-posts'] })

async function getPopularPosts() {
	try {
		return await loadPopularPosts()
	} catch (err) {
		console.error('[PopularPosts] failed to load posts:', err)
		return []
	}
}

type Post = Awaited<ReturnType<typeof getPopularPosts>>[number]

const COPY = {
	fa: {
		pill: 'پربازدیدترین‌ها',
		title: 'از وبلاگ ویجنت',
		lead: 'راهنماها و تجربه‌های کاربردی دربارهٔ فروش، پشتیبانی و ایجنت‌های هوشمند.',
		ranks: ['داغ‌ترین مقاله', 'رتبهٔ دوم', 'رتبهٔ سوم'],
		all: 'مشاهدهٔ همهٔ مقاله‌ها',
		views: (n: string) => `${n} بازدید`,
		minutes: (n: string) => `${n} دقیقه`,
	},
	en: {
		pill: 'Most viewed',
		title: 'From the Vigent blog',
		lead: 'Practical guides on sales, support and AI agents.',
		ranks: ['Top read', '2nd most read', '3rd most read'],
		all: 'View all articles',
		views: (n: string) => `${n} views`,
		minutes: (n: string) => `${n} min`,
	},
} as const

const optimizable = (src: string) => src.startsWith('/') || /^https:\/\/[^/]+\.supabase\.co\//.test(src)

export async function PopularPosts() {
	const locale = toSiteLocale(await getLocale())
	const posts = await getPopularPosts()
	if (posts.length === 0) return null
	const c = COPY[locale]

	return (
		<section id="blog" aria-labelledby="blog-title" className="vg-cv scroll-mt-24 pt-14 md:pt-20 lg:py-[120px]">
			<Container className="px-0 sm:px-0 xl:px-0">
				<SectionHead id="blog-title" className="vg-rv px-4 sm:px-6" pill={c.pill} icon={Flame} iconClassName="text-[#ea580c]" title={c.title} lead={c.lead} titleClassName="lg:text-[48px] lg:leading-[1.4]" />
				<ul className="vg-rv-group vg-noscroll mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:px-6 lg:mt-10 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible xl:px-0">
					{posts.map((post, index) => <PostCard key={post.id} post={post} rank={index} locale={locale} />)}
				</ul>
				<div className="mt-3.5 flex justify-center lg:mt-10">
					<Link href="/blog" className={cn(btnGhost, 'min-h-11 rounded-full px-[18px] text-[13px] lg:h-12 lg:px-6 lg:text-[15px]')}>
						<BookOpen aria-hidden className="hidden size-[17px] lg:block" strokeWidth={1.8} />
						{c.all}
						<ForwardArrow locale={locale} className="size-[15px] lg:hidden" />
					</Link>
				</div>
			</Container>
		</section>
	)
}

function PostCard({ post, rank, locale }: { post: Post; rank: number; locale: SiteLocale }) {
	const c = COPY[locale]
	const fa = locale === 'fa'
	const excerpt = post.excerpt || deriveExcerpt(post.content)
	const cover = post.coverImage?.trim()
	const views = fa ? toPersianDigits(post.views) : post.views.toLocaleString('en-US')
	const minutes = fa ? toPersianDigits(post.readingMinutes) : String(post.readingMinutes)
	const RankIcon = rank === 0 ? Flame : TrendingUp

	return (
		<li className="w-[290px] shrink-0 snap-center lg:w-auto">
			<Link
				href={`/blog/${post.slug}`}
				className="vg-press vg-lift vg-zoom flex h-full min-h-[176px] flex-col overflow-hidden rounded-card border border-vg-line bg-white text-vg-ink lg:rounded-3xl"
			>
				{cover ? (
					<div className="relative hidden aspect-[3/2] overflow-hidden bg-vg-ink lg:block">
						{blogImageSources(cover) ? (
							// Pre-built device variants: no on-demand optimizer work per release.
							<BlogImage src={cover} alt={post.title} sizes="(min-width: 1280px) 387px, 33vw" className="size-full object-cover" />
						) : optimizable(cover) ? (
							<Image src={cover} alt={post.title} fill sizes="(min-width: 1280px) 387px, 33vw" loading="lazy" className="object-cover" />
						) : (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={cover} alt={post.title} width={560} height={373} loading="lazy" decoding="async" className="size-full object-cover" />
						)}
					</div>
				) : null}
				<div className="flex grow flex-col p-[18px] text-start lg:px-[22px] lg:py-5">
					<div>
						<span className={cn('inline-flex h-[26px] items-center gap-[5px] rounded-full px-2.5 text-[12px]', rank === 0 ? 'bg-vg-ink font-bold text-white' : 'border border-black/10 bg-white font-medium text-vg-sub')}>
							<RankIcon aria-hidden className={cn('size-[13px]', rank === 0 && 'text-[#fb923c]')} strokeWidth={2} />
							{c.ranks[rank] ?? c.ranks[2]}
						</span>
					</div>
					<h3 className="mt-3 line-clamp-2 text-[15px] font-bold leading-[1.8] lg:mt-3.5 lg:text-[18px] lg:leading-[1.75]">{post.title}</h3>
					<p className="mt-2 hidden text-[15px] leading-[1.9] text-vg-sub lg:line-clamp-2">{excerpt}</p>
					<div className="mt-auto flex items-center justify-between gap-3 pt-3 lg:pt-[18px]">
						<span className="flex items-center gap-3 text-[12px] text-vg-cap">
							<span className="inline-flex items-center gap-1"><Eye aria-hidden className="size-3.5" strokeWidth={1.8} />{c.views(views)}</span>
							<span className="hidden lg:inline">{relativeTime(post.publishedAt ?? post.createdAt, locale)}</span>
							<span>{c.minutes(minutes)}</span>
						</span>
						<TrendSpark seed={post.id} />
					</div>
				</div>
			</Link>
		</li>
	)
}
