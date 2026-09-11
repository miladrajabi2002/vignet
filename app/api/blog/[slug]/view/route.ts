import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMainWorkspaceId } from '@/lib/blog/workspace'
import { tehranDayKey } from '@/lib/blog/daily-views'

// Counted per real page view from the ViewBeacon client component; must never
// be cached or the count would silently stop.
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, props: { params: Promise<{ slug: string }> }) {
	const { slug } = await props.params
	if (!slug) {
		return NextResponse.json({ error: 'BAD_SLUG' }, { status: 400 })
	}

	try {
		const wsId = await getMainWorkspaceId()
		if (!wsId) {
			return NextResponse.json({ ok: false }, { status: 200 })
		}

		// The per-day aggregate needs the post id, so resolve it first. A missing
		// post (new posts are rendered on demand and might race) simply reports
		// ok:false — the same semantics the updateMany-only version had.
		const post = await prisma.blogPost.findFirst({
			where: { workspaceId: wsId, slug, status: 'PUBLISHED' },
			select: { id: true },
		})
		if (!post) {
			return NextResponse.json(
				{ ok: false },
				{ status: 200, headers: { 'Cache-Control': 'no-store' } },
			)
		}

		const day = tehranDayKey()

		// One transaction: the total counter and the per-day aggregate stay in
		// sync even when two beacon POSTs for the same post race each other
		// (the upsert serialises on the (postId, day) unique constraint).
		await prisma.$transaction([
			prisma.blogPost.update({
				where: { id: post.id },
				data: { views: { increment: 1 } },
			}),
			prisma.blogPostDailyView.upsert({
				where: { postId_day: { postId: post.id, day } },
				create: { postId: post.id, day, count: 1 },
				update: { count: { increment: 1 } },
			}),
		])

		return NextResponse.json(
			{ ok: true },
			{ headers: { 'Cache-Control': 'no-store' } },
		)
	} catch {
		// Never let a cosmetic counter surface an error to the visitor.
		return NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
	}
}
