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
			channel: 'WEB_WIDGET',
		},
		select: {
			id: true,
			messages: {
				orderBy: { createdAt: 'asc' },
				take: 100,
				select: { id: true, role: true, content: true },
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
		channel: 'WEB_WIDGET',
		contactName: settings.leadCapture
			? (parsed.data.visitorName ?? undefined)
			: undefined,
		contactPhone: settings.leadCapture
			? (parsed.data.visitorPhone ?? undefined)
			: undefined,
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
