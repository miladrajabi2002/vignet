'use client'

import Link from 'next/link'
import { useDeferredValue, useState } from 'react'
import { Search, X } from 'lucide-react'
import { PublicPostCard } from '@/components/blog/public-post-card'
import type { SearchablePublicPost } from '@/lib/blog/public-post'

type BlogCategory = {
	id: string
	name: string
	slug: string
}

function normalizeSearch(value: string) {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/ي/g, 'ی')
		.replace(/ك/g, 'ک')
		.replace(/\s+/g, ' ')
}

export function PublicBlogIndex({
	posts,
	categories,
	locale,
}: {
	posts: SearchablePublicPost[]
	categories: BlogCategory[]
	locale: 'fa' | 'en'
}) {
	const [query, setQuery] = useState('')
	const deferredQuery = useDeferredValue(query)
	const normalizedQuery = normalizeSearch(deferredQuery)
	const filteredPosts = normalizedQuery
		? posts.filter((post) =>
				normalizeSearch(
					`${post.title} ${post.excerpt} ${post.searchText} ${post.category?.name ?? ''}`,
				).includes(normalizedQuery),
			)
		: posts
	const [featured, ...rest] = filteredPosts
	const searchLabel = locale === 'fa' ? 'جست‌وجوی زنده در مقالات' : 'Live search articles'

	return (
		<>
			<div className="mb-6 rounded-card border border-black/[0.08] bg-white p-2 shadow-[var(--elev-1)] sm:flex sm:items-center sm:gap-3 sm:p-3">
				<label className="relative block min-w-0 flex-1">
					<span className="sr-only">{searchLabel}</span>
					<Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchLabel}
						className="min-h-12 w-full rounded-xl border border-black/[0.07] bg-black/[0.025] ps-11 pe-11 text-base text-black outline-none transition-[border-color,background-color,box-shadow] placeholder:text-black/40 focus:border-black/20 focus:bg-white focus:ring-2 focus:ring-black/10"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery('')}
							aria-label={locale === 'fa' ? 'پاک کردن جست‌وجو' : 'Clear search'}
							className="absolute end-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>
					)}
				</label>
				<p className="px-3 py-2 text-xs text-[var(--text-muted)] sm:shrink-0 sm:py-0" aria-live="polite">
					{locale === 'fa'
						? `${filteredPosts.length.toLocaleString('fa-IR')} مقاله`
						: `${filteredPosts.length} articles`}
				</p>
			</div>

			{categories.length > 0 && (
				<nav
					aria-label={locale === 'fa' ? 'دسته‌بندی مقالات' : 'Article categories'}
					className="-mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
				>
					<Link href="/blog" aria-current="page" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-black px-4 text-xs font-semibold text-white">
						{locale === 'fa' ? 'همه' : 'All'}
					</Link>
					{categories.map((category) => (
						<Link
							key={category.id}
							href={`/blog/category/${category.slug}`}
							className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/10 bg-white px-4 text-xs text-[var(--text-secondary)] transition-colors hover:border-black/20 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
						>
							{category.name}
						</Link>
					))}
				</nav>
			)}

			{!featured ? (
				<div className="rounded-card border border-dashed border-black/15 bg-[#f7f7f5] px-5 py-16 text-center text-[var(--text-muted)]">
					<p className="text-sm font-medium text-[var(--text-secondary)]">
						{normalizedQuery
							? locale === 'fa' ? 'مقاله‌ای با این عبارت پیدا نشد.' : 'No article matches this search.'
							: locale === 'fa' ? 'هنوز پستی منتشر نشده است.' : 'No posts published yet.'}
					</p>
					{normalizedQuery && (
						<button type="button" onClick={() => setQuery('')} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-black px-5 text-xs font-semibold text-white">
							{locale === 'fa' ? 'پاک کردن جست‌وجو' : 'Clear search'}
						</button>
					)}
				</div>
			) : (
				<div className="space-y-5">
					<PublicPostCard post={featured} locale={locale} featured />
					{rest.length > 0 && (
						<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
							{rest.map((post) => <PublicPostCard key={post.id} post={post} locale={locale} />)}
						</div>
					)}
				</div>
			)}
		</>
	)
}
