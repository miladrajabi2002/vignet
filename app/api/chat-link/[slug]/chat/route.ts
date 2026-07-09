import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { startChat } from '@/lib/ai/chat-engine'
import { normalizeChatLinkSettings } from '@/lib/chat-link/config'
import { stripProductTokens } from '@/lib/widget/config'

type Params = { params: Promise<{ slug: string }> }

const bodySchema = z.object({
	message: z.string().min(1).max(4000),
	conversationId: z.string().nullish(),
	// Pre-chat lead form (sent with the first message when lead capture is on).
	visitorName: z.string().max(60).nullish(),
	visitorPhone: z.string().max(30).nullish(),
	// Quote/reply-to: id of a previous message the visitor is replying to.
	replyToMessageId: z.string().nullish(),
})

/**
 * GET — fetch the persisted message history for a conversation.
 *
 * This lets the public /c/[slug] page restore the transcript after a refresh
 * or a tab close (the client stores a local copy too, but this is the source
 * of truth — works across devices and survives localStorage being cleared).
 *
 * Query: ?conversationId=<cuid>
 * Returns: { messages: [{ id, role: 'USER'|'ASSISTANT', content }] }
 */
export async function GET(req: Request, props: Params) {
	const params = await props.params
	const url = new URL(req.url)
	const conversationId = url.searchParams.get('conversationId')
	if (!conversationId) {
		return NextResponse.json({ error: 'INVALID' }, { status: 400 })
	}

	// Resolve the chat link → its agent, then verify the conversation belongs
	// to that agent (so a visitor can't read another link's messages by
	// guessing a conversationId).
	const link = await prisma.chatLink.findUnique({
		where: { slug: params.slug },
		select: { id: true, agentId: true },
	})
	if (!link) {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}

	const conversation = await prisma.conversation.findFirst({
		where: {
			id: conversationId,
			agentId: link.agentId,
			channel: 'CHAT_LINK',
		},
		select: {
			id: true,
			messages: {
				orderBy: { createdAt: 'asc' },
				take: 100,
				select: {
					id: true,
					role: true,
					content: true,
					parentId: true,
					parent: { select: { content: true } },
				},
			},
		},
	})
	if (!conversation) {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}

	const messages = conversation.messages
		.filter((m) => m.role !== 'SYSTEM')
		.map((m) => ({
			id: m.id,
			role: m.role === 'USER' ? 'user' : 'assistant',
			content: stripProductTokens(m.content),
			parentId: m.parentId ?? null,
			parentContent: m.parent?.content
				? m.parent.content.slice(0, 200)
				: null,
		}))

	return NextResponse.json({ messages })
}

// Public standalone chat page (/c/[slug]) — same engine as the web widget but
// addressed by slug, so the agent id never appears in the shareable URL.
export async function POST(req: Request, props: Params) {
	const params = await props.params
	const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'

	// Public endpoint → fail closed if Redis is down (an open limiter here lets
	// anyone drain the workspace's OpenRouter credit).
	const allowed = await rateLimit(`chatlink:${params.slug}:${ip}`, 20, 60, {
		failClosed: true,
	})
	if (!allowed) {
		return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
	}

	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json({ error: 'INVALID' }, { status: 400 })
	}

	const link = await prisma.chatLink.findUnique({
		where: { slug: params.slug },
		select: {
			enabled: true,
			settings: true,
			agent: {
				select: {
					id: true,
					workspaceId: true,
					active: true,
					systemPrompt: true,
					language: true,
					model: true,
					temperature: true,
					maxTokens: true,
					fallbackMessage: true,
					handoffEnabled: true,
					handoffMessage: true,
					handoffKeywords: true,
					promptConfig: true,
					roleTemplate: true,
					requireCustomerInfo: true,
					customerInfoPrompt: true,
				},
			},
		},
	})
	if (!link || !link.enabled || !link.agent.active) {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}
	const agent = link.agent

	// Per-agent daily ceiling as a second abuse backstop (IP keys are spoofable
	// behind some proxies). Shares the widget cap env knob.
	const dailyCap = Number(process.env.WIDGET_DAILY_MESSAGE_CAP || 1000)
	const underDailyCap = await rateLimit(`chatlink-daily:${agent.id}`, dailyCap, 86_400, {
		failClosed: true,
	})
	if (!underDailyCap) {
		return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
	}

	// Only trust the lead fields when the owner actually enabled the form.
	const settings = normalizeChatLinkSettings(link.settings)

	// ── Server-side lead-capture enforcement (FIRST MESSAGE ONLY) ─────────
	// When the workspace has turned on "require name + phone", the FIRST
	// message of a new conversation must carry a valid visitorName +
	// visitorPhone (sent from the pre-chat lead form). Subsequent messages
	// in an EXISTING conversation don't need to resend the lead fields —
	// the conversation already has a linked Contact. We gate on
	// `!conversationId` so follow-up messages are never rejected with
	// LEAD_REQUIRED (which was the bug: message 2+ failed because the
	// client only sends lead fields on the first message).
	if (
		settings.leadCapture &&
		settings.leadCaptureRequired &&
		!parsed.data.conversationId
	) {
		const vName = (parsed.data.visitorName ?? '').trim()
		const vPhone = (parsed.data.visitorPhone ?? '').trim()
		const phoneDigits = vPhone.replace(/\D/g, '')
		if (vName.length < 2 || phoneDigits.length < 10) {
			return NextResponse.json({ error: 'LEAD_REQUIRED' }, { status: 400 })
		}
	}

	const result = await startChat({
		workspaceId: agent.workspaceId,
		agent: {
			...agent,
			promptConfig: (agent.promptConfig ?? null) as Parameters<
				typeof startChat
			>[0]['agent']['promptConfig'],
		},
		message: parsed.data.message,
		conversationId: parsed.data.conversationId ?? undefined,
		channel: 'CHAT_LINK',
		contactName: settings.leadCapture
			? (parsed.data.visitorName ?? undefined)
			: undefined,
		contactPhone: settings.leadCapture
			? (parsed.data.visitorPhone ?? undefined)
			: undefined,
		replyToMessageId: parsed.data.replyToMessageId ?? undefined,
	})

	if ('error' in result) {
		const status = result.error === 'PLAN_BLOCKED' ? 402 : 400
		return NextResponse.json({ error: result.error }, { status })
	}

	return new Response(result.stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	})
}
