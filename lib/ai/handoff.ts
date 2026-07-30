import type { BusinessType, ChannelType } from '@prisma/client'
import { createHandoffAlert } from '@/lib/channels/operator-handoff'
import type { ChatAgent } from '@/lib/ai/chat-types'
import {
        analyzeSalesConversation,
        loadSalesConversationContext,
        normalizeSalesText,
        persistConversationSalesInsight,
        type SalesConversationAnalysis,
} from '@/lib/ai/sales-intelligence'

/**
 * Human-handoff policy. The decision uses observable conversation behaviour,
 * not personality profiling, and shares the bounded sales-intelligence read.
 */

export const LONG_CHAT_THRESHOLD = Number.parseInt(
        process.env.LONG_CHAT_THRESHOLD ?? '10',
        10,
) || 10

export type HandoffReasonCode =
        | 'KEYWORD'
        | 'EXPLICIT_REQUEST'
        | 'HIGH_RISK'
        | 'DISTRESS'
        | 'UNANSWERED'
        | 'REPEATED_REQUEST'
        | 'LOW_CONFIDENCE'
        | 'NEGOTIATION_AUTHORITY'
        | 'LONG_CHAT'
        | 'MANUAL'

const UNANSWERED_PHRASES = [
        'اطلاعاتم کامل نیست',
        'اطلاعات این محصول را ندارم',
        'اطلاعات محصولات ما در حال',
        'اطلاعات در این مورد کامل نیست',
        "I don't have information",
        'catalog is being updated',
]

export function detectUnanswered(reply: string, fallback: string | null): boolean {
        if (fallback && reply.trim() === fallback.trim()) return true
        const lower = reply.toLowerCase()
        return UNANSWERED_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()))
}

export interface HandoffDecision {
        handoff: boolean
        /** Recommended even if the workspace's handoff master switch is off. */
        recommended: boolean
        code: HandoffReasonCode | ''
        reasonCodes: HandoffReasonCode[]
        reason: string
        score: number
        priority: 'normal' | 'high' | 'urgent'
        salesInsight?: SalesConversationAnalysis
}

export interface HandoffPolicyInput {
        analysis: SalesConversationAnalysis
        businessType: BusinessType
        language?: string
        messageCount: number
        customKeyword?: string | null
}

/**
 * Signals that must always respect the customer's safety/agency, even when an
 * older agent has proactive handoff disabled. Less urgent recommendations
 * (negotiation, repeated friction, long chats) still follow the agent setting.
 */
const REQUIRED_HANDOFF_REASONS = new Set<HandoffReasonCode>([
        'EXPLICIT_REQUEST',
        'HIGH_RISK',
        'DISTRESS',
        'UNANSWERED',
])

export function shouldActivateHandoff(
        decision: Pick<HandoffDecision, 'recommended' | 'reasonCodes'>,
        proactiveHandoffEnabled: boolean,
): boolean {
        if (!decision.recommended) return false
        return proactiveHandoffEnabled ||
                decision.reasonCodes.some((code) => REQUIRED_HANDOFF_REASONS.has(code))
}

function handoffThreshold(businessType: BusinessType): number {
        if (businessType === 'SUPPORT' || businessType === 'APPOINTMENTS' || businessType === 'FOOD') {
                return 4
        }
        return 5
}

function formatReason(
        codes: HandoffReasonCode[],
        analysis: SalesConversationAnalysis,
        language: string,
        customKeyword?: string | null,
): string {
        const fa: Partial<Record<HandoffReasonCode, string>> = {
                KEYWORD: customKeyword ? `کلمه کلیدی تنظیم‌شده: ${customKeyword}` : 'کلمه کلیدی انتقال',
                EXPLICIT_REQUEST: 'درخواست صریح ارتباط با اپراتور انسانی',
                HIGH_RISK: `موضوع حساس یا پرریسک (${analysis.riskFlags.join('، ')})`,
                DISTRESS: 'نارضایتی یا تنش شدید مشتری',
                UNANSWERED: `پاسخ ناموفق متوالی (${analysis.operational.consecutiveUnanswered} بار)`,
                REPEATED_REQUEST: 'تکرار درخواست حل‌نشده مشتری',
                LOW_CONFIDENCE: `اطمینان پایین تحلیل (${Math.round(analysis.confidence * 100)}٪) همراه با اصطکاک`,
                NEGOTIATION_AUTHORITY: 'مذاکره نیازمند اختیار قیمت یا شرایط انسانی',
                LONG_CHAT: 'طولانی‌شدن گفتگو همراه با اصطکاک',
        }
        const en: Partial<Record<HandoffReasonCode, string>> = {
                KEYWORD: customKeyword ? `configured keyword: ${customKeyword}` : 'configured handoff keyword',
                EXPLICIT_REQUEST: 'explicit request for a human operator',
                HIGH_RISK: `sensitive or high-risk topic (${analysis.riskFlags.join(', ')})`,
                DISTRESS: 'severe customer distress or anger',
                UNANSWERED: `${analysis.operational.consecutiveUnanswered} consecutive unsuccessful replies`,
                REPEATED_REQUEST: 'repeated unresolved customer request',
                LOW_CONFIDENCE: `low analysis confidence (${Math.round(analysis.confidence * 100)}%) with friction`,
                NEGOTIATION_AUTHORITY: 'negotiation requiring human pricing or terms authority',
                LONG_CHAT: 'long conversation with additional friction',
        }
        const english = language.toLowerCase().startsWith('en')
        const dictionary = english ? en : fa
        const reasons = codes
                .map((code) => dictionary[code])
                .filter((value): value is string => Boolean(value))
        reasons.push(english
                ? `buyer probability ${analysis.buyerProbability}%`
                : `احتمال خرید ${analysis.buyerProbability}٪`)
        return reasons.join('؛ ')
}

/**
 * Pure, testable policy. Conversation length alone is deliberately insufficient
 * to transfer ownership, preventing routine discovery chats from over-handoff.
 */
export function evaluateHandoffPolicy(input: HandoffPolicyInput): HandoffDecision {
        const { analysis } = input
        const codes: HandoffReasonCode[] = []
        let score = 0
        let hardTrigger = false
        const add = (code: HandoffReasonCode, points: number, hard = false) => {
                if (!codes.includes(code)) codes.push(code)
                score += points
                hardTrigger ||= hard
        }

        if (input.customKeyword) add('KEYWORD', 10, true)
        if (analysis.operational.explicitHumanRequest) add('EXPLICIT_REQUEST', 10, true)
        if (analysis.riskFlags.length > 0) add('HIGH_RISK', 10, true)
        if (analysis.operational.severeDistress) add('DISTRESS', 8, true)
        if (analysis.operational.consecutiveUnanswered >= 3) add('UNANSWERED', 8, true)

        if (!hardTrigger) {
                if (analysis.operational.consecutiveUnanswered === 2) add('UNANSWERED', 3)
                if (analysis.operational.repeatedRequest) add('REPEATED_REQUEST', 3)
                // Ordinary dissatisfaction contributes friction but is not labeled
                // as urgent distress; only the severe lexicon above earns that code.
                if (analysis.sentiment === 'NEGATIVE') score += 2
                if (analysis.operational.requiresHumanAuthority) add('NEGOTIATION_AUTHORITY', 5)
                if (analysis.urgency === 'HIGH') score += 1

                const friction =
                        analysis.operational.repeatedRequest ||
                        analysis.operational.consecutiveUnanswered > 0 ||
                        analysis.sentiment === 'NEGATIVE' ||
                        analysis.operational.requiresHumanAuthority

                if (
                        analysis.confidence < 0.42 &&
                        friction &&
                        !analysis.operational.latestUserIsGreetingOrInfoOnly &&
                        input.messageCount >= 4
                ) add('LOW_CONFIDENCE', 1)

                if (
                        input.messageCount >= LONG_CHAT_THRESHOLD &&
                        friction &&
                        !analysis.operational.latestUserIsGreetingOrInfoOnly
                ) add('LONG_CHAT', 1)
        }

        const threshold = handoffThreshold(input.businessType)
        const recommended = hardTrigger || score >= threshold
        const priorityOrder: HandoffReasonCode[] = [
                'EXPLICIT_REQUEST',
                'HIGH_RISK',
                'DISTRESS',
                'UNANSWERED',
                'KEYWORD',
                'REPEATED_REQUEST',
                'NEGOTIATION_AUTHORITY',
                'LOW_CONFIDENCE',
                'LONG_CHAT',
        ]
        const code = recommended
                ? priorityOrder.find((candidate) => codes.includes(candidate)) ?? 'LONG_CHAT'
                : ''
        const priority: HandoffDecision['priority'] =
                codes.includes('HIGH_RISK') || codes.includes('DISTRESS')
                        ? 'urgent'
                        : hardTrigger || score >= threshold + 2
                                ? 'high'
                                : 'normal'

        return {
                handoff: recommended,
                recommended,
                code,
                reasonCodes: recommended ? codes : [],
                reason: recommended
                        ? formatReason(codes, analysis, input.language ?? 'fa', input.customKeyword)
                        : '',
                score,
                priority,
                salesInsight: analysis,
        }
}

export async function shouldHandoff(
        agent: ChatAgent,
        conversationId: string,
        userMessage: string,
): Promise<HandoffDecision> {
        const normalizedMessage = normalizeSalesText(userMessage)
        const customKeyword = agent.handoffKeywords.find((keyword) => {
                const normalizedKeyword = normalizeSalesText(keyword)
                return normalizedKeyword.length > 0 && normalizedMessage.includes(normalizedKeyword)
        }) ?? null

        let context: Awaited<ReturnType<typeof loadSalesConversationContext>> = null
        try {
                context = await loadSalesConversationContext(conversationId)
        } catch (error) {
                // Insight availability must never take down the customer-facing AI.
                console.error('[handoff] sales context load failed:', error)
        }

        const messages = context
                ? [...context.messages]
                : [{ role: 'USER' as const, content: userMessage }]
        const lastUser = [...messages].reverse().find((message) => message.role === 'USER')
        if (!lastUser || normalizeSalesText(lastUser.content) !== normalizedMessage) {
                messages.push({ role: 'USER', content: userMessage })
        }

        const analysis = analyzeSalesConversation({
                messages,
                businessType: context?.businessType ?? 'CUSTOM',
                language: context?.language ?? agent.language,
                roleTemplate: context?.roleTemplate ?? agent.roleTemplate,
        })
        const candidate = evaluateHandoffPolicy({
                analysis,
                businessType: context?.businessType ?? 'CUSTOM',
                language: context?.language ?? agent.language,
                messageCount: Math.max(context?.messageCount ?? 0, messages.length),
                customKeyword,
        })

        if (context) {
                await persistConversationSalesInsight(context, analysis, {
                        handoffRecommended: candidate.recommended,
                        handoffReasonCodes: candidate.reasonCodes,
                }).catch((error) => console.error('[handoff] sales insight persist failed:', error))
        }

        return {
                ...candidate,
                // Customer-requested, safety-critical and repeatedly-unanswered
                // turns always transfer. The setting controls proactive/soft
                // recommendations, not the customer's right to reach a human.
                handoff: shouldActivateHandoff(candidate, agent.handoffEnabled),
        }
}

export function handoffReplyText(decision: HandoffDecision, agent: ChatAgent): string {
        if (agent.handoffMessage) return agent.handoffMessage
        const english = agent.language.toLowerCase().startsWith('en')
        if (decision.code === 'EXPLICIT_REQUEST') {
                return english
                        ? 'Of course. I’ll transfer this conversation with a summary to a human specialist, so you won’t need to repeat the details.'
                        : 'حتماً؛ گفتگو را همراه با خلاصه همین صحبت‌ها به یک کارشناس منتقل می‌کنم تا لازم نباشد اطلاعات را دوباره توضیح دهید.'
        }
        if (decision.code === 'HIGH_RISK' || decision.code === 'DISTRESS') {
                return english
                        ? 'To have this handled carefully and promptly, I’m transferring the conversation with a complete summary to a human specialist now.'
                        : 'برای اینکه موضوع شما دقیق‌تر و سریع‌تر پیگیری شود، همین حالا گفتگو را با خلاصه کامل به یک کارشناس منتقل می‌کنم.'
        }
        if (decision.code === 'UNANSWERED' || decision.code === 'REPEATED_REQUEST') {
                return english
                        ? 'I’m sorry the earlier answers did not resolve this. I’ll transfer the conversation and its history to a specialist so you do not have to repeat yourself.'
                        : 'متأسفم که پاسخ کافی نگرفتید. گفتگو و سابقه پاسخ‌ها را به یک کارشناس منتقل می‌کنم تا بدون تکرار توضیحات پیگیری شود.'
        }
        if (decision.code === 'NEGOTIATION_AUTHORITY') {
                return english
                        ? 'For an accurate review of pricing or custom terms, I’ll transfer the conversation and its details to the right specialist.'
                        : 'برای بررسی دقیق قیمت یا شرایط اختصاصی، گفتگو را همراه با جزئیات به کارشناس مربوط منتقل می‌کنم.'
        }
        return english
                ? 'For a more precise follow-up, I’ll connect you to a human specialist with a summary of this conversation.'
                : 'برای ادامه دقیق‌تر گفتگو، شما را همراه با خلاصه صحبت‌ها به یک کارشناس انسانی متصل می‌کنم.'
}

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
