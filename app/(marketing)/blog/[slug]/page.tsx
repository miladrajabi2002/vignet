import { notFound } from 'next/navigation'
import { getMainWorkspaceId as getWorkspaceId } from '@/lib/blog/workspace'
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
import { TrendSpark } from '@/components/blog/trend-spark'
import { jsonLdScript } from '@/lib/seo/json-ld'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
	params: Promise<{ slug: string }>
}


export async function generateMetadata(props: Props) {
    const params = await props.params;
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

export default async function PublicBlogPostPage(props: Props) {
    const params = await props.params;
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
        <article className="marketing-page-shell mx-auto min-h-screen max-w-6xl px-3 pb-24 pt-24 sm:px-5 sm:pt-28">
            <script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
			/>
            <script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }}
			/>
            {/* Header */}
			<header className="marketing-page-hero marketing-grid-dark mb-10 px-6 py-10 sm:px-9 sm:py-14">
				{post.category && (
					<Link
						href={`/blog/category/${post.category.slug}`}
					className="relative z-10 inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.06] px-3 text-[11px] font-medium text-white/65"
					>
						{post.category.name}
					</Link>
				)}
				<h1 className="relative z-10 mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.18] tracking-[-0.04em] text-white sm:text-5xl rtl:tracking-normal">
					{post.title}
				</h1>
				<p className="relative z-10 mt-5 max-w-3xl text-[15px] leading-8 text-white/50">{plainExcerpt}</p>
				<div className="relative z-10 mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
					<div className="flex flex-wrap items-center gap-4 text-xs text-white/35">
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
					<div className="rounded-full bg-white px-3 py-1"><TrendSpark seed={post.id} width={80} height={26} /></div>
				</div>
			</header>
            {post.coverImage && (
				// eslint-disable-next-line @next/next/no-img-element
				(<img
					src={post.coverImage}
					alt={post.title}
					loading="eager"
					decoding="async"
					className="mx-auto mb-10 aspect-[16/10] w-full max-w-5xl rounded-[1.75rem] border border-black/10 object-cover shadow-[0_22px_65px_rgba(0,0,0,0.12)]"
				/>)
			)}
            {/* Body */}
            <div
				dir={locale === 'fa' ? 'rtl' : 'ltr'}
				className={`blog-content mx-auto max-w-3xl rounded-[1.75rem] border border-black/[0.07] bg-white p-5 text-[15px] leading-8 text-[var(--text-primary)] shadow-[0_14px_45px_rgba(0,0,0,0.055)] sm:p-8 ${locale === 'fa' ? 'text-right' : 'text-left'}`}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
            {/* Social follow bar — keep readers connected after they finish */}
            <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[0_10px_35px_rgba(0,0,0,0.05)] sm:flex-row sm:justify-between">
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
            <footer className="mx-auto mt-12 max-w-3xl border-t border-[var(--border-default)] pt-6">
				<div className="grid gap-4 sm:grid-cols-2">
					{prev ? (
						<Link
							href={`/blog/${prev.slug}`}
							className="group flex items-center gap-3 rounded-xl border border-[var(--border-default)] p-3 hover:border-[var(--border-hover)]"
						>
							<ArrowRight className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
							<div>
								<div className="text-[11px] text-[var(--text-muted)]">
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
								<div className="text-[11px] text-[var(--text-muted)]">
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
    );
}
