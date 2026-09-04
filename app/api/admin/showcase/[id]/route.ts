import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { showcaseEntrySchema } from '@/lib/showcase/validations'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function guard(): Promise<NextResponse | null> {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}
	return null
}

export async function PATCH(req: Request, props: Params) {
	const unauth = await guard()
	if (unauth) return unauth

	const { id } = await props.params
	const json = await req.json().catch(() => null)
	const parsed = showcaseEntrySchema.partial().safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const input = parsed.data
	try {
		const entry = await prisma.showcaseEntry.update({
			where: { id },
			data: {
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.handle !== undefined
					? { handle: input.handle ? input.handle.replace(/^@/, '') : null }
					: {}),
				...(input.url !== undefined ? { url: input.url || null } : {}),
				...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
				...(input.channels !== undefined ? { channels: input.channels } : {}),
				...(input.quote !== undefined ? { quote: input.quote || null } : {}),
				...(input.metricValue !== undefined ? { metricValue: input.metricValue || null } : {}),
				...(input.metricLabel !== undefined ? { metricLabel: input.metricLabel || null } : {}),
				...(input.featured !== undefined ? { featured: input.featured } : {}),
				...(input.active !== undefined ? { active: input.active } : {}),
				...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
			},
		})
		return NextResponse.json({ entry })
	} catch {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}
}

export async function DELETE(_req: Request, props: Params) {
	const unauth = await guard()
	if (unauth) return unauth

	const { id } = await props.params
	try {
		await prisma.showcaseEntry.delete({ where: { id } })
		return NextResponse.json({ ok: true })
	} catch {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}
}
