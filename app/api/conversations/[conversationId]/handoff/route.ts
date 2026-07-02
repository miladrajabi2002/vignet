import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ChannelType } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
	createHandoffAlert,
	getConnectedMessengerChannels,
} from '@/lib/channels/operator-handoff'

type Params = { params: { conversationId: string } }

const bodySchema = z.object({
	reason: z.string().min(1).max(500).optional(),
})

/**
 * POST /api/conversations/:conversationId/handoff — manually escalate a
 * conversation to a human operator (operator-initiated). Creates a
 * HandoffAlert with the contact snapshot, flips conversation.status to
 * HANDED_OFF, and returns the connected messenger channels so the UI can
 * show "go to Telegram/Bale/Rubika" buttons.
 */
export async function POST(req: Request, { params }: Params) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const conversation = await prisma.conversation.findFirst({
		where: { id: params.conversationId, workspaceId: user.workspaceId },
		select: {
			id: true,
			agentId: true,
			channel: true,
			summary: true,
			contact: { select: { name: true, phone: true, id: true } },
			agent: { select: { name: true } },
		},
	})
	if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json ?? {})
	if (!parsed.success) {
		return NextResponse.json({ error: 'INVALID', issues: parsed.error.flatten() }, { status: 400 })
	}
	const reason = parsed.data.reason ?? 'انتقال دستی توسط اپراتور'

	const alertId = await createHandoffAlert({
		workspaceId: user.workspaceId,
		conversationId: conversation.id,
		agentId: conversation.agentId,
		agentName: conversation.agent.name,
		channel: conversation.channel as ChannelType,
		contactId: conversation.contact?.id ?? null,
		contactName: conversation.contact?.name ?? null,
		contactPhone: conversation.contact?.phone ?? null,
		reason,
		summary: conversation.summary ?? null,
	})

	await prisma.conversation.update({
		where: { id: conversation.id },
		data: { status: 'HANDED_OFF', handedOff: true },
	})

	const connectedChannels = await getConnectedMessengerChannels(conversation.agentId)

	return NextResponse.json({ ok: true, alertId, connectedChannels }, { status: 201 })
}
