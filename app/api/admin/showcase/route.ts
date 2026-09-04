import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { showcaseEntrySchema } from '@/lib/showcase/validations'

export const dynamic = 'force-dynamic'

async function guard(): Promise<NextResponse | null> {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}
	return null
}

/** Full list for the admin manager (including inactive). */
export async function GET() {
	const unauth = await guard()
	if (unauth) return unauth

	const entries = await prisma.showcaseEntry.findMany({
		orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
	})
	return NextResponse.json(
		{ entries },
		{ headers: { 'Cache-Control': 'no-store' } },
	)
}

export async function POST(req: Request) {
	const unauth = await guard()
	if (unauth) return unauth

	const json = await req.json().catch(() => null)
	const parsed = showcaseEntrySchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const input = parsed.data
	const entry = await prisma.showcaseEntry.create({
		data: {
			name: input.name,
			handle: input.handle ? input.handle.replace(/^@/, '') : null,
			url: input.url || null,
			imageUrl: input.imageUrl || null,
			channels: input.channels,
			quote: input.quote || null,
			metricValue: input.metricValue || null,
			metricLabel: input.metricLabel || null,
			featured: input.featured,
			active: input.active,
			sortOrder: input.sortOrder,
		},
	})
	return NextResponse.json({ entry }, { status: 201 })
}
