import { deriveExcerpt, stripMarkdown } from '@/lib/blog/helpers'
import type { PublicPost } from '@/components/blog/public-post-card'

type PostRow = Omit<PublicPost, 'excerpt'> & {
	excerpt: string | null
	content: string
}

export type SearchablePublicPost = PublicPost & { searchText: string }

// Enough of the article for the live search on /blog to match its topic.
// Sending whole bodies made the index page's RSC payload ~140 KB larger
// (every article, serialized into the HTML) for a search box.
const SEARCH_BODY_CHARS = 600

/** Card data for public listings; drops the article body. */
export function toPublicPost(post: PostRow): PublicPost {
	return {
		id: post.id,
		slug: post.slug,
		title: post.title,
		excerpt: post.excerpt?.trim() || deriveExcerpt(post.content),
		coverImage: post.coverImage,
		readingMinutes: post.readingMinutes,
		publishedAt: post.publishedAt,
		createdAt: post.createdAt,
		category: post.category,
	}
}

/** Card data plus a compact search index: headings and the opening of the body. */
export function toSearchablePublicPost(post: PostRow): SearchablePublicPost {
	const headings = post.content
		.split('\n')
		.filter((line) => /^#{1,6}\s/.test(line))
		.map((line) => line.replace(/^#{1,6}\s+/, ''))
		.join(' ')
	return {
		...toPublicPost(post),
		searchText: `${headings} ${stripMarkdown(post.content).slice(0, SEARCH_BODY_CHARS)}`,
	}
}
