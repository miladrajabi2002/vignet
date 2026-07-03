import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createHandoffAlert } from '@/lib/channels/operator-handoff'
import type { ChatAgent } from '@/lib/ai/chat-types'

/**
 * Human-handoff decisions + unanswered detection, extracted from the chat
 * engine so the escalation policy lives in one reviewable place.
 */

const UNANSWERED_PHRASES = [
	'اطلاعاتم کامل نیست',
	'اطلاعات این محصول را ندارم',
	'اطلاعات محصولات ما در حال',
	'اطلاعات در این مورد کامل نیست',
	"I don't have information",
	'catalog is being updated',
]

/** Does this reply amount to "I couldn't answer"? */
export function detectUnanswered(reply: string, fallback: string | null): boolean {
	if (fallback && reply.trim() === fallback.trim()) return true
	const lower = reply.toLowerCase()
	return UNANSWERED_PHRASES.some((p) => lower.includes(p.toLowerCase()))
}

/** Should this turn be escalated to a human? */
export async function shouldHandoff(
	agent: ChatAgent,
	conversationId: string,
	userMessage: string,
): Promise<{ handoff: boolean; reason: string }> {
	if (!agent.handoffEnabled) return { handoff: false, reason: '' }
	if (agent.handoffKeywords.length > 0) {
		const lower = userMessage.toLowerCase()
		const hit = agent.handoffKeywords.find((kw) =>
			lower.includes(kw.toLowerCase()),
		)
		if (hit) return { handoff: true, reason: `کلمه کلیدی: ${hit}` }
	}
	// "Consecutive" means the *latest* 3 assistant replies were all fallbacks —
	// a lifetime count would keep handing off forever after 3 early misses.
	const recent = await prisma.message.findMany({
		where: { conversationId, role: 'ASSISTANT' },
		orderBy: { createdAt: 'desc' },
		take: 3,
		select: { unanswered: true },
	})
	if (recent.length === 3 && recent.every((m) => m.unanswered)) {
		return { handoff: true, reason: 'پاسخ‌های متوالی ناموفق (۳ بار)' }
	}
	return { handoff: false, reason: '' }
}

/** Notify the workspace owner that a conversation was handed off to a human. */
export async function notifyHandoff(params: {
	workspaceId: string
	conversationId: string
	agentId: string
	agentName: string
	channel: ChannelType
	contactId: string | null
	contactName: string | null
	contactPhone: string | null
	reason: string
	summary?: string | null
}): Promise<void> {
	await createHandoffAlert({
		workspaceId: params.workspaceId,
		conversationId: params.conversationId,
		agentId: params.agentId,
		agentName: params.agentName,
		channel: params.channel,
		contactId: params.contactId,
		contactName: params.contactName,
		contactPhone: params.contactPhone,
		reason: params.reason,
		summary: params.summary,
	}).catch(() => {})
}
