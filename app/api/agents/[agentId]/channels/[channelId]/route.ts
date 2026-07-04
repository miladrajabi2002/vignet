import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { invalidateWidgetConfig } from '@/lib/widget/cache'
import { normalizeMessengerSettings } from '@/lib/channels/config'
import { isMessengerType } from '@/lib/channels/registry'

type Params = { params: Promise<{ agentId: string; channelId: string }> }

const settingsSchema = z.object({
	quickReplies: z.array(z.string().max(40)).max(4),
})

/**
 * Update a messenger channel's behavior settings (config.settings), preserving
 * the credential fields (botTokenEnc / webhookToken) untouched.
 */
export async function PATCH(req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const channel = await prisma.agentChannel.findFirst({
		where: {
			id: params.channelId,
			agentId: params.agentId,
			agent: { workspaceId: user.workspaceId },
		},
		select: { id: true, type: true, config: true },
	})
	if (!channel) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	if (!isMessengerType(channel.type)) {
		return NextResponse.json({ error: 'UNSUPPORTED' }, { status: 400 })
	}

	const json = await req.json().catch(() => null)
	const parsed = settingsSchema.safeParse(json)
	if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

	const existing =
		channel.config && typeof channel.config === 'object'
			? (channel.config as Record<string, unknown>)
			: {}
	const merged = { ...existing, settings: parsed.data }
	// Re-normalize so only known keys with sane bounds are persisted.
	const settings = normalizeMessengerSettings(merged as Prisma.JsonValue)

	await prisma.agentChannel.update({
		where: { id: channel.id },
		data: { config: { ...existing, settings } as unknown as Prisma.InputJsonValue },
	})

	return NextResponse.json({ ok: true, settings })
}

export async function DELETE(_req: Request, props: Params) {
    const params = await props.params;
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const channel = await prisma.agentChannel.findFirst({
		where: {
			id: params.channelId,
			agentId: params.agentId,
			agent: { workspaceId: user.workspaceId },
		},
		select: { id: true, type: true },
	})
    if (!channel) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    await prisma.agentChannel.delete({ where: { id: channel.id } })
    await syncOnboarding(user.workspaceId)

    // Bust widget cache if we just removed a WEB_WIDGET channel.
    if (channel.type === 'WEB_WIDGET') {
		void invalidateWidgetConfig(params.agentId).catch(() => {})
	}

    return NextResponse.json({ ok: true })
}
