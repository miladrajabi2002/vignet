import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMainWorkspaceId } from '@/lib/blog/workspace'

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

                // updateMany keeps this a single statement and cannot throw on a
                // missing post (new posts are rendered on demand and might race).
                const result = await prisma.blogPost.updateMany({
                        where: { workspaceId: wsId, slug, status: 'PUBLISHED' },
                        data: { views: { increment: 1 } },
                })

                return NextResponse.json(
                        { ok: result.count > 0 },
                        { headers: { 'Cache-Control': 'no-store' } },
                )
        } catch {
                // Never let a cosmetic counter surface an error to the visitor.
                return NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
        }
}
