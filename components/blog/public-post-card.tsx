import Link from 'next/link'
import { ArrowLeft, ArrowRight, Calendar, Clock3 } from 'lucide-react'
import { toPersianDigits } from '@/lib/blog/helpers'
import { relativeTime } from '@/lib/format'
import { BlogImage } from './blog-image'
import { TrendSpark } from './trend-spark'

/** Card data only — build it with toPublicPost() so full article bodies never reach the client. */
export type PublicPost = {
	id: string
	slug: string
	title: string
	excerpt: string
	coverImage: string | null
	readingMinutes: number
	publishedAt: Date | null
	createdAt: Date
	category: { name: string; slug: string } | null
}

export function PublicPostCard({ post, locale, featured = false }: { post: PublicPost; locale: 'fa' | 'en'; featured?: boolean }) {
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	return (
		<article className={`group overflow-hidden rounded-card border border-black/[0.08] bg-white shadow-[var(--elev-1)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[var(--elev-2)] ${featured ? 'grid lg:grid-cols-[1.2fr_0.8fr]' : 'flex flex-col'}`}>
			{post.coverImage ? (
				<Link href={`/blog/${post.slug}`} className="block min-h-52 overflow-hidden bg-black/[0.035]">
					<BlogImage
						src={post.coverImage}
						alt={post.title}
						priority={featured}
						sizes={featured ? '(min-width: 1280px) 740px, (min-width: 1024px) 58vw, 100vw' : '(min-width: 1280px) 400px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw'}
						className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] ${featured ? 'min-h-64' : 'aspect-[16/10]'}`}
					/>
				</Link>
			) : (
				<Link href={`/blog/${post.slug}`} className={`marketing-grid-dark flex items-end bg-black p-6 text-white ${featured ? 'min-h-64' : 'min-h-52'}`}>
				<span className="text-[12px] text-white/60">بلاگ ویجنت</span>
				</Link>
			)}
			<div className={`flex flex-1 flex-col ${featured ? 'p-6 sm:p-8' : 'p-5'}`}>
				<div className="flex items-center justify-between gap-3">
				{post.category ? <Link href={`/blog/category/${post.category.slug}`} className="inline-flex min-h-11 items-center text-[12px] font-medium text-[var(--text-secondary)] hover:text-black">{post.category.name}</Link> : <span className="text-[12px] text-[var(--text-muted)]">بلاگ ویجنت</span>}
					<TrendSpark seed={post.id} width={featured ? 82 : 58} height={22} />
				</div>
				<h2 className={`mt-4 font-bold leading-[1.55] text-black ${featured ? 'text-2xl sm:text-3xl' : 'text-base'}`}><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
				<p className={`mt-3 flex-1 text-[var(--text-muted)] ${featured ? 'text-sm leading-7' : 'line-clamp-3 text-xs leading-6'}`}>{post.excerpt}</p>
				<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.07] pt-4">
				<div className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
						<span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{relativeTime(post.publishedAt ?? post.createdAt, locale)}</span>
						<span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{locale === 'fa' ? `${toPersianDigits(post.readingMinutes)} دقیقه` : `${post.readingMinutes} min`}</span>
					</div>
				<Link href={`/blog/${post.slug}`} aria-label={locale === 'fa' ? `مطالعه ${post.title}` : `Read ${post.title}`} className="marketing-pressable flex h-11 w-11 items-center justify-center rounded-full bg-black text-white"><Arrow className="h-4 w-4" /></Link>
				</div>
			</div>
		</article>
	)
}
