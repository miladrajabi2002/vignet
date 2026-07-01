import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import {
	renderMarkdown,
	deriveExcerpt,
	deriveSeoTitle,
	deriveSeoDescription,
	toPersianDigits,
} from '@/lib/blog/helpers'
import { Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { SocialLinks } from '@/components/marketing/social-links'

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
	const post = await prisma.blogPost.findFirst({
		where: { workspaceId: wsId, slug: params.slug, status: 'PUBLISHED' },
	})
	if (!post) return {}

	const title = post.seoTitle ?? deriveSeoTitle(post.title)
	const description =
		post.seoDescription ?? deriveSeoDescription(post.excerpt, post.content)
	const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/blog/${post.slug}`
	const image = post.ogImage ?? post.coverImage

	return {
		title,
		description,
		alternates: { canonical: post.canonicalUrl || url },
		keywords: post.seoKeywords,
		openGraph: {
			title,
			description,
			url,
			siteName: 'Vigent',
			type: 'article',
			publishedTime: post.publishedAt?.toISOString(),
			images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
			images: image ? [image] : undefined,
		},
	}
}

export default async function PublicBlogPostPage({ params }: Props) {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const wsId = await getWorkspaceId()
	if (!wsId) notFound()

	const post = await prisma.blogPost.findFirst({
		where: { workspaceId: wsId, slug: params.slug, status: 'PUBLISHED' },
		include: { category: { select: { name: true, slug: true } } },
	})
	if (!post) notFound()

	// Increment views (fire-and-forget; revalidate happens on next build).
	void prisma.blogPost
		.update({
			where: { id: post.id },
			data: { views: { increment: 1 } },
		})
		.catch(() => {})

	const html = renderMarkdown(post.content)
	const plainExcerpt = post.excerpt || deriveExcerpt(post.content)

	// JSON-LD structured data for Google rich results.
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: post.title,
		description: post.seoDescription ?? plainExcerpt,
		datePublished: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
		dateModified: post.updatedAt.toISOString(),
		author: { '@type': 'Organization', name: 'Vigent' },
		publisher: {
			'@type': 'Organization',
			name: 'Vigent',
			url: 'https://vigent.ir',
		},
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/blog/${post.slug}`,
		},
		keywords: post.seoKeywords.join(', '),
		image: post.ogImage ?? post.coverImage ?? undefined,
	}

	// Breadcrumb JSON-LD
	const breadcrumbLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: locale === 'fa' ? 'خانه' : 'Home',
				item: process.env.NEXT_PUBLIC_APP_URL ?? '/',
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: locale === 'fa' ? 'بلاگ' : 'Blog',
				item: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/blog`,
			},
			{
				'@type': 'ListItem',
				position: 3,
				name: post.title,
				item: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/blog/${post.slug}`,
			},
		],
	}

	// Get prev/next posts for internal linking
	const [prev, next] = await Promise.all([
		post.publishedAt
			? prisma.blogPost.findFirst({
					where: {
						workspaceId: wsId,
						status: 'PUBLISHED',
						publishedAt: { lt: post.publishedAt },
					},
					orderBy: { publishedAt: 'desc' },
					select: { slug: true, title: true },
				})
			: null,
		post.publishedAt
			? prisma.blogPost.findFirst({
					where: {
						workspaceId: wsId,
						status: 'PUBLISHED',
						publishedAt: { gt: post.publishedAt },
					},
					orderBy: { publishedAt: 'asc' },
					select: { slug: true, title: true },
				})
			: null,
	])

	return (
		<article className="mx-auto max-w-3xl px-4 py-12">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
			/>

			{/* Breadcrumb */}
			<nav className="mb-6 flex items-center gap-2 text-xs text-[var(--text-muted)]">
				<Link href="/" className="hover:text-[var(--text-secondary)]">
					{locale === 'fa' ? 'خانه' : 'Home'}
				</Link>
				<span>/</span>
				<Link href="/blog" className="hover:text-[var(--text-secondary)]">
					{locale === 'fa' ? 'بلاگ' : 'Blog'}
				</Link>
				{post.category && (
					<>
						<span>/</span>
						<Link
							href={`/blog/category/${post.category.slug}`}
							className="hover:text-[var(--text-secondary)]"
						>
							{post.category.name}
						</Link>
					</>
				)}
			</nav>

			{/* Header */}
			<header className="mb-8">
				{post.category && (
					<Link
						href={`/blog/category/${post.category.slug}`}
						className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]"
					>
						{post.category.name}
					</Link>
				)}
				<h1 className="mt-2 text-3xl font-medium leading-tight text-[var(--text-primary)] sm:text-4xl">
					{post.title}
				</h1>
				<p className="mt-4 text-[var(--text-secondary)]">{plainExcerpt}</p>
				<div className="mt-5 flex items-center gap-4 text-xs text-[var(--text-muted)]">
					<span className="inline-flex items-center gap-1">
						<Calendar className="h-3.5 w-3.5" />
						{relativeTime(post.publishedAt ?? post.createdAt, locale)}
					</span>
					<span className="inline-flex items-center gap-1">
						<Clock className="h-3.5 w-3.5" />
						{locale === 'fa'
							? `${toPersianDigits(post.readingMinutes)} دقیقه مطالعه`
							: `${post.readingMinutes} min read`}
					</span>
				</div>
			</header>

			{post.coverImage && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={post.coverImage}
					alt={post.title}
					className="mb-8 aspect-[3/2] w-full rounded-2xl object-cover"
				/>
			)}

			{/* Body */}
			<div
				dir="auto"
				className="blog-content text-[15px] leading-8 text-[var(--text-primary)]"
				dangerouslySetInnerHTML={{ __html: html }}
			/>

			{/* Social follow bar — keep readers connected after they finish */}
			<div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:justify-between">
				<div>
					<p className="text-sm font-medium text-[var(--text-primary)]">
						{locale === 'fa' ? 'ما را دنبال کنید' : 'Follow us'}
					</p>
					<p className="mt-0.5 text-xs text-[var(--text-muted)]">
						{locale === 'fa'
							? 'جدیدترین مقالات و آموزش‌ها در اینستاگرام و تلگرام'
							: 'Latest articles and tutorials on Instagram and Telegram'}
					</p>
				</div>
				<SocialLinks variant="default" />
			</div>

			{/* Footer nav */}
			<footer className="mt-12 border-t border-[var(--border-default)] pt-6">
				<div className="grid gap-4 sm:grid-cols-2">
					{prev ? (
						<Link
							href={`/blog/${prev.slug}`}
							className="group flex items-center gap-3 rounded-xl border border-[var(--border-default)] p-3 hover:border-[var(--border-hover)]"
						>
							<ArrowRight className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
							<div>
								<div className="text-[10px] text-[var(--text-muted)]">
									{locale === 'fa' ? 'قبلی' : 'Previous'}
								</div>
								<div className="text-sm text-[var(--text-primary)]">{prev.title}</div>
							</div>
						</Link>
					) : (
						<div />
					)}
					{next ? (
						<Link
							href={`/blog/${next.slug}`}
							className="group flex items-center justify-end gap-3 rounded-xl border border-[var(--border-default)] p-3 text-end hover:border-[var(--border-hover)]"
						>
							<div>
								<div className="text-[10px] text-[var(--text-muted)]">
									{locale === 'fa' ? 'بعدی' : 'Next'}
								</div>
								<div className="text-sm text-[var(--text-primary)]">{next.title}</div>
							</div>
							<ArrowLeft className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
						</Link>
					) : (
						<div />
					)}
				</div>
			</footer>
		</article>
	)
}
