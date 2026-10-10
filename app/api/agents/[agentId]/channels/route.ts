import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { invalidateWidgetConfig } from '@/lib/widget/cache'
import { checkChannelConnectAllowed } from '@/lib/billing/entitlements'
import { enableWorkspaceCapability } from '@/lib/verticals/workspace-capabilities'

type Params = { params: Promise<{ agentId: string }> }

const bodySchema = z.object({
	type: z.enum([
		'TELEGRAM',
		'INSTAGRAM',
		'RUBIKA',
		'BALE',
		'WEB_WIDGET',
		'API',
	]),
	config: z.record(z.string(), z.unknown()).optional(),
})

async function ownAgent(workspaceId: string, agentId: string) {
	return prisma.agent.findFirst({
		where: { id: agentId, workspaceId },
		select: { id: true },
	})
}

export async function GET(_req: Request, props: Params) {
    const params = await props.params;
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    if (!(await ownAgent(user.workspaceId, params.agentId)))
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const channels = await prisma.agentChannel.findMany({
		where: { agentId: params.agentId },
		select: { id: true, type: true, active: true, createdAt: true },
	})
    return NextResponse.json({ channels })
}

export async function POST(req: Request, props: Params) {
    const params = await props.params;
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    if (!(await ownAgent(user.workspaceId, params.agentId)))
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

    const config = (parsed.data.config ?? {}) as Prisma.InputJsonValue

    const gate = await checkChannelConnectAllowed(user.workspaceId, {
      kind: 'AGENT_CHANNEL',
      agentId: params.agentId,
      type: parsed.data.type,
    })
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: 402 })
    }

    const channel = await prisma.agentChannel.upsert({
		where: { agentId_type: { agentId: params.agentId, type: parsed.data.type } },
		update: { active: true, config, healthStatus: 'unknown', healthError: null },
		create: {
			agentId: params.agentId,
			type: parsed.data.type,
			config,
		},
	})

    await syncOnboarding(user.workspaceId)

    // A connected Instagram account brings its section into the menu.
    if (parsed.data.type === 'INSTAGRAM') {
		await enableWorkspaceCapability(user.workspaceId, 'instagram').catch(() => {})
	}

    // Bust the cached public widget config so new visitors see the change.
    if (parsed.data.type === 'WEB_WIDGET') {
		void invalidateWidgetConfig(params.agentId).catch(() => {})
	}

    return NextResponse.json({ channel }, { status: 201 })
}
