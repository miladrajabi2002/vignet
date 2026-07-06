import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createHandoffAlert } from '@/lib/channels/operator-handoff'
import { notifyWorkspace } from '@/lib/notifications/create'
import type { ChatAgent } from '@/lib/ai/chat-types'

/**
 * Human-handoff decisions + unanswered detection, extracted from the chat
 * engine so the escalation policy lives in one reviewable place.
 */

/**
 * Total messages (user+assistant) that triggers long-chat escalation.
 * Override per-deployment with the LONG_CHAT_THRESHOLD env var (no migration
 * needed). Default is 10 — beyond that, the conversation is probably stuck:
 * either the user keeps re-asking, or the agent doesn't know the answer.
 */
export const LONG_CHAT_THRESHOLD = Number.parseInt(
        process.env.LONG_CHAT_THRESHOLD ?? '10',
        10,
) || 10

/** Stable reason codes so the UI/notifications can branch on them. */
export type HandoffReasonCode =
        | 'KEYWORD' // user typed a handoff keyword
        | 'LONG_CHAT' // conversation exceeded the message threshold
        | 'UNANSWERED' // agent failed to answer 3× in a row
        | 'MANUAL' // operator triggered it by hand

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

export interface HandoffDecision {
        handoff: boolean
        /** Stable machine-readable code (empty when no handoff). */
        code: HandoffReasonCode | ''
        /** Human-readable Persian reason (shown to operator). */
        reason: string
}

/**
 * Should this turn be escalated to a human?
 *
 * Three triggers, checked in order:
 *   1. The user typed one of the agent's handoff keywords.
 *   2. The conversation has dragged past LONG_CHAT_THRESHOLD messages — it's
 *      taking too long, which usually means the agent can't resolve it.
 *      Only fires once per conversation (status must still be OPEN/BOT_ACTIVE).
 *   3. The last 3 assistant replies were all fallbacks ("I don't know").
 */
export async function shouldHandoff(
        agent: ChatAgent,
        conversationId: string,
        userMessage: string,
): Promise<HandoffDecision> {
        if (!agent.handoffEnabled) return { handoff: false, code: '', reason: '' }

        // 1. Keyword-triggered handoff.
        if (agent.handoffKeywords.length > 0) {
                const lower = userMessage.toLowerCase()
                const hit = agent.handoffKeywords.find((kw) =>
                        lower.includes(kw.toLowerCase()),
                )
                if (hit) {
                        return {
                                handoff: true,
                                code: 'KEYWORD',
                                reason: `کلمه کلیدی: ${hit}`,
                        }
                }
        }

        // 2. Long-chat escalation: if total message count exceeds threshold,
        //    the conversation is taking too long — likely the agent can't
        //    resolve it. Only triggers once (status still OPEN/BOT_ACTIVE) so
        //    a conversation already handed off doesn't re-trigger.
        const conv = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { messageCount: true, status: true, workspaceId: true },
        })
        if (
                conv &&
                conv.status !== 'HANDED_OFF' &&
                conv.messageCount >= LONG_CHAT_THRESHOLD
        ) {
                // Bell notification only — no SMS (SMS is reserved for OTP only).
                void notifyWorkspace({
                        workspaceId: conv.workspaceId,
                        type: 'HANDOFF',
                        title: '⏳ مکالمه طولانی شد — نیاز به اپراتور',
                        body: `این گفتگو ${conv.messageCount} پیام شده و احتمالاً ایجنت نمی‌تواند آن را حل کند. به اپراتور منتقل شد.`,
                        link: `/conversations/${conversationId}`,
                })
                return {
                        handoff: true,
                        code: 'LONG_CHAT',
                        reason: `مکالمه طولانی (${conv.messageCount} پیام، آستانه ${LONG_CHAT_THRESHOLD})`,
                }
        }

        // 3. Consecutive unanswered replies: the *latest* 3 assistant replies
        //    were all fallbacks — a lifetime count would keep handing off forever.
        const recent = await prisma.message.findMany({
                where: { conversationId, role: 'ASSISTANT' },
                orderBy: { createdAt: 'desc' },
                take: 3,
                select: { unanswered: true },
        })
        if (recent.length === 3 && recent.every((m) => m.unanswered)) {
                return {
                        handoff: true,
                        code: 'UNANSWERED',
                        reason: 'پاسخ‌های متوالی ناموفق (۳ بار)',
                }
        }

        return { handoff: false, code: '', reason: '' }
}

/**
 * Pick the text shown to the customer when a handoff fires. For long-chat we
 * use a dedicated "this took too long" message so the customer understands
 * why they're being moved; otherwise we fall back to the agent's generic
 * handoffMessage.
 */
export function handoffReplyText(
        decision: HandoffDecision,
        agent: ChatAgent,
): string {
        if (decision.code === 'LONG_CHAT') {
                return (
                        agent.handoffMessage ||
                        'این گفتگو کمی طولانی شده؛ برای اینکه سریع‌تر و دقیق‌تر کمکتان کنم، شما را به یک کارشناس متصل می‌کنم. لطفاً چند لحظه صبر کنید. 👨‍💼'
                )
        }
        return agent.handoffMessage || 'در حال اتصال به پشتیبانی انسانی...'
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
