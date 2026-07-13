import Link from 'next/link'
import { ArrowLeft, ArrowRight, Calendar, Clock3 } from 'lucide-react'
import { deriveExcerpt, toPersianDigits } from '@/lib/blog/helpers'
import { relativeTime } from '@/lib/format'
import { TrendSpark } from './trend-spark'

type PublicPost = {
	id: string
	slug: string
	title: string
	excerpt: string | null
	content: string
	coverImage: string | null
	readingMinutes: number
	publishedAt: Date | null
	createdAt: Date
	category: { name: string; slug: string } | null
}

export function PublicPostCard({ post, locale, featured = false }: { post: PublicPost; locale: 'fa' | 'en'; featured?: boolean }) {
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	return (
		<article className={`group overflow-hidden rounded-[1.65rem] border border-black/[0.08] bg-white shadow-[0_14px_44px_rgba(0,0,0,0.055)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-black/15 hover:shadow-[0_22px_60px_rgba(0,0,0,0.1)] ${featured ? 'grid lg:grid-cols-[1.2fr_0.8fr]' : 'flex flex-col'}`}>
			{post.coverImage ? (
				<Link href={`/blog/${post.slug}`} className="block min-h-52 overflow-hidden bg-black/[0.035]">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={post.coverImage} alt={post.title} loading={featured ? 'eager' : 'lazy'} decoding="async" className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] ${featured ? 'min-h-64' : 'aspect-[16/10]'}`} />
				</Link>
			) : (
				<Link href={`/blog/${post.slug}`} className={`marketing-grid-dark flex items-end bg-black p-6 text-white ${featured ? 'min-h-64' : 'min-h-52'}`}>
					<span className="text-[10px] text-white/35">Vigent Journal</span>
				</Link>
			)}
			<div className={`flex flex-1 flex-col ${featured ? 'p-6 sm:p-8' : 'p-5'}`}>
				<div className="flex items-center justify-between gap-3">
					{post.category ? <Link href={`/blog/category/${post.category.slug}`} className="text-[10px] font-medium text-black/45 hover:text-black">{post.category.name}</Link> : <span className="text-[10px] text-black/35">Vigent Journal</span>}
					<TrendSpark seed={post.id} width={featured ? 82 : 58} height={22} />
				</div>
				<h2 className={`mt-4 font-semibold leading-[1.55] text-black ${featured ? 'text-2xl sm:text-3xl' : 'text-base'}`}><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
				<p className={`mt-3 flex-1 text-black/50 ${featured ? 'text-sm leading-7' : 'line-clamp-3 text-xs leading-6'}`}>{post.excerpt || deriveExcerpt(post.content)}</p>
				<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.07] pt-4">
					<div className="flex items-center gap-3 text-[10px] text-black/35">
						<span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{relativeTime(post.publishedAt ?? post.createdAt, locale)}</span>
						<span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{locale === 'fa' ? `${toPersianDigits(post.readingMinutes)} دقیقه` : `${post.readingMinutes} min`}</span>
					</div>
					<Link href={`/blog/${post.slug}`} aria-label={locale === 'fa' ? `مطالعه ${post.title}` : `Read ${post.title}`} className="marketing-pressable flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"><Arrow className="h-3.5 w-3.5" /></Link>
				</div>
			</div>
		</article>
	)
}
