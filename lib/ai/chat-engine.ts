import { prisma } from '@/lib/prisma'
import {
        getPlatformOpenRouterKey,
        streamChat,
        chatCompletion,
        type ChatUsage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages } from '@/lib/ai/rag'
import { resolveSystemPrompt } from '@/lib/ai/prompt-builder'
import {
        extractIdentity,
        applyExtractedIdentity,
        identificationInstruction,
} from '@/lib/ai/customer-identification'
import {
        resolveConversation,
        loadAgentRuntime,
        loadHistory,
        fetchCatalogProducts,
} from '@/lib/ai/conversation'
import { shouldHandoff, notifyHandoff, detectUnanswered, handoffReplyText } from '@/lib/ai/handoff'
import { syncOnboarding } from '@/lib/onboarding'
import { captureError } from '@/lib/errors/capture'
import { checkChatAllowed, type BlockReason } from '@/lib/billing/entitlements'
import { DEFAULT_MODEL, resolveModelAlias, resolveModelId } from '@/lib/ai/models'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import {
        captureChatCredit,
        releaseChatCredit,
        reserveChatCredit,
        type CreditReservation,
} from '@/lib/billing/ai-credits'
import { bumpContactActivity } from '@/lib/crm/contact-activity'
import type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'

// Re-exported so existing imports (routes, channel handler) keep working.
export type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'

/**
 * The chat engine proper: orchestrates one inbound message end-to-end —
 * plan gate → conversation resolution → identity extraction → prompt build →
 * RAG → LLM call → persistence. Conversation/data loading lives in
 * lib/ai/conversation.ts and escalation policy in lib/ai/handoff.ts.
 */

/**
 * Inject runtime variables into the system prompt.
 *
 * Supported placeholders:
 *   {customer_name}  → contact name (or "مشتری" if unknown)
 *
 * Example system prompt:
 *   "تو دستیار فروش هستی. اگر نام مشتری را می‌دانی، با نام او خطاب کن. نام: {customer_name}"
 */
function hydrateSystemPrompt(prompt: string, contactName?: string | null): string {
        if (!prompt) return prompt
        const name = (contactName && contactName.trim()) || 'مشتری'
        return prompt.replaceAll('{customer_name}', name)
}

/** Bump queryCount for any product chunks retrieved (fire-and-forget). */
function bumpProductQueries(workspaceId: string, chunks: { metadata: unknown }[]): void {
        const productIds = chunks
                .map((c) =>
                        c.metadata && typeof c.metadata === 'object' && 'productId' in c.metadata
                                ? String((c.metadata as Record<string, unknown>).productId)
                                : null,
                )
                .filter((v): v is string => !!v)
        if (productIds.length) {
                prisma.product
                        .updateMany({
                                where: { id: { in: productIds }, workspaceId },
                                data: { queryCount: { increment: 1 } },
                        })
                        .catch(() => {})
        }
}

/**
 * Resolve the final system prompt: layered prompt config → role template → legacy
 * free-form. Then hydrate {customer_name}. If the conversation is still in the
 * 'pending' identification state, append the identification instruction.
 */
function buildSystemPrompt(params: {
        agent: ChatAgent
        customerInfoState: string
        variantPrompt: string | null
        variant: string
        contactName: string | null
}): string {
        const { agent, customerInfoState, variantPrompt, variant, contactName } = params

        // 1. Pick base prompt: A/B variant → layered/role → legacy.
        let base =
                variant === 'B' && variantPrompt
                        ? variantPrompt
                        : resolveSystemPrompt({
                                  promptConfig: agent.promptConfig,
                                  roleTemplate: agent.roleTemplate,
                                  legacySystemPrompt: agent.systemPrompt,
                                  language: agent.language,
                          })

        // 2. Hydrate {customer_name}.
        base = hydrateSystemPrompt(base, contactName)

        // 3. If the conversation is still pending identification, inject the
        //    collect-info instruction so the agent asks for name+phone first.
        if (customerInfoState === 'pending' && agent.requireCustomerInfo) {
                const isFa = agent.language !== 'en'
                base += identificationInstruction(isFa, agent.customerInfoPrompt)
        }

        return base
}

/**
 * Shared per-turn setup for both engines: plan gate, key lookup, conversation
 * resolution, identity extraction, prompt/history/RAG assembly and persisting
 * the inbound user message.
 */
async function prepareTurn(params: StartChatParams): Promise<
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | {
                  model: string
                  modelAlias: string
                  reservation: CreditReservation
                  conversationId: string
                  contactName: string | null
                  contactPhone: string | null
                  messages: ReturnType<typeof buildMessages>
          }
> {
        const { workspaceId, agent, message } = params

        // Plan gate: expired trial/subscription or exhausted monthly quota.
        const gate = await checkChatAllowed(workspaceId)
        if (!gate.allowed) return { error: 'PLAN_BLOCKED', reason: gate.reason }

        if (!getPlatformOpenRouterKey()) return { error: 'AI_UNAVAILABLE' }

        const [runtime, platformConfig] = await Promise.all([
                loadAgentRuntime(workspaceId, agent.id),
                getPlatformAiConfig(),
        ])
        const requestedAlias = resolveModelAlias(agent.model || platformConfig.defaultModel || DEFAULT_MODEL)
        const modelAlias = applyPlatformModelPolicy(requestedAlias, platformConfig, gate.plan)
        const model = resolveModelId(modelAlias, platformConfig.providerModels)
        if (!(await hasPlatformAiBudget(platformConfig))) return { error: 'AI_UNAVAILABLE' }

        // Resolve (or create) the conversation, scoped to the workspace.
        const conversation = await resolveConversation(params, runtime.exp)
        const conversationId = conversation.id

        // F3: best-effort identity extraction from the inbound user message,
        // merged with structured identity from the widget's pre-chat lead form.
        const extracted = extractIdentity(message)
        if (!extracted.name && params.contactName?.trim()) {
                extracted.name = params.contactName.trim().slice(0, 60)
        }
        if (!extracted.phone && params.contactPhone?.trim()) {
                // Reuse the extractor so the phone gets the same +98 normalization.
                extracted.phone =
                        extractIdentity(params.contactPhone).phone ?? params.contactPhone.trim().slice(0, 30)
        }

        // Widget visitors have no platform identity — when the lead form gave us
        // a name/phone, find-or-create a CRM contact and attach it.
        let contactId = params.contactId ?? null
        if (!contactId && (extracted.name || extracted.phone)) {
                try {
                        const existing = extracted.phone
                                ? await prisma.contact.findFirst({
                                          where: { workspaceId, phone: extracted.phone },
                                          select: { id: true },
                                  })
                                : null
                        const contact =
                                existing ??
                                (await prisma.contact.create({
                                        data: {
                                                workspaceId,
                                                name: extracted.name,
                                                phone: extracted.phone,
                                        },
                                        select: { id: true },
                                }))
                        contactId = contact.id
                        await prisma.conversation.update({
                                where: { id: conversationId },
                                data: { contactId },
                        })
                } catch (e) {
                        console.error('[chat-engine] lead contact attach failed:', e)
                }
        }

        if (extracted.name || extracted.phone) {
                await applyExtractedIdentity({
                        conversationId,
                        contactId,
                        extracted,
                }).catch(() => {})
        }

        // Hydrate {customer_name} placeholder if the contact name is known.
        let resolvedContactName = params.contactName ?? null
        if (!resolvedContactName && params.contactId) {
                const c = await prisma.contact.findUnique({
                        where: { id: params.contactId },
                        select: { name: true },
                })
                resolvedContactName = c?.name ?? null
        }
        // If we just extracted a name, prefer it for this turn's greeting.
        if (extracted.name) resolvedContactName = extracted.name

        // Re-read the (possibly updated) identification state.
        const freshState = extracted.name
                ? 'collected'
                : (await prisma.conversation.findUnique({
                          where: { id: conversationId },
                          select: { customerInfoState: true },
                  }))?.customerInfoState ?? conversation.customerInfoState

        const finalSystemPrompt = buildSystemPrompt({
                agent,
                customerInfoState: freshState,
                variantPrompt: runtime.variantPrompt,
                variant: conversation.variant,
                contactName: resolvedContactName,
        })

        const reserved = await reserveChatCredit({
                workspaceId,
                agentId: agent.id,
                conversationId,
                model: modelAlias,
                providerModel: model,
                idempotencyKey: `chat:${conversationId}:${crypto.randomUUID()}`,
        })
        if (!reserved.ok) return { error: 'NO_CREDIT' }
        const reservation = reserved.reservation

        try {
                const [history, catalogProducts] = await Promise.all([
                        loadHistory(conversationId),
                        fetchCatalogProducts(agent.id),
                ])

        // Persist the incoming user message.
                await prisma.message.create({
                        data: {
                                conversationId,
                                role: 'USER',
                                content: message,
                        },
                })
        // Every inbound turn (widget, chat-link, and messengers) keeps the
        // contact's denormalized last-activity fresh. Messenger inbound is also
        // bumped in upsertContact; the duplicate is harmless.
                bumpContactActivity(conversationId)

        // Retrieve context and build the prompt.
                const { contextText, chunks } = await retrieveContext({
                        workspaceId,
                        agentId: agent.id,
                        query: message,
                })
                bumpProductQueries(workspaceId, chunks)

                const messages = buildMessages({
                        systemPrompt: finalSystemPrompt,
                        language: agent.language,
                        contextText,
                        catalogProducts,
                        history,
                        userMessage: message,
                // Rich [[product:{…}]] cards are renderable by the web widget AND the
                // standalone chat-link page (both parse the same token format).
                        richCards: params.channel === 'WEB_WIDGET' || params.channel === 'CHAT_LINK',
                })

                return {
                        model,
                        modelAlias,
                        reservation,
                        conversationId,
                        contactName: resolvedContactName,
                        contactPhone: extracted.phone,
                        messages,
                }
        } catch (error) {
                await releaseChatCredit(reservation, 'Turn preparation failed').catch(() => {})
                throw error
        }
}

/** Persist a handoff turn: assistant notice + conversation flip + owner alert. */
async function persistHandoff(params: {
        workspaceId: string
        agent: ChatAgent
        conversationId: string
        channel: StartChatParams['channel']
        contactId: string | null
        contactName: string | null
        contactPhone: string | null
        reason: string
        replyText: string
}): Promise<{ messageId: string } | null> {
        try {
                const savedMsg = await prisma.message.create({
                        data: {
                                conversationId: params.conversationId,
                                role: 'ASSISTANT',
                                content: params.replyText,
                        },
                })
                await prisma.conversation.update({
                        where: { id: params.conversationId },
                        data: {
                                status: 'HANDED_OFF',
                                messageCount: { increment: 2 },
                                lastMessageAt: new Date(),
                        },
                })
                // Keep the contact's denormalized last-activity fresh for the CRM list.
                bumpContactActivity(params.conversationId)
                // Load agent name for the handoff alert snapshot.
                const agentRow = await prisma.agent.findUnique({
                        where: { id: params.agent.id },
                        select: { name: true },
                })
                void notifyHandoff({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        agentId: params.agent.id,
                        agentName: agentRow?.name ?? 'ایجنت',
                        channel: params.channel,
                        contactId: params.contactId,
                        contactName: params.contactName,
                        contactPhone: params.contactPhone,
                        reason: params.reason,
                })
                return { messageId: savedMsg.id }
        } catch (e) {
                console.error('[chat-engine] handoff persist error:', e)
                return null
        }
}

/** Persist an assistant reply + counters + usage (shared by both engines). */
async function persistAssistantTurn(params: {
        workspaceId: string
        agent: ChatAgent
        conversationId: string
        model: string
        userMessage: string
        reply: string
}): Promise<{ messageId: string }> {
        const unanswered = detectUnanswered(params.reply, params.agent.fallbackMessage)
        const savedMsg = await prisma.message.create({
                data: {
                        conversationId: params.conversationId,
                        role: 'ASSISTANT',
                        content: params.reply,
                        unanswered,
                        metadata: unanswered ? { question: params.userMessage } : undefined,
                },
        })
        await prisma.conversation.update({
                where: { id: params.conversationId },
                data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
        })
        // Keep the contact's denormalized last-activity fresh for the CRM list.
        bumpContactActivity(params.conversationId)
        await syncOnboarding(params.workspaceId)
        return { messageId: savedMsg.id }
}

export type StartChatResult =
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; stream: ReadableStream<Uint8Array> }

export async function startChat(params: StartChatParams): Promise<StartChatResult> {
        const { workspaceId, agent, message } = params

        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const { model, reservation, conversationId, contactName, contactPhone, messages } = prep

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                        const send = (obj: unknown) =>
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

                        send({ type: 'meta', conversationId })

                        // Smart handoff: check before calling AI. A database/policy
                        // failure here must not leave wallet credit reserved forever.
                        let handoffCheck: Awaited<ReturnType<typeof shouldHandoff>>
                        try {
                                handoffCheck = await shouldHandoff(agent, conversationId, message)
                        } catch (error) {
                                await releaseChatCredit(reservation, 'Handoff policy check failed').catch(() => {})
                                captureError('chat-engine:handoff-check', error, {
                                        workspaceId,
                                        metadata: { agentId: agent.id, conversationId },
                                })
                                send({ type: 'error', error: 'PREPARATION_FAILED' })
                                controller.close()
                                return
                        }
                        if (handoffCheck.handoff) {
				await releaseChatCredit(reservation, 'Human handoff before AI call').catch(() => {})
                                const handoffText = handoffReplyText(handoffCheck, agent)
                                send({ type: 'delta', text: handoffText })
                                const persisted = await persistHandoff({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        channel: params.channel,
                                        contactId: params.contactId ?? null,
                                        contactName,
                                        contactPhone,
                                        reason: handoffCheck.reason,
                                        replyText: handoffText,
                                })
                                send(persisted ? { type: 'done', messageId: persisted.messageId } : { type: 'done' })
                                controller.close()
                                return
                        }

                        let full = ''
                        let usage: ChatUsage | null = null
                        let providerFailed = false
                        try {
                                for await (const delta of streamChat({
                                        model,
                                        messages,
                                        temperature: agent.temperature,
                                        maxTokens: agent.maxTokens,
                                        onUsage: (u) => {
                                                usage = u
                                        },
                                })) {
                                        full += delta
                                        send({ type: 'delta', text: delta })
                                }
                        } catch (e) {
				providerFailed = true
                                captureError('chat-engine:stream', e, {
                                        workspaceId,
                                        metadata: { agentId: agent.id, model, conversationId },
                                })
                                if (!full) {
                                        full = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
                                        send({ type: 'delta', text: full })
                                }
                                send({ type: 'error', error: 'STREAM_FAILED' })
                        }

                        // A 2xx provider response with no content is not a
                        // successful reply and must not consume reply credit.
                        if (!providerFailed && !full.trim()) {
                                providerFailed = true
                                full = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
                                send({ type: 'delta', text: full })
                                send({ type: 'error', error: 'EMPTY_RESPONSE' })
                        }

			if (providerFailed) {
				await releaseChatCredit(reservation, 'Provider stream failed').catch(() => {})
			} else {
				await captureChatCredit(reservation, usage).catch((e) =>
					console.error('[chat-engine] credit capture failed:', e),
				)
			}

                        // Persist assistant reply and update conversation counters.
                        try {
                                const { messageId } = await persistAssistantTurn({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        model,
                                        userMessage: message,
                                        reply: full,
                                })
                                send({ type: 'done', messageId })
                        } catch (e) {
                                console.error('[chat-engine] persist error:', e)
                                send({ type: 'done' })
                        }

                        controller.close()
                },
                cancel() {
                        // Idempotent: if capture/release already happened this is a no-op.
                        void releaseChatCredit(reservation, 'Client disconnected before completion').catch(() => {})
                },
        })

        return { conversationId, stream }
}

export type GenerateReplyResult =
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; reply: string }

/**
 * Non-streaming counterpart to {@link startChat}, used by messenger channels
 * (Telegram/Bale/Rubika) where we need the full reply text to send back in one
 * shot. Persists both messages and updates counters, mirroring startChat.
 */
export async function generateReply(
        params: StartChatParams,
): Promise<GenerateReplyResult> {
        const { workspaceId, agent, message } = params

        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const { model, reservation, conversationId, contactName, contactPhone, messages } = prep

        // Smart handoff: check before calling AI.
        let handoffCheck: Awaited<ReturnType<typeof shouldHandoff>>
        try {
                handoffCheck = await shouldHandoff(agent, conversationId, message)
        } catch (error) {
                await releaseChatCredit(reservation, 'Handoff policy check failed').catch(() => {})
                throw error
        }
        if (handoffCheck.handoff) {
		await releaseChatCredit(reservation, 'Human handoff before AI call').catch(() => {})
                const reply = handoffReplyText(handoffCheck, agent)
                await persistHandoff({
                        workspaceId,
                        agent,
                        conversationId,
                        channel: params.channel,
                        contactId: params.contactId ?? null,
                        contactName,
                        contactPhone,
                        reason: handoffCheck.reason,
                        replyText: reply,
                })
                return { conversationId, reply }
        }

        let reply = ''
        let usage: ChatUsage | null = null
        let providerFailed = false
        try {
                const result = await chatCompletion({
                        model,
                        messages,
                        temperature: agent.temperature,
                        maxTokens: agent.maxTokens,
                })
                reply = result.content.trim()
                usage = result.usage
        } catch (e) {
		providerFailed = true
                captureError('chat-engine:completion', e, {
                        workspaceId,
                        metadata: { agentId: agent.id, model, conversationId },
                })
        }
        if (!reply) {
                // Empty provider content is a failed reply for billing purposes.
                providerFailed = true
                reply = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
        }

	if (providerFailed) {
		await releaseChatCredit(reservation, 'Provider completion failed').catch(() => {})
	} else {
		await captureChatCredit(reservation, usage).catch((e) =>
			console.error('[chat-engine] credit capture failed:', e),
		)
	}

        try {
                await persistAssistantTurn({
                        workspaceId,
                        agent,
                        conversationId,
                        model,
                        userMessage: message,
                        reply,
                })
        } catch (e) {
                console.error('[chat-engine] persist error:', e)
        }

        return { conversationId, reply }
}
