import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: { alertId: string } }

const patchSchema = z.object({
	state: z.enum(['open', 'claimed', 'resolved']).optional(),
	claimedBy: z.string().max(128).optional(),
})

/**
 *   GET    /api/handoff-alerts/:id  — single alert with full snapshot.
 *   PATCH  /api/handoff-alerts/:id  — update state / claimedBy. When state
 *                                      transitions to 'resolved', sets
 *                                      resolvedAt automatically.
 */
export async function GET(_req: Request, { params }: Params) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const alert = await prisma.handoffAlert.findFirst({
		where: { id: params.alertId, workspaceId: user.workspaceId },
		select: {
			id: true,
			conversationId: true,
			agentId: true,
			contactName: true,
			contactPhone: true,
			channel: true,
			reason: true,
			summary: true,
			state: true,
			claimedBy: true,
			externalMessageId: true,
			createdAt: true,
			resolvedAt: true,
			conversation: {
				select: {
					id: true,
					channel: true,
					status: true,
					summary: true,
					contact: { select: { name: true, phone: true } },
				},
			},
			agent: { select: { id: true, name: true } },
		},
	})
	if (!alert) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	return NextResponse.json({ alert })
}

export async function PATCH(req: Request, { params }: Params) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const existing = await prisma.handoffAlert.findFirst({
		where: { id: params.alertId, workspaceId: user.workspaceId },
		select: { id: true, state: true },
	})
	if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const json = await req.json().catch(() => null)
	const parsed = patchSchema.safeParse(json ?? {})
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', issues: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const data: {
		state?: 'open' | 'claimed' | 'resolved'
		claimedBy?: string | null
		resolvedAt?: Date | null
	} = {}
	if (parsed.data.state) data.state = parsed.data.state
	if (parsed.data.claimedBy !== undefined) {
		data.claimedBy = parsed.data.claimedBy ?? null
	}
	if (parsed.data.state === 'resolved' && existing.state !== 'resolved') {
		data.resolvedAt = new Date()
	}

	const alert = await prisma.handoffAlert.update({
		where: { id: existing.id },
		data,
		select: {
			id: true,
			state: true,
			claimedBy: true,
			resolvedAt: true,
		},
	})

	return NextResponse.json({ alert })
}
