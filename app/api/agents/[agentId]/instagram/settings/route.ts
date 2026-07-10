import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

const REPLY_POLICIES = [
	'ALL_AGENT',
	'AGENT_EXCEPT_SCENARIOS',
	'AUTOMATION_ONLY',
] as const

const patchSchema = z.object({
	replyPolicy: z.enum(REPLY_POLICIES).optional(),
	dmReplyPolicy: z.enum(REPLY_POLICIES).optional(),
	storyReplyPolicy: z.enum(REPLY_POLICIES).optional(),
	commentReplyPolicy: z.enum(REPLY_POLICIES).optional(),
	stopWords: z.array(z.string()).optional(),
	welcomeMessage: z.string().nullable().optional(),
	followUpEnabled: z.boolean().optional(),
	followUpDelayMin: z.number().int().min(1).max(60 * 24 * 7).optional(),
	followUpMessage: z.string().nullable().optional(),
	aiEnabled: z.boolean().optional(),
	storyReactionReplyEnabled: z.boolean().optional(),
	storyReactionReplyText: z.string().trim().min(1).nullable().optional(),
	commentEmojiReplyEnabled: z.boolean().optional(),
	commentEmojiReplyText: z.string().trim().min(1).nullable().optional(),
	likeDmAfterReply: z.boolean().optional(),
	likeStoryReplyAfterReply: z.boolean().optional(),
	likeStoryReactionAfterReply: z.boolean().optional(),
	likeCommentAfterReply: z.boolean().optional(),
})

/** Default settings row, returned by GET when no row exists yet. */
function defaultSettings(agentId: string, channelId: string) {
	return {
		agentId,
		channelId,
		replyPolicy: 'AGENT_EXCEPT_SCENARIOS' as const,
		dmReplyPolicy: 'AGENT_EXCEPT_SCENARIOS' as const,
		storyReplyPolicy: 'AGENT_EXCEPT_SCENARIOS' as const,
		commentReplyPolicy: 'AGENT_EXCEPT_SCENARIOS' as const,
		stopWords: [],
		welcomeMessage: null,
		followUpEnabled: false,
		followUpDelayMin: 60,
		followUpMessage: null,
		aiEnabled: true,
		storyReactionReplyEnabled: false,
		storyReactionReplyText: null,
		commentEmojiReplyEnabled: false,
		commentEmojiReplyText: null,
		likeDmAfterReply: false,
		likeStoryReplyAfterReply: false,
		likeStoryReactionAfterReply: false,
		likeCommentAfterReply: false,
	}
}

/** Return the channel-level Instagram automation settings (or defaults). */
export async function GET(_req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user)
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const agent = await prisma.agent.findFirst({
		where: { id: params.agentId, workspaceId: user.workspaceId },
		select: {
			id: true,
			channels: {
				where: { type: 'INSTAGRAM' },
				select: { id: true },
			},
		},
	})
	if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	const igChannel = agent.channels[0]
	if (!igChannel)
		return NextResponse.json(
			{ settings: defaultSettings(agent.id, ''), connected: false },
		)

	const row = await prisma.instagramAutomationSettings.findUnique({
		where: { agentId: agent.id },
	})
	if (!row) {
		return NextResponse.json({
			settings: defaultSettings(agent.id, igChannel.id),
			connected: true,
		})
	}
	return NextResponse.json({ settings: row, connected: true })
}

/**
 * Upsert the channel-level Instagram automation settings.
 *
 * On the first PATCH we create the row (the channelId is stamped from the
 * agent's INSTAGRAM AgentChannel). Subsequent PATCHes merge partial updates.
 */
export async function PATCH(req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user)
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const agent = await prisma.agent.findFirst({
		where: { id: params.agentId, workspaceId: user.workspaceId },
		select: {
			id: true,
			channels: {
				where: { type: 'INSTAGRAM' },
				select: { id: true },
			},
		},
	})
	if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	const igChannel = agent.channels[0]
	if (!igChannel)
		return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

	const json = await req.json().catch(() => null)
	const parsed = patchSchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	// Normalize nullable clears — convert undefined→skip, null→clear.
	const data: Record<string, unknown> = {}
	const d = parsed.data
	const currentFixedReplies = await prisma.instagramAutomationSettings.findUnique({
		where: { agentId: agent.id },
		select: {
			storyReactionReplyEnabled: true,
			storyReactionReplyText: true,
			commentEmojiReplyEnabled: true,
			commentEmojiReplyText: true,
		},
	})
	const storyFixedEnabled = d.storyReactionReplyEnabled ?? currentFixedReplies?.storyReactionReplyEnabled ?? false
	const storyFixedText = d.storyReactionReplyText !== undefined
		? d.storyReactionReplyText
		: currentFixedReplies?.storyReactionReplyText
	const commentFixedEnabled = d.commentEmojiReplyEnabled ?? currentFixedReplies?.commentEmojiReplyEnabled ?? false
	const commentFixedText = d.commentEmojiReplyText !== undefined
		? d.commentEmojiReplyText
		: currentFixedReplies?.commentEmojiReplyText
	if ((storyFixedEnabled && !storyFixedText?.trim()) || (commentFixedEnabled && !commentFixedText?.trim())) {
		return NextResponse.json({ error: 'FIXED_REPLY_TEXT_REQUIRED' }, { status: 400 })
	}
	if (d.replyPolicy !== undefined) {
		data.replyPolicy = d.replyPolicy
		// Backwards-compatible clients only know the legacy global field. Fan it
		// out unless the same PATCH explicitly supplies a per-kind override.
		if (d.dmReplyPolicy === undefined) data.dmReplyPolicy = d.replyPolicy
		if (d.storyReplyPolicy === undefined) data.storyReplyPolicy = d.replyPolicy
		if (d.commentReplyPolicy === undefined) data.commentReplyPolicy = d.replyPolicy
	}
	if (d.dmReplyPolicy !== undefined) data.dmReplyPolicy = d.dmReplyPolicy
	if (d.storyReplyPolicy !== undefined) data.storyReplyPolicy = d.storyReplyPolicy
	if (d.commentReplyPolicy !== undefined) data.commentReplyPolicy = d.commentReplyPolicy
	if (d.stopWords !== undefined) data.stopWords = d.stopWords
	if (d.welcomeMessage !== undefined)
		data.welcomeMessage = d.welcomeMessage ?? null
	if (d.followUpEnabled !== undefined) data.followUpEnabled = d.followUpEnabled
	if (d.followUpDelayMin !== undefined)
		data.followUpDelayMin = d.followUpDelayMin
	if (d.followUpMessage !== undefined)
		data.followUpMessage = d.followUpMessage ?? null
	if (d.aiEnabled !== undefined) data.aiEnabled = d.aiEnabled
	for (const key of [
		'storyReactionReplyEnabled', 'storyReactionReplyText',
		'commentEmojiReplyEnabled', 'commentEmojiReplyText',
		'likeDmAfterReply', 'likeStoryReplyAfterReply',
		'likeStoryReactionAfterReply', 'likeCommentAfterReply',
	] as const) {
		if (d[key] !== undefined) data[key] = d[key]
	}

	const upserted = await prisma.instagramAutomationSettings.upsert({
		where: { agentId: agent.id },
		create: {
			agentId: agent.id,
			channelId: igChannel.id,
			replyPolicy:
				(data.replyPolicy as string | undefined) ?? 'AGENT_EXCEPT_SCENARIOS',
			dmReplyPolicy: (data.dmReplyPolicy as string | undefined) ?? (data.replyPolicy as string | undefined) ?? 'AGENT_EXCEPT_SCENARIOS',
			storyReplyPolicy: (data.storyReplyPolicy as string | undefined) ?? (data.replyPolicy as string | undefined) ?? 'AGENT_EXCEPT_SCENARIOS',
			commentReplyPolicy: (data.commentReplyPolicy as string | undefined) ?? (data.replyPolicy as string | undefined) ?? 'AGENT_EXCEPT_SCENARIOS',
			stopWords: (data.stopWords as string[] | undefined) ?? [],
			welcomeMessage: (data.welcomeMessage as string | null | undefined) ?? null,
			followUpEnabled: (data.followUpEnabled as boolean | undefined) ?? false,
			followUpDelayMin: (data.followUpDelayMin as number | undefined) ?? 60,
			followUpMessage: (data.followUpMessage as string | null | undefined) ?? null,
			aiEnabled: (data.aiEnabled as boolean | undefined) ?? true,
			storyReactionReplyEnabled: (data.storyReactionReplyEnabled as boolean | undefined) ?? false,
			storyReactionReplyText: (data.storyReactionReplyText as string | null | undefined) ?? null,
			commentEmojiReplyEnabled: (data.commentEmojiReplyEnabled as boolean | undefined) ?? false,
			commentEmojiReplyText: (data.commentEmojiReplyText as string | null | undefined) ?? null,
			likeDmAfterReply: (data.likeDmAfterReply as boolean | undefined) ?? false,
			likeStoryReplyAfterReply: (data.likeStoryReplyAfterReply as boolean | undefined) ?? false,
			likeStoryReactionAfterReply: (data.likeStoryReactionAfterReply as boolean | undefined) ?? false,
			likeCommentAfterReply: (data.likeCommentAfterReply as boolean | undefined) ?? false,
		},
		update: data,
	})
	return NextResponse.json({ settings: upserted })
}
