import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { Calendar, Clock } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { TrendSpark } from '@/components/blog/trend-spark'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
	params: Promise<{ slug: string }>
}

async function getWorkspaceId(): Promise<string | null> {
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}

export async function generateMetadata(props: Props) {
    const params = await props.params;
    const wsId = await getWorkspaceId()
    if (!wsId) return {}
    const cat = await prisma.blogCategory.findFirst({
		where: { workspaceId: wsId, slug: params.slug },
	})
    if (!cat) return {}
    return {
		title: cat.name,
		description: cat.description ?? cat.name,
	}
}

export default async function PublicBlogCategoryPage(props: Props) {
    const params = await props.params;
    const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
    const wsId = await getWorkspaceId()
    if (!wsId) notFound()

    const category = await prisma.blogCategory.findFirst({
		where: { workspaceId: wsId, slug: params.slug },
	})
    if (!category) notFound()

    const posts = await prisma.blogPost.findMany({
		where: { workspaceId: wsId, status: 'PUBLISHED', categoryId: category.id },
		orderBy: { publishedAt: 'desc' },
		include: { category: { select: { name: true, slug: true } } },
		take: 50,
	})

    return (
		<div className="mx-auto max-w-7xl px-5 pb-24 pt-32 sm:px-8 sm:pt-36">
			<header className="marketing-grid-dark mb-10 overflow-hidden rounded-[2rem] bg-black px-6 py-12 text-center text-white sm:px-10 sm:py-14">
				<p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">Vigent Journal</p>
				<h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
					{category.name}
				</h1>
				{category.description && (
					<p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/50">{category.description}</p>
				)}
			</header>

			<div className="mb-8">
				<Link
					href={`/blog`}
					className="inline-flex min-h-11 items-center rounded-full border border-black/10 px-4 text-xs text-black/55 hover:text-black"
				>
					{locale === 'fa' ? '← همه پست‌ها' : '← All posts'}
				</Link>
			</div>

			{posts.length === 0 ? (
				<div className="rounded-[1.5rem] border border-dashed border-black/15 bg-[#f7f7f5] p-16 text-center text-black/40">
					{locale === 'fa' ? 'هیچ پستی در این دسته نیست.' : 'No posts in this category.'}
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
								<h3 className="font-medium text-[var(--text-primary)]">
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
