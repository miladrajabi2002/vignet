import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { blogPostSchema } from '@/lib/blog/validations'
import { slugify, readingMinutes, deriveExcerpt } from '@/lib/blog/helpers'
import { getMainWorkspaceId } from '@/lib/blog/workspace'

export const dynamic = 'force-dynamic'

function guard(): NextResponse | null {
	if (!isAdminAuthed()) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}
	return null
}

export async function GET() {
	const unauth = guard()
	if (unauth) return unauth

	const posts = await prisma.blogPost.findMany({
		orderBy: { updatedAt: 'desc' },
		include: {
			category: { select: { name: true, slug: true } },
			workspace: { select: { id: true, name: true } },
		},
		take: 200,
	})
	return NextResponse.json({ posts })
}

export async function POST(req: Request) {
	const unauth = guard()
	if (unauth) return unauth

	const json = await req.json().catch(() => null)
	const parsed = blogPostSchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	// وبلاگ متعلق به سایت اصلی است — workspace خودکار انتخاب می‌شود.
	const workspaceId = await getMainWorkspaceId()
	if (!workspaceId) {
		return NextResponse.json({ error: 'NO_WORKSPACE' }, { status: 500 })
	}

	const input = parsed.data
	const slug = slugify(input.slug || input.title)
	const excerpt = input.excerpt?.trim() || deriveExcerpt(input.content)
	const readingMins = readingMinutes(input.content)
	const publishedAt =
		input.status === 'PUBLISHED'
			? input.publishedAt
				? new Date(input.publishedAt)
				: new Date()
			: input.publishedAt
				? new Date(input.publishedAt)
				: null

	try {
		const post = await prisma.blogPost.create({
			data: {
				workspaceId,
				categoryId: input.categoryId || null,
				title: input.title,
				slug,
				excerpt,
				content: input.content,
				coverImage: input.coverImage || null,
				status: input.status,
				seoTitle: input.seoTitle || null,
				seoDescription: input.seoDescription || null,
				seoKeywords: input.seoKeywords,
				canonicalUrl: input.canonicalUrl || null,
				ogImage: input.ogImage || input.coverImage || null,
				featured: input.featured,
				readingMinutes: readingMins,
				publishedAt,
			},
		})
		return NextResponse.json({ post })
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'unknown'
		if (msg.includes('unique')) {
			return NextResponse.json(
				{ error: 'SLUG_TAKEN', message: 'این slug قبلاً استفاده شده.' },
				{ status: 409 },
			)
		}
		return NextResponse.json({ error: 'CREATE_FAILED', message: msg }, { status: 500 })
	}
}
