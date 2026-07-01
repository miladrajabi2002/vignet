import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { toPersianDigits, deriveExcerpt } from '@/lib/blog/helpers'
import { Calendar, Clock } from 'lucide-react'
import { relativeTime } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
	params: { slug: string }
}

async function getWorkspaceId(): Promise<string | null> {
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}

export async function generateMetadata({ params }: Props) {
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

export default async function PublicBlogCategoryPage({ params }: Props) {
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
		<div className="mx-auto max-w-5xl px-4 py-12">
			<header className="mb-10 text-center">
				<h1 className="text-3xl font-light text-[var(--text-primary)] sm:text-4xl">
					{category.name}
				</h1>
				{category.description && (
					<p className="mt-3 text-[var(--text-secondary)]">{category.description}</p>
				)}
			</header>

			<div className="mb-8 text-center">
				<Link
					href={`/blog`}
					className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
				>
					{locale === 'fa' ? '← همه پست‌ها' : '← All posts'}
				</Link>
			</div>

			{posts.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-[var(--border-default)] p-16 text-center text-[var(--text-muted)]">
					{locale === 'fa' ? 'هیچ پستی در این دسته نیست.' : 'No posts in this category.'}
				</div>
			) : (
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{posts.map((p) => (
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
								<h3 className="font-medium text-[var(--text-primary)]">
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
			)}
		</div>
	)
}
