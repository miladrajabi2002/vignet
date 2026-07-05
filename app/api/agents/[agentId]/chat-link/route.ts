import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
	normalizeChatLinkSettings,
	normalizeSlug,
	chatLinkUrl,
} from '@/lib/chat-link/config'

type Params = { params: Promise<{ agentId: string }> }

const putSchema = z.object({
	slug: z.string().min(3).max(32),
	enabled: z.boolean().optional(),
	settings: z.record(z.string(), z.unknown()).optional(),
})

async function ownAgent(workspaceId: string, agentId: string) {
	return prisma.agent.findFirst({
		where: { id: agentId, workspaceId },
		select: { id: true },
	})
}

export async function GET(_req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	if (!(await ownAgent(user.workspaceId, params.agentId)))
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const link = await prisma.chatLink.findUnique({
		where: { agentId: params.agentId },
		select: { slug: true, enabled: true, settings: true, views: true },
	})
	if (!link) return NextResponse.json({ link: null })
	return NextResponse.json({
		link: {
			slug: link.slug,
			enabled: link.enabled,
			settings: normalizeChatLinkSettings(link.settings),
			views: link.views,
			url: chatLinkUrl(link.slug),
		},
	})
}

export async function PUT(req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	if (!(await ownAgent(user.workspaceId, params.agentId)))
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const json = await req.json().catch(() => null)
	const parsed = putSchema.safeParse(json)
	if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

	const slug = normalizeSlug(parsed.data.slug)
	if (!slug) return NextResponse.json({ error: 'INVALID_SLUG' }, { status: 400 })

	// Slug is globally unique — reject if another agent already owns it.
	const clash = await prisma.chatLink.findUnique({
		where: { slug },
		select: { agentId: true },
	})
	if (clash && clash.agentId !== params.agentId) {
		return NextResponse.json({ error: 'SLUG_TAKEN' }, { status: 409 })
	}

	const settings = normalizeChatLinkSettings(parsed.data.settings)
	const enabled = parsed.data.enabled ?? true

	const link = await prisma.chatLink.upsert({
		where: { agentId: params.agentId },
		update: { slug, enabled, settings: settings as unknown as Prisma.InputJsonValue },
		create: {
			agentId: params.agentId,
			workspaceId: user.workspaceId,
			slug,
			enabled,
			settings: settings as unknown as Prisma.InputJsonValue,
		},
		select: { slug: true, enabled: true, settings: true, views: true },
	})

	return NextResponse.json({
		link: {
			slug: link.slug,
			enabled: link.enabled,
			settings: normalizeChatLinkSettings(link.settings),
			views: link.views,
			url: chatLinkUrl(link.slug),
		},
	})
}

export async function DELETE(_req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	if (!(await ownAgent(user.workspaceId, params.agentId)))
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	await prisma.chatLink.deleteMany({ where: { agentId: params.agentId } })
	return NextResponse.json({ ok: true })
}
