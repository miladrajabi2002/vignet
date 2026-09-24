import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { trustedLogoSchema } from '@/lib/trusted-logo/validations'

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

	// Partial updates (e.g. toggling active) use the full schema with every
	// field optional so the admin manager can send just one field.
	const json = await req.json().catch(() => null)
	const partialSchema = trustedLogoSchema.partial()
	const parsed = partialSchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const input = parsed.data
	const { id } = await props.params
	try {
		const logo = await prisma.trustedLogo.update({
			where: { id },
			data: {
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
				...(input.url !== undefined ? { url: input.url || null } : {}),
				...(input.active !== undefined ? { active: input.active } : {}),
				...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
			},
		})
		return NextResponse.json({ logo })
	} catch {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}
}

export async function DELETE(_req: Request, props: Params) {
	const unauth = await guard()
	if (unauth) return unauth

	const { id } = await props.params
	try {
		await prisma.trustedLogo.delete({ where: { id } })
		return NextResponse.json({ ok: true })
	} catch {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}
}
