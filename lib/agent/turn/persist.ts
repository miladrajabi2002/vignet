/**
 * Persistence of a customer turn (moved from chat-engine.ts): the inbound
 * row (exactly once per durable event), a handoff notice, or the assistant
 * reply with its receipts, skill trace, state trace, status line, turn cost
 * and the conversation-state update (product memory, pending offer).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { StartChatParams, ChatAgent } from '@/lib/ai/chat-types'
import { notifyHandoff, detectUnanswered } from '@/lib/ai/handoff'
import { syncOnboarding } from '@/lib/onboarding'
import { captureError } from '@/lib/errors/capture'
import { bumpContactActivity } from '@/lib/crm/contact-activity'
import { groundTurnSignal, type TurnSignal } from '@/lib/ai/turn-signal'
import { refreshConversationSalesInsight } from '@/lib/ai/sales-intelligence'
import { buildTurnReceipts, metadataWithReceipts, type ConversationReceipt } from '@/lib/conversations/activity'
import { agentSkillTrace, type AgentSkillPlan } from '@/lib/agent-kernel/contracts'
import {
        observeAssistantTurn,
        persistConversationWorkingState,
        recordShowcase,
        rememberDiscussedEntities,
        setPending,
        type ConversationStateTrace,
        type ConversationWorkingState,
        type PendingState,
} from '@/lib/ai/conversation-state'
import type { TurnCostSummary } from '@/lib/ai/llm/aux'

/** What the assistant turn adds to the conversation state. */
export interface AssistantTurnObservation {
        /** Cards in this reply, in display order. */
        showcase?: Array<{ id: string; name: string }>
        /** Products named or identified on this turn (product memory). */
        discussed?: Array<{ id: string; name: string }>
        discussedVia?: 'card' | 'named' | 'order'
        /** What the agent now waits on (structured, never read back from text). */
        pending?: Omit<PendingState, 'sourceMessageId'> | null
}

/**
 * Create the USER side of a turn exactly once when a durable channel event is
 * present. createMany(skipDuplicates) maps to ON CONFLICT DO NOTHING, so a
 * retry can safely reuse the row committed by a worker that crashed later.
 */
export async function persistInboundTurnMessage(
        params: StartChatParams,
        conversationId: string,
        incrementConversation: boolean,
): Promise<{ created: boolean; id: string; createdAt: Date }> {
        return prisma.$transaction(async (tx) => {
                let created = true
                let id: string
                let createdAt: Date
                if (params.inboundEventId) {
                        const result = await tx.message.createMany({
                                data: [{
                                        conversationId,
                                        role: 'USER',
                                        content: params.message,
                                        metadata: params.inboundMetadata,
                                        inboundEventId: params.inboundEventId,
                                }],
                                skipDuplicates: true,
                        })
                        created = result.count === 1
                        if (!created) {
                                const existing = await tx.message.findUnique({
                                        where: { inboundEventId: params.inboundEventId },
                                        select: { id: true, conversationId: true, createdAt: true },
                                })
                                if (!existing || existing.conversationId !== conversationId) {
                                        throw new Error('Inbound event is linked to a different conversation')
                                }
                                id = existing.id
                                createdAt = existing.createdAt
                        } else {
                                const inserted = await tx.message.findUniqueOrThrow({
                                        where: { inboundEventId: params.inboundEventId },
                                        select: { id: true, createdAt: true },
                                })
                                id = inserted.id
                                createdAt = inserted.createdAt
                        }
                } else {
                        const inserted = await tx.message.create({
                                data: {
                                        conversationId,
                                        role: 'USER',
                                        content: params.message,
                                        metadata: params.inboundMetadata,
                                },
                                select: { id: true, createdAt: true },
                        })
                        id = inserted.id
                        createdAt = inserted.createdAt
                }

                if (created && incrementConversation) {
                        await tx.conversation.update({
                                where: { id: conversationId },
                                data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
                        })
                }
                return { created, id, createdAt }
        })
}

/** Persist a handoff turn: assistant notice + conversation flip + owner alert. */
export async function persistHandoff(params: {
        workspaceId: string
        agent: ChatAgent
        conversationId: string
        channel: StartChatParams['channel']
        contactId: string | null
        contactName: string | null
        contactPhone: string | null
        reason: string
        replyText: string
        skillPlan: AgentSkillPlan
        inboundEventId?: string
        inboundAlreadyPersisted?: boolean
        /** Operator-facing detail (e.g. the confirmed pre-order card). */
        summary?: string
        kind?: 'handoff' | 'order'
        /** Auxiliary calls (understanding) already paid for on this turn. */
        turnCost?: TurnCostSummary | null
}): Promise<{ messageId: string; alertId: string | null } | null> {
        try {
                const metadata = {
                        agentSkillTrace: agentSkillTrace(params.skillPlan),
                        ...(params.turnCost ? { turnCost: params.turnCost } : {}),
                } as unknown as Prisma.InputJsonObject
                const saved = await prisma.$transaction(async (tx) => {
                        let created = true
                        let messageId: string
                        if (params.inboundEventId) {
                                const inserted = await tx.message.createMany({
                                        data: [{
                                                conversationId: params.conversationId,
                                                role: 'ASSISTANT',
                                                content: params.replyText,
                                                metadata,
                                                resultForInboundEventId: params.inboundEventId,
                                        }],
                                        skipDuplicates: true,
                                })
                                created = inserted.count === 1
                                const row = await tx.message.findUniqueOrThrow({
                                        where: { resultForInboundEventId: params.inboundEventId },
                                        select: { id: true, conversationId: true },
                                })
                                if (row.conversationId !== params.conversationId) {
                                        throw new Error('Inbound event result is linked to a different conversation')
                                }
                                messageId = row.id
                        } else {
                                const row = await tx.message.create({
                                        data: {
                                                conversationId: params.conversationId,
                                                role: 'ASSISTANT',
                                                content: params.replyText,
                                                metadata,
                                        },
                                        select: { id: true },
                                })
                                messageId = row.id
                        }
                        await tx.conversation.update({
                                where: { id: params.conversationId },
                                data: {
                                        status: 'HANDED_OFF',
                                        handedOff: true,
                                        ...(created
                                                ? {
                                                        messageCount: {
                                                                increment: params.inboundAlreadyPersisted ? 1 : 2,
                                                        },
                                                        lastMessageAt: new Date(),
                                                }
                                                : {}),
                                },
                        })
                        return { messageId, created }
                })
                // Keep the contact's denormalized last-activity fresh for the CRM list.
                bumpContactActivity(params.conversationId)
                // Load agent name for the handoff alert snapshot.
                const agentRow = await prisma.agent.findUnique({
                        where: { id: params.agent.id },
                        select: { name: true },
                })
                const alertId = await notifyHandoff({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        agentId: params.agent.id,
                        agentName: agentRow?.name ?? 'ایجنت',
                        channel: params.channel,
                        contactId: params.contactId,
                        contactName: params.contactName,
                        contactPhone: params.contactPhone,
                        reason: params.reason,
                        summary: params.summary,
                        kind: params.kind,
                })
                return { messageId: saved.messageId, alertId }
        } catch (e) {
                console.error('[chat-engine] handoff persist error:', e)
                if (params.inboundEventId) throw e
                return null
        }
}

/** Persist an assistant reply + counters + usage (shared by both engines). */
export async function persistAssistantTurn(params: {
        workspaceId: string
        agent: ChatAgent
        conversationId: string
        model: string
        userMessage: string
        reply: string
        retrievedChunks: Array<{ metadata: unknown }>
        extraReceipts?: ConversationReceipt[]
        skillPlan: AgentSkillPlan
        inboundEventId?: string
        inboundAlreadyPersisted?: boolean
        /**
         * True when the reply body is the provider-failure fallback: nothing in
         * it was generated from retrieved knowledge or catalog rows, so the
         * turn must not claim "checked N sources" receipts.
         */
        serviceError?: boolean
        workingState: ConversationWorkingState
        stateExpectedRevision: number | null
        stateTrace: ConversationStateTrace
        /** Status line the reply model appended; already stripped from `reply`. */
        turnSignal?: TurnSignal | null
        /** Cost of every model call of this turn (reply + auxiliary). */
        turnCost?: TurnCostSummary | null
        /** Product memory / pending offer this reply establishes. */
        observation?: AssistantTurnObservation | null
}): Promise<{ messageId: string }> {
        const unanswered = detectUnanswered(params.reply, params.agent.fallbackMessage)
        // A positive reading only stands when the customer's own words back it.
        const turnSignal = params.turnSignal
                ? groundTurnSignal(params.turnSignal, params.userMessage)
                : null
        const receipts = buildTurnReceipts(
                {
                        userMessage: params.userMessage,
                        assistantReply: params.reply,
                        retrievedChunks: params.serviceError ? [] : params.retrievedChunks,
                },
                { serviceError: params.serviceError },
        )
        for (const receipt of params.extraReceipts ?? []) {
                if (!receipts.some((item) => item.kind === receipt.kind)) receipts.push(receipt)
        }
        const saved = await prisma.$transaction(async (tx) => {
                const metadata = metadataWithReceipts(
                        receipts,
                        {
                                ...(unanswered ? { question: params.userMessage } : {}),
                                agentSkillTrace: agentSkillTrace(params.skillPlan) as unknown as Prisma.InputJsonObject,
                                conversationStateTrace: params.stateTrace as unknown as Prisma.InputJsonObject,
                                ...(turnSignal
                                        ? { turnSignal: turnSignal as unknown as Prisma.InputJsonObject }
                                        : {}),
                                ...(params.turnCost
                                        ? { turnCost: params.turnCost as unknown as Prisma.InputJsonObject }
                                        : {}),
                        },
                )
                let created = true
                let messageId: string
                let messageCreatedAt: Date
                if (params.inboundEventId) {
                        const inserted = await tx.message.createMany({
                                data: [{
                                        conversationId: params.conversationId,
                                        role: 'ASSISTANT',
                                        content: params.reply,
                                        unanswered,
                                        metadata,
                                        resultForInboundEventId: params.inboundEventId,
                                }],
                                skipDuplicates: true,
                        })
                        created = inserted.count === 1
                                const row = await tx.message.findUniqueOrThrow({
                                        where: { resultForInboundEventId: params.inboundEventId },
                                        select: { id: true, conversationId: true, createdAt: true },
                        })
                        if (row.conversationId !== params.conversationId) {
                                throw new Error('Inbound event result is linked to a different conversation')
                        }
                                messageId = row.id
                                messageCreatedAt = row.createdAt
                } else {
                        const row = await tx.message.create({
                                data: {
                                        conversationId: params.conversationId,
                                        role: 'ASSISTANT',
                                        content: params.reply,
                                        unanswered,
                                        metadata,
                                },
                                select: { id: true, createdAt: true },
                        })
                        messageId = row.id
                        messageCreatedAt = row.createdAt
                }
                if (created) {
                        await tx.conversation.update({
                                where: { id: params.conversationId },
                                data: {
                                        messageCount: {
                                                increment: params.inboundAlreadyPersisted ? 1 : 2,
                                        },
                                        lastMessageAt: new Date(),
                                },
                        })
                }
                return { messageId, messageCreatedAt, created }
        })
        // Keep the contact's denormalized last-activity fresh for the CRM list.
        bumpContactActivity(params.conversationId)
        if (saved.created) await syncOnboarding(params.workspaceId)
        let completedState = observeAssistantTurn(
                params.workingState,
                params.reply,
                saved.messageId,
                saved.messageCreatedAt,
        )
        const observation = params.observation
        if (observation?.showcase?.length) completedState = recordShowcase(completedState, observation.showcase)
        if (observation?.discussed?.length) {
                completedState = rememberDiscussedEntities(completedState, observation.discussed, observation.discussedVia ?? 'named', saved.messageId)
        }
        if (observation?.showcase?.length) {
                completedState = rememberDiscussedEntities(completedState, observation.showcase, 'card', saved.messageId)
        }
        if (observation?.pending) {
                completedState = setPending(completedState, { ...observation.pending, sourceMessageId: saved.messageId })
        }
        await persistConversationWorkingState({
                conversationId: params.conversationId,
                state: completedState,
                expectedRevision: params.stateExpectedRevision,
        }).catch((error) => {
                // The transcript remains authoritative; the next turn replays
                // any missed messages and heals this derived snapshot.
                captureError('chat-engine:conversation-state-persist', error, {
                        workspaceId: params.workspaceId,
                        metadata: { agentId: params.agent.id, conversationId: params.conversationId },
                })
        })
        // Fold the new status line into the stored snapshot. The pre-reply
        // handoff check already saved one for this turn, without this exchange.
        if (turnSignal && saved.created) {
                await refreshConversationSalesInsight(params.conversationId).catch((error) =>
                        console.error('[chat-engine] turn-signal insight refresh failed:', error),
                )
        }
        return { messageId: saved.messageId }
}
