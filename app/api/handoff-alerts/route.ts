import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/handoff-alerts — list open handoff alerts for the workspace.
 *
 * Returns alerts with state in ['open', 'claimed'], newest first, capped at 50.
 * Includes the conversation (id, channel, contact name/phone) and the agent
 * name so the dashboard inbox can render a triage list without extra queries.
 */
export async function GET() {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const alerts = await prisma.handoffAlert.findMany({
		where: {
			workspaceId: user.workspaceId,
			state: { in: ['open', 'claimed'] },
		},
		orderBy: { createdAt: 'desc' },
		take: 50,
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
			createdAt: true,
			resolvedAt: true,
			externalMessageId: true,
			conversation: {
				select: {
					id: true,
					channel: true,
					status: true,
					contact: { select: { name: true, phone: true } },
				},
			},
			agent: { select: { id: true, name: true } },
		},
	})

	return NextResponse.json({ alerts })
}
