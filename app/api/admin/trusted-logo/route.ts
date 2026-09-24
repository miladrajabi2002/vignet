import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { trustedLogoSchema } from '@/lib/trusted-logo/validations'

export const dynamic = 'force-dynamic'

async function guard(): Promise<NextResponse | null> {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}
	return null
}

/** Full logo list for the admin manager (including inactive). */
export async function GET() {
	const unauth = await guard()
	if (unauth) return unauth

	const logos = await prisma.trustedLogo.findMany({
		orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
	})
	return NextResponse.json(
		{ logos },
		{ headers: { 'Cache-Control': 'no-store' } },
	)
}

export async function POST(req: Request) {
	const unauth = await guard()
	if (unauth) return unauth

	const json = await req.json().catch(() => null)
	const parsed = trustedLogoSchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const input = parsed.data
	const logo = await prisma.trustedLogo.create({
		data: {
			name: input.name,
			imageUrl: input.imageUrl || null,
			url: input.url || null,
			active: input.active,
			sortOrder: input.sortOrder,
		},
	})
	return NextResponse.json({ logo }, { status: 201 })
}
