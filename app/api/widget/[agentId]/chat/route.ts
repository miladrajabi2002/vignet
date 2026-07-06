import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { startChat } from '@/lib/ai/chat-engine'
import { corsHeaders, corsOptions } from '@/lib/cors'
import {
	normalizeWidgetSettings,
	isOriginAllowed,
	stripProductTokens,
} from '@/lib/widget/config'

type Params = { params: Promise<{ agentId: string }> }

const bodySchema = z.object({
	message: z.string().min(1).max(4000),
	// Accept null too: older/embedded widgets send `conversationId: null` on the
	// first turn, which `.optional()` alone would reject as INVALID.
	conversationId: z.string().nullish(),
	// Pre-chat lead form (sent with the first message when lead capture is on).
	visitorName: z.string().max(60).nullish(),
	visitorPhone: z.string().max(30).nullish(),
})

export function OPTIONS() {
	return corsOptions()
}

/**
 * GET — fetch the persisted message history for a conversation.
 *
 * Lets the embeddable widget restore the transcript after a page refresh.
 * The visitor's conversationId is stored in localStorage; this endpoint
 * validates it belongs to the agent before returning messages.
 *
 * Query: ?conversationId=<cuid>
 * Returns: { messages: [{ id, role: 'USER'|'ASSISTANT', content }] }
 */
export async function GET(req: Request, props: Params) {
	const params = await props.params
	const url = new URL(req.url)
	const conversationId = url.searchParams.get('conversationId')
	if (!conversationId) {
		return NextResponse.json({ error: 'INVALID' }, { status: 400, headers: corsHeaders })
	}

	// Verify the conversation belongs to this agent (so a visitor can't read
	// another agent's messages by guessing a conversationId).
	const conversation = await prisma.conversation.findFirst({
		where: {
			id: conversationId,
			agentId: params.agentId,
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
		return NextResponse.json(
			{ error: 'NOT_FOUND' },
			{ status: 404, headers: corsHeaders },
		)
	}

	const messages = conversation.messages
		.filter((m) => m.role !== 'SYSTEM')
		.map((m) => ({
			id: m.id,
			role: m.role === 'USER' ? 'user' : 'assistant',
			content: stripProductTokens(m.content),
		}))

	return NextResponse.json({ messages }, { headers: corsHeaders })
}

export async function POST(req: Request, props: Params) {
	const params = await props.params
	const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'

	// Public endpoint → fail closed if Redis is down (an open limiter here lets
	// anyone drain the workspace's OpenRouter credit).
	const allowed = await rateLimit(`widget:${params.agentId}:${ip}`, 20, 60, {
		failClosed: true,
	})
	if (!allowed) {
		return NextResponse.json(
			{ error: 'RATE_LIMIT' },
			{ status: 429, headers: corsHeaders },
		)
	}

	// Per-agent daily ceiling as a second abuse backstop (IP keys are spoofable
	// behind some proxies). Configurable via WIDGET_DAILY_MESSAGE_CAP.
	const dailyCap = Number(process.env.WIDGET_DAILY_MESSAGE_CAP || 1000)
	const underDailyCap = await rateLimit(
		`widget-daily:${params.agentId}`,
		dailyCap,
		86_400,
		{ failClosed: true },
	)
	if (!underDailyCap) {
		return NextResponse.json(
			{ error: 'RATE_LIMIT' },
			{ status: 429, headers: corsHeaders },
		)
	}

	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json({ error: 'INVALID' }, { status: 400, headers: corsHeaders })
	}

	const agent = await prisma.agent.findUnique({
		where: { id: params.agentId },
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
			// ─ F1: layered prompt
			promptConfig: true,
			roleTemplate: true,
			// ─ F3: customer identification
			requireCustomerInfo: true,
			customerInfoPrompt: true,
			channels: {
				where: { type: 'WEB_WIDGET' },
				select: { config: true },
				take: 1,
			},
		},
	})
	if (!agent || !agent.active) {
		return NextResponse.json(
			{ error: 'NOT_FOUND' },
			{ status: 404, headers: corsHeaders },
		)
	}

	// Anti-abuse: if the owner configured an allowlist, only embed-able from those
	// domains. Empty allowlist = open (the dashboard warns it is unprotected).
	const settings = normalizeWidgetSettings(agent.channels[0]?.config)
	if (
		!isOriginAllowed(
			req.headers.get('origin'),
			req.headers.get('referer'),
			settings.allowedDomains,
		)
	) {
		return NextResponse.json(
			{ error: 'FORBIDDEN_ORIGIN' },
			{ status: 403, headers: corsHeaders },
		)
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
		channel: 'WEB_WIDGET',
		contactName: parsed.data.visitorName ?? undefined,
		contactPhone: parsed.data.visitorPhone ?? undefined,
	})

	if ('error' in result) {
		const status = result.error === 'PLAN_BLOCKED' ? 402 : 400
		return NextResponse.json({ error: result.error }, { status, headers: corsHeaders })
	}

	return new Response(result.stream, {
		headers: {
			...corsHeaders,
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	})
}
