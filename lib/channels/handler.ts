import type { Prisma } from '@prisma/client'
import { resolveInboundContact } from '@/lib/crm/contact-identity'
import { prisma } from '@/lib/prisma'
import { generateReply, type ChatAgent } from '@/lib/ai/chat-engine'
import { notifyHandoff } from '@/lib/ai/handoff'
import { startChannelTyping } from '@/lib/channels/typing'
import { transcribeAudio, downloadAudio } from '@/lib/voice/stt'
import { synthesizeSpeech } from '@/lib/voice/tts'
import { readBotToken, normalizeMessengerSettings } from '@/lib/channels/config'
import {
        getAdapter,
        isMessengerType,
        type MessengerType,
} from '@/lib/channels/registry'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'
import {
        claimInboundEvent,
        beginInboundEventDispatch,
        completeInboundEvent,
        failInboundEvent,
        inboundExternalEventId,
        markInboundEventEffectsCommitted,
        markInboundEventDeliveryCompleted,
        markInboundEventDeliveryUncertain,
        withInboundEventLease,
        InboundEventLeaseBusyError,
        InboundEventLeaseLostError,
} from '@/lib/channels/idempotency'
import { withConversationTurnLock } from '@/lib/channels/conversation-lock'
import { inboundMessageMetadata } from '@/lib/conversations/source'
import { captureError } from '@/lib/errors/capture'
import {
        absorbConsecutiveInboundMessages,
        combineTurnText,
        isInboundEventMergedIntoAnotherTurn,
        shouldBatchConsecutiveMessages,
        type AbsorbedInbound,
} from '@/lib/channels/batching'
import { greetingReplyText, isGreetingOnlyMessage, mediaPlaceholderText } from '@/lib/channels/greeting'
import {
        isMarketingOptOutMessage,
        optOutConfirmation,
        optOutContact,
} from '@/lib/crm/marketing-consent'
import { fetchInstagramSenderProfile } from '@/lib/instagram/sender-profile'
import {
        runInstagramAutomation,
        shouldAgentReply,
        loadAutomationPolicy,
        willInstagramAutomationHandle,
} from '@/lib/instagram/automation'
import { readPageToken, normalizeInstagramSettings } from '@/lib/instagram/config'
import { isEmojiOnly } from '@/lib/instagram/emoji'
import { refreshConversationSalesInsight } from '@/lib/ai/sales-intelligence'
import { sendProductCarousel } from '@/lib/instagram/media'
import {
        formatProductFallback,
        parseProductDirectives,
        resolveProductShowcases,
} from '@/lib/products/presentation'
import {
        fixedReplyForWorkspace,
        WAITING_MESSAGE_MIN_INTERVAL_MS,
} from '@/lib/channels/fixed-replies'
import { processTrialQuotaAlert } from '@/lib/billing/trial-quota-alert'
import { notifyWorkspace } from '@/lib/notifications/create'

const AGENT_SELECT = {
        id: true,
        name: true,
        systemPrompt: true,
        language: true,
        model: true,
        temperature: true,
        maxTokens: true,
        fallbackMessage: true,
        welcomeMessage: true,
        handoffEnabled: true,
        handoffMessage: true,
        handoffKeywords: true,
        voiceEnabled: true,
        ttsVoice: true,
        active: true,
        // ─ F1: layered prompt config
        promptConfig: true,
        roleTemplate: true,
        // ─ F3: customer identification
        requireCustomerInfo: true,
        customerInfoPrompt: true,
        productAccessEnabled: true,
        orderTrackingEnabled: true,
} satisfies Prisma.AgentSelect

interface ResolvedChannel {
        channelId: string
        config: Prisma.JsonValue
        agent: {
                id: string
                name: string
                workspaceId: string
                systemPrompt: string
                language: string
                model: string | null
                temperature: number
                maxTokens: number
                fallbackMessage: string | null
                welcomeMessage: string | null
                handoffEnabled: boolean
                handoffMessage: string | null
                handoffKeywords: string[]
                voiceEnabled: boolean
                ttsVoice: string
                active: boolean
                promptConfig: unknown
                roleTemplate: string | null
                requireCustomerInfo: boolean
                customerInfoPrompt: string | null
                productAccessEnabled: boolean
                orderTrackingEnabled: boolean
        }
        adapter: MessengerAdapter
        settings: { quickReplies: string[] }
}

/**
 * Locate the active messenger channel for a webhook token, returning the
 * channel, its parent agent, and a ready-to-use adapter. Null when not found.
 */
async function resolveChannel(
        type: MessengerType,
        webhookToken: string,
): Promise<ResolvedChannel | null> {
        const channel = await prisma.agentChannel.findFirst({
                where: {
                        type,
                        active: true,
                        config: { path: ['webhookToken'], equals: webhookToken },
                },
                select: {
                        id: true,
                        config: true,
                        agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                },
        })
        if (!channel?.agent?.active) return null

        const token = readBotToken(channel.config)
        if (!token) return null

        return {
                channelId: channel.id,
                config: channel.config,
                agent: channel.agent,
                adapter: getAdapter(type, token),
                settings: normalizeMessengerSettings(channel.config),
        }
}

/**
 * Resolve an Instagram channel by its identity id — used by the GLOBAL webhook
 * (`/api/webhook/instagram`) which receives all events for the platform's
 * single Meta App. The `entry[].id` in the webhook payload is:
 *   - For Instagram Login channels: the native `user_id`
 *     (config.webhookIgId; distinct from the app-scoped config.igUserId)
 *   - For legacy FB Login channels: the Facebook Page id (config.pageId)
 * We try every historical identity field to cover both connection models and
 * channels created before webhookIgId was captured during OAuth.
 */
async function resolveInstagramChannelById(
        entityId: string,
): Promise<ResolvedChannel | null> {
        // First try the indexed Prisma JSON path query (fast). We check all
        // possible id fields: igUserId (Instagram Login /me), pageId (legacy FB
        // Login), igBusinessAccountId (legacy), and webhookIgId (self-healed alias
        // — the recipient.id Meta actually sends in webhooks, persisted on first
        // fallback match).
        let channel = await prisma.agentChannel.findFirst({
                where: {
                        type: 'INSTAGRAM',
                        active: true,
                        agent: { active: true },
                        OR: [
                                { config: { path: ['igUserId'], equals: entityId } },
                                { config: { path: ['pageId'], equals: entityId } },
                                { config: { path: ['igBusinessAccountId'], equals: entityId } },
                                { config: { path: ['webhookIgId'], equals: entityId } },
                        ],
                },
                select: {
                        id: true,
                        config: true,
                        agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                },
        })

        // Fallback: Prisma JSON path `equals` can be type-sensitive (number vs
        // string). If the indexed query missed, load ALL active IG channels and
        // compare the id fields as strings in memory. This handles the edge case
        // where Meta sends `entry.id` as a number but config stores it as a string
        // (or vice versa).
        if (!channel) {
                const all = await prisma.agentChannel.findMany({
                        where: { type: 'INSTAGRAM', active: true, agent: { active: true } },
                        select: {
                                id: true,
                                config: true,
                                agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                        },
                })
                channel =
                        all.find((c) => {
                                const cfg = c.config as Record<string, unknown> | null
                                if (!cfg) return false
                                const candidates = [
                                        cfg.igUserId,
                                        cfg.pageId,
                                        cfg.igBusinessAccountId,
                                        cfg.webhookIgId,
                                ]
                                return candidates.some(
                                        (v) => v !== undefined && v !== null && String(v) === entityId,
                                )
                        }) ?? null
        }

        if (!channel?.agent?.active) return null

        const token = readPageToken(channel.config)
        if (!token) return null

        return {
                channelId: channel.id,
                config: channel.config,
                agent: channel.agent,
                adapter: getAdapter('INSTAGRAM', token),
                settings: normalizeInstagramSettings(channel.config),
        }
}

/** Map a messenger channel to the Contact field that stores its user id. */
function profileFields(
        type: MessengerType,
): { idField: 'telegramId' | 'baleId' | 'rubikaId' | 'instagramId'; usernameField: string; avatarField: string } {
        switch (type) {
                case 'TELEGRAM':
                        return { idField: 'telegramId', usernameField: 'telegramUsername', avatarField: 'telegramAvatarUrl' }
                case 'BALE':
                        return { idField: 'baleId', usernameField: 'baleUsername', avatarField: 'baleAvatarUrl' }
                case 'RUBIKA':
                        return { idField: 'rubikaId', usernameField: 'rubikaUsername', avatarField: 'rubikaAvatarUrl' }
                case 'INSTAGRAM':
                        return { idField: 'instagramId', usernameField: 'instagramUsername', avatarField: 'instagramAvatarUrl' }
        }
}

/** Look up the contact's display name so we can greet them by name. */
async function getContactName(contactId: string | null): Promise<string | null> {
        if (!contactId) return null
        const c = await prisma.contact.findUnique({
                where: { id: contactId },
                select: { name: true },
        })
        return c?.name ?? null
}

/** Resolve message text, transcribing a voice note when present. */
async function resolveText(
        agentWorkspaceId: string,
        adapter: MessengerAdapter,
        msg: InboundMessage,
): Promise<string> {
        if (msg.text) return msg.text
        if (msg.voiceFileId && adapter.getVoiceUrl) {
                try {
                        const url = await adapter.getVoiceUrl(msg.voiceFileId)
                        if (!url) return ''
                        const dl = await downloadAudio(url)
                        if (!dl) return ''
                        return await transcribeAudio({
                                audio: dl.audio,
                                mime: dl.mime,
                                workspaceId: agentWorkspaceId,
                        })
                } catch (e) {
                        console.error('[handler] voice transcription failed:', e)
                }
        }
        return ''
}

/** Build the ChatAgent payload handed to the AI engine. */
function toChatAgent(agent: ResolvedChannel['agent']): ChatAgent {
        return {
                id: agent.id,
                systemPrompt: agent.systemPrompt,
                language: agent.language,
                model: agent.model,
                temperature: agent.temperature,
                maxTokens: agent.maxTokens,
                fallbackMessage: agent.fallbackMessage,
                handoffEnabled: agent.handoffEnabled,
                handoffMessage: agent.handoffMessage,
                handoffKeywords: agent.handoffKeywords,
                promptConfig: agent.promptConfig as ChatAgent['promptConfig'],
                roleTemplate: agent.roleTemplate,
                requireCustomerInfo: agent.requireCustomerInfo,
                customerInfoPrompt: agent.customerInfoPrompt,
                productAccessEnabled: agent.productAccessEnabled,
                orderTrackingEnabled: agent.orderTrackingEnabled,
        }
}

/** Persist an inbound without invoking retrieval, handoff checks, or the AI. */
async function persistInboundOnly(args: {
        workspaceId: string
        agentId: string
        contactId: string | null
        externalId: string
        text: string
        channel: MessengerType
        metadata?: Prisma.InputJsonValue
        inboundEventId?: string
}): Promise<{
        conversationId: string
        messageId: string
        humanOwned: boolean
        created: boolean
}> {
        const persisted = await prisma.$transaction(async (tx) => {
                const conversation = await tx.conversation.upsert({
                        where: {
                                agentId_channel_externalId: {
                                        agentId: args.agentId,
                                        channel: args.channel,
                                        externalId: args.externalId,
                                },
                        },
                        create: {
                                workspaceId: args.workspaceId,
                                agentId: args.agentId,
                                contactId: args.contactId,
                                channel: args.channel,
                                externalId: args.externalId,
                                customerInfoState: 'skipped',
                        },
                        update: { contactId: args.contactId },
                        select: { id: true, status: true, handedOff: true },
                })
                let created = true
                let messageId: string
                if (args.inboundEventId) {
                        const inserted = await tx.message.createMany({
                                data: [{
                                        conversationId: conversation.id,
                                        role: 'USER',
                                        content: args.text,
                                        metadata: args.metadata,
                                        inboundEventId: args.inboundEventId,
                                }],
                                skipDuplicates: true,
                        })
                        created = inserted.count === 1
                        const message = await tx.message.findUniqueOrThrow({
                                where: { inboundEventId: args.inboundEventId },
                                select: { id: true, conversationId: true },
                        })
                        if (message.conversationId !== conversation.id) {
                                throw new Error('Inbound event is linked to a different conversation')
                        }
                        messageId = message.id
                } else {
                        const message = await tx.message.create({
                                data: {
                                        conversationId: conversation.id,
                                        role: 'USER',
                                        content: args.text,
                                        metadata: args.metadata,
                                },
                                select: { id: true },
                        })
                        messageId = message.id
                }
                if (created) {
                        await tx.conversation.update({
                                where: { id: conversation.id },
                                data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
                        })
                }
                                return {
                        conversationId: conversation.id,
                        messageId,
                        humanOwned: conversation.handedOff || conversation.status === 'HANDED_OFF',
                        created,
                }
        })
        // Automation-only, opt-out and paused-AI paths bypass shouldHandoff,
        // but their customer intent must still stay current in the CRM.
        if (persisted.created) {
                await refreshConversationSalesInsight(persisted.conversationId).catch((error) =>
                        console.error('[handler] inbound-only sales insight refresh failed:', error),
                )
        }
        return persisted
}

/** Persist a native Instagram reaction as a non-counted event carrier. The UI
 * folds this row into its target message, while keeping a durable cursor so an
 * already-open conversation receives the reaction through normal polling. */
async function persistInstagramReaction(args: {
        workspaceId: string
        agentId: string
        contactId: string | null
        externalId: string
        emoji: string
        metadata: Prisma.InputJsonValue
        inboundEventId: string
}): Promise<{
        conversationId: string
        messageId: string
        humanOwned: boolean
        created: boolean
}> {
        return prisma.$transaction(async (tx) => {
                const conversation = await tx.conversation.upsert({
                        where: {
                                agentId_channel_externalId: {
                                        agentId: args.agentId,
                                        channel: 'INSTAGRAM',
                                        externalId: args.externalId,
                                },
                        },
                        create: {
                                workspaceId: args.workspaceId,
                                agentId: args.agentId,
                                contactId: args.contactId,
                                channel: 'INSTAGRAM',
                                externalId: args.externalId,
                                customerInfoState: 'skipped',
                        },
                        update: { contactId: args.contactId },
                        select: { id: true, status: true, handedOff: true },
                })
                const inserted = await tx.message.createMany({
                        data: [{
                                conversationId: conversation.id,
                                role: 'USER',
                                content: args.emoji,
                                metadata: args.metadata,
                                inboundEventId: args.inboundEventId,
                        }],
                        skipDuplicates: true,
                })
                const created = inserted.count === 1
                const eventMessage = await tx.message.findUniqueOrThrow({
                        where: { inboundEventId: args.inboundEventId },
                        select: { id: true, conversationId: true },
                })
                if (eventMessage.conversationId !== conversation.id) {
                        throw new Error('Instagram reaction event is linked to a different conversation')
                }

                // A reaction is activity, but not a message and must not inflate
                // the conversation's visible message count.
                if (created) {
                        await tx.conversation.update({
                                where: { id: conversation.id },
                                data: { lastMessageAt: new Date() },
                        })
                }

                return {
                        conversationId: conversation.id,
                        messageId: eventMessage.id,
                        humanOwned: conversation.handedOff || conversation.status === 'HANDED_OFF',
                        created,
                }
        })
}

async function persistFixedAssistantReply(
        conversationId: string,
        text: string,
        inboundEventId?: string,
): Promise<string> {
                return prisma.$transaction(async (tx) => {
                let created = true
                let messageId: string
                if (inboundEventId) {
                        const inserted = await tx.message.createMany({
                                data: [{
                                        conversationId,
                                        role: 'ASSISTANT',
                                        content: text,
                                        resultForInboundEventId: inboundEventId,
                                }],
                                skipDuplicates: true,
                        })
                        created = inserted.count === 1
                        const row = await tx.message.findUniqueOrThrow({
                                where: { resultForInboundEventId: inboundEventId },
                                select: { id: true, conversationId: true },
                        })
                        if (row.conversationId !== conversationId) {
                                throw new Error('Inbound event result is linked to a different conversation')
                        }
                        messageId = row.id
                } else {
                        const row = await tx.message.create({
                                data: { conversationId, role: 'ASSISTANT', content: text },
                                select: { id: true },
                        })
                        messageId = row.id
                }
                if (created) {
                        await tx.conversation.update({
                                where: { id: conversationId },
                                data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
                        })
                }
                return messageId
                })
}

/** Attach the provider acceptance/failure result to the already-persisted AI
 * message, preserving retrieval and product receipts already in metadata. */
async function markAssistantDelivery(
        messageId: string | null,
        status: 'sent' | 'failed',
): Promise<void> {
        if (!messageId) return
        try {
                const row = await prisma.message.findUnique({
                        where: { id: messageId },
                        select: { metadata: true },
                })
                const metadata = row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
                        ? row.metadata as Prisma.JsonObject
                        : {}
                await prisma.message.update({
                        where: { id: messageId },
                        data: {
                                metadata: {
                                        ...metadata,
                                        delivery: {
                                                status,
                                                ...(status === 'failed' ? { reason: 'provider_error' } : {}),
                                        },
                                } as Prisma.InputJsonObject,
                        },
                })
        } catch (error) {
                // Reporting must not turn an accepted provider send into a
                // failed queue job. The original delivery error is handled by
                // the caller and still reaches structured logging.
                console.error('[handler] assistant delivery metadata update failed:', error)
        }
}

async function reactAfterInstagramReply(
        adapter: MessengerAdapter,
        msg: InboundMessage,
        enabled: boolean,
                workspaceId: string,
): Promise<void> {
        if (!enabled) return
        try {
                                if (msg.kind === 'COMMENT') {
                                                if (msg.commentId && adapter.likeComment) {
                                                        await adapter.likeComment(msg.commentId)
                                                        return
                                                }
                                                captureError('instagram:like-comment:unsupported', new Error('Instagram comment like is not supported by this adapter'), {
                                                        workspaceId,
                                                        metadata: { commentId: msg.commentId },
                                                })
                                                return
                                }
                                if (!msg.platformMessageId || !adapter.reactToMessage) {
                                                captureError('instagram:react-message:unsupported', new Error('Instagram message reaction is unavailable'), {
                                                        workspaceId,
                                                        metadata: { platformMessageId: msg.platformMessageId },
                                                })
                                                return
                                }
                                await adapter.reactToMessage(msg.platformMessageId, msg.senderId)
        } catch (e) {
                                captureError('instagram:post-reply-reaction', e, {
                                                workspaceId,
                                                metadata: { kind: msg.kind, platformMessageId: msg.platformMessageId, commentId: msg.commentId },
                                })
        }
}

/**
 * Core per-channel inbound processor. Shared by the token-based webhook
 * (legacy + other messengers) and the global Instagram webhook. Runs the
 * Instagram automation engine BEFORE the default AI reply so keyword scenarios
 * (and follow-gates) take precedence; falls through to the agent AI when no
 * scenario matches.
 */
async function processChannelInbound(
        type: MessengerType,
        resolved: ResolvedChannel,
        body: unknown,
): Promise<void> {
        const { channelId, agent, adapter, settings } = resolved

        // Stamp the channel's last-inbound time so the dashboard can surface webhook
        // health ("last message 2m ago" vs. a silent/broken hook). Fire-and-forget.
        prisma.agentChannel
                .update({ where: { id: channelId }, data: { lastInboundAt: new Date() } })
                .catch((e) => console.error('[handler] lastInboundAt update failed:', e))

        const chatAgent = toChatAgent(agent)

        const messages = adapter.parseUpdate(body)
        // Per-message failures were only captured, never rethrown, so the BullMQ
        // job always "succeeded" and its configured retries were dead code: a
        // transient Prisma pool timeout or Postgres blip silently discarded the
        // customer's message (the webhook was already ACKed, so no redelivery).
        // Collect failures, finish the batch, then throw so the job retries.
        // Re-runs are safe because succeeded messages keep their idempotency
        // claim and are skipped, while a failed message released its claim.
        let deferredError: unknown = null
        for (const msg of messages) {
                // Idempotency: platforms redeliver webhooks and BullMQ re-runs
                // stalled jobs. Claim the platform message id before any work so a
                // redelivery can never double-persist or double-reply. The kind is
                // part of the key because Instagram reactions carry the mid of the
                // message they react to.
                const externalEventId = inboundExternalEventId(msg)
                let claim: Awaited<ReturnType<typeof claimInboundEvent>>
                try {
                        claim = await claimInboundEvent({
                                workspaceId: agent.workspaceId,
                                channelId,
                                externalEventId,
                                conversationKey: msg.chatId,
                                eventType: msg.kind ?? 'DM',
                                payload: msg,
                        })
                } catch (error) {
                        deferredError ??= error
                        captureError(`webhook:${type}:ledger-claim`, error, {
                                workspaceId: agent.workspaceId,
                                metadata: { agentId: agent.id, channelId, externalEventId },
                        })
                        continue
                }
                if (claim.status === 'completed') {
                        if (claim.payloadConflict) {
                                captureError(
                                        `webhook:${type}:event-id-conflict`,
                                        new Error('Completed inbound event id was reused with a different payload'),
                                        {
                                                workspaceId: agent.workspaceId,
                                                metadata: { channelId, externalEventId, eventId: claim.eventId },
                                        },
                                )
                        }
                        continue
                }
                if (claim.status === 'busy') {
                        deferredError ??= new InboundEventLeaseBusyError(claim.eventId)
                        continue
                }
                const eventLease = claim.lease
                // Escalation context for the outer catch (A14 window-closed path):
                // the conversation/contact are resolved deep inside nested
                // callbacks, so mirrors are kept at loop scope for the handler.
                let escalationConversationId: string | null = null
                let escalationContactId: string | null = null
                let escalationContactName: string | null = null
                try {
                        // Serialize turns per conversation: rapid consecutive messages
                        // arrive as independent webhooks/jobs and would otherwise race —
                        // each loading history without the other, producing two replies
                        // that can land out of order and without shared context.
                        await withInboundEventLease(eventLease, async (eventGuard) => {
                        await withConversationTurnLock(
                                {
                                        workspaceId: agent.workspaceId,
                                        channelId,
                                        conversationKey: msg.chatId,
                                        eventId: eventLease.id,
                                },
                                async (conversationGuard) => {
                        let committedConversationId: string | null = null
                        let inboundMessageId: string | null = null
                        let resultMessageId: string | null = null
                        let outcome = 'IGNORED'
                        let deliveryStartedThisAttempt = false
                        let deliveryUncertain = false
                        // Hoisted for the catch path (A14/A16 escalation): the contact
                        // and the persisted inbound row are needed to flag the right
                        // conversation when a delivery error surfaces below.
                        let contactId: string | null = null
                        let contactName: string | null = null
                        let persistedInbound: Awaited<ReturnType<typeof persistInboundOnly>> | null = null
                        const ensureDispatchStarted = async () => {
                                if (deliveryStartedThisAttempt) return
                                const maySend = await beginInboundEventDispatch(eventLease)
                                if (!maySend) {
                                        throw new Error('Inbound event delivery was already started by an earlier attempt')
                                }
                                deliveryStartedThisAttempt = true
                        }
                        const deliveryAdapter: MessengerAdapter = {
                                ...adapter,
                                async sendText(chatId, outboundText, opts) {
                                        await ensureDispatchStarted()
                                        await adapter.sendText(chatId, outboundText, opts)
                                },
                                ...(adapter.sendVoice
                                        ? {
                                                async sendVoice(chatId: string, voice: Parameters<NonNullable<MessengerAdapter['sendVoice']>>[1]) {
                                                        await ensureDispatchStarted()
                                                        await adapter.sendVoice!(chatId, voice)
                                                },
                                        }
                                        : {}),
                                ...(adapter.sendProductCard
                                        ? {
                                                async sendProductCard(chatId: string, card: Parameters<NonNullable<MessengerAdapter['sendProductCard']>>[1]) {
                                                        await ensureDispatchStarted()
                                                        await adapter.sendProductCard!(chatId, card)
                                                },
                                        }
                                        : {}),
                                ...(adapter.reactToMessage
                                        ? {
                                                async reactToMessage(messageId: string, recipientId: string) {
                                                        await ensureDispatchStarted()
                                                        await adapter.reactToMessage!(messageId, recipientId)
                                                },
                                        }
                                        : {}),
                                ...(adapter.likeComment
                                        ? {
                                                async likeComment(commentId: string) {
                                                        await ensureDispatchStarted()
                                                        await adapter.likeComment!(commentId)
                                                },
                                        }
                                        : {}),
                        }
                        await (async () => {
                        // Fast abort for events that were absorbed into a concurrent
                        // turn while this job sat waiting on the conversation lease.
                        // The fencing assert throws LeaseLost; the outer catch treats
                        // the MERGED_INTO_TURN completion as a normal skip.
                        await eventGuard.assertActive()
                        let text = await resolveText(agent.workspaceId, adapter, msg)
                        // ─ A13: media-only inbound (photo/video/voice/sticker/file
                        // with no usable text). The customer must still get an
                        // honest fixed answer instead of silence, and the LLM must
                        // never see a media placeholder as a question. Flag it
                        // here; the fixed reply is sent right after the inbound is
                        // persisted and ownership gates are checked.
                        const mediaOnlyInbound = !text && (msg.hasMedia || Boolean(msg.voiceFileId))
                        if (mediaOnlyInbound) text = mediaPlaceholderText(msg)
                        if (!text) return

                        const inboundMetadata = inboundMessageMetadata(type, msg)

                        // ─ A16: in AUTOMATION_ONLY mode, an Instagram event that matches
                        // neither a fixed reply nor a scenario previously died in
                        // total silence — the customer got nothing, the inbox got
                        // nothing. It is now escalated: the inbound is persisted,
                        // the customer receives a configurable acknowledgement, and
                        // the thread is flagged for the operator.
                        let escalateAutomationUnmatched = false
                        let scenarioHandled = false
                        let instagramPolicy: Awaited<ReturnType<typeof loadAutomationPolicy>> | null = null
                        let reactionClassInput = false
                        let fixedInstagramReply: string | null = null
                        if (type === 'INSTAGRAM') {
                                instagramPolicy = await loadAutomationPolicy(agent.id, resolved.config)
                                reactionClassInput = msg.kind === 'REACTION' || msg.kind === 'STORY_REACTION' || isEmojiOnly(text)
                                fixedInstagramReply = reactionClassInput
                                        ? msg.kind === 'STORY_REACTION' && instagramPolicy.storyReactionReplyEnabled
                                                ? instagramPolicy.storyReactionReplyText
                                                : msg.kind === 'COMMENT' && instagramPolicy.commentEmojiReplyEnabled
                                                        ? instagramPolicy.commentEmojiReplyText
                                                        : null
                                        : null
                                const effectivePolicy = msg.kind === 'COMMENT'
                                        ? instagramPolicy.commentReplyPolicy
                                        : msg.kind === 'STORY_REPLY' || msg.kind === 'STORY_REACTION' || msg.kind === 'STORY_MENTION'
                                                ? instagramPolicy.storyReplyPolicy
                                                : instagramPolicy.dmReplyPolicy

                                if (
                                        effectivePolicy === 'AUTOMATION_ONLY' &&
                                        !fixedInstagramReply &&
                                        !isMarketingOptOutMessage(text)
                                ) {
                                        // Operator-owned threads remain inbox conversations even
                                        // if the channel policy later changes to automation-only.
                                        const existingConversation = await prisma.conversation.findFirst({
                                                where: {
                                                        agentId: agent.id,
                                                        channel: 'INSTAGRAM',
                                                        externalId: msg.chatId,
                                                },
                                                select: { status: true, handedOff: true },
                                        })
                                        const humanOwned = existingConversation?.handedOff === true || existingConversation?.status === 'HANDED_OFF'
                                        if (!humanOwned) {
                                                const automationWillHandle = await willInstagramAutomationHandle({
                                                        agentId: agent.id,
                                                        channelId,
                                                        msg,
                                                })
                                                if (!automationWillHandle) {
                                                        escalateAutomationUnmatched = true
                                                }
                                        }
                                }
                        }

                        const resolvedContactId = await resolveInboundContact({
                                workspaceId: agent.workspaceId,
                                channel: type,
                                senderId: msg.senderId,
                                senderName: msg.senderName,
                                senderPhone: msg.senderPhone,
                                senderUsername: msg.senderUsername,
                                senderAvatarUrl: msg.senderAvatarUrl,
                        })
                        contactId = resolvedContactId
                        if (!contactId) {
                                // This happens when the workspace has hit its
                                // customer limit (TRIAL=100, STARTER=2000, …).
                                // The conversation is still persisted (with
                                // contactId=null), but it shows as «ناشناس» in
                                // the inbox and no profile backfill runs. Surface
                                // it loudly so the operator knows to upgrade or
                                // clean up old contacts — silently dropping the
                                // inbound contact is the worst UX.
                                captureError(
                                        'inbound:contact-resolve-failed',
                                        new Error(
                                                `Workspace ${agent.workspaceId} could not resolve a contact for sender ${msg.senderId} on ${type}. ` +
                                                `This usually means the workspace has reached its customer limit. ` +
                                                `Upgrade the plan or remove old contacts.`,
                                        ),
                                        { workspaceId: agent.workspaceId, metadata: { channelId: resolved.channelId, channel: type } },
                                )
                        }
                        contactName = await getContactName(contactId)
                        escalationContactId = contactId
                        escalationContactName = contactName

                        // Persist ordinary inbound messages before automation. A
                        // native reaction is instead folded into its target message
                        // in the UI and never increments the visible messageCount.
                        // The upsert also gives us sticky operator ownership.
                        persistedInbound = type === 'INSTAGRAM' && msg.kind === 'REACTION'
                                ? await persistInstagramReaction({
                                        workspaceId: agent.workspaceId,
                                        agentId: agent.id,
                                        contactId,
                                        externalId: msg.chatId,
                                        emoji: text,
                                        metadata: inboundMetadata,
                                        inboundEventId: eventLease.id,
                                })
                                : await persistInboundOnly({
                                        workspaceId: agent.workspaceId,
                                        agentId: agent.id,
                                        contactId,
                                        externalId: msg.chatId,
                                        text,
                                        channel: type,
                                        metadata: inboundMetadata,
                                        inboundEventId: eventLease.id,
                                })
                        committedConversationId = persistedInbound.conversationId
                        escalationConversationId = persistedInbound.conversationId
                        inboundMessageId = persistedInbound.messageId
                        outcome = 'INBOUND_PERSISTED'

                        // Human ownership is the earliest reply-policy gate. In
                        // particular, Instagram scenarios used to run before
                        // generateReply noticed HANDED_OFF and could still type or
                        // auto-reply. Opt-out state is still honored, but no bot ack
                        // is sent while an operator owns the thread.
                        if (persistedInbound.humanOwned) {
                                if (contactId && isMarketingOptOutMessage(text)) await optOutContact(contactId)
                                // ─ Waiting message after handoff: the customer is never
                                // left hanging while the operator has not answered yet.
                                // Sent at most once per WAITING_MESSAGE_MIN_INTERVAL_MS
                                // (dedup state on conversation.metadata) and suppressed
                                // entirely once an operator-authored reply exists.
                                try {
                                        const conv = await prisma.conversation.findUnique({
                                                where: { id: persistedInbound.conversationId },
                                                select: { id: true, metadata: true },
                                        })
                                        const meta = (conv?.metadata ?? {}) as Record<string, unknown>
                                        const lastWaitingAckAt = typeof meta.waitingAckAt === 'string'
                                                ? Date.parse(meta.waitingAckAt)
                                                : Number.isFinite(meta.waitingAckAt as number)
                                                        ? (meta.waitingAckAt as number)
                                                        : 0
                                        const operatorReplied = await prisma.message.findFirst({
                                                where: {
                                                        conversationId: persistedInbound.conversationId,
                                                        role: 'ASSISTANT',
                                                        metadata: { path: ['operator'], equals: true },
                                                },
                                                orderBy: { createdAt: 'desc' },
                                                select: { id: true },
                                        })
                                        const rateLimitOk = Date.now() - lastWaitingAckAt >= WAITING_MESSAGE_MIN_INTERVAL_MS
                                        if (!operatorReplied && rateLimitOk && !isMarketingOptOutMessage(text)) {
                                                const waitingText = await fixedReplyForWorkspace(
                                                        'waitingForOperatorMessage',
                                                        agent.workspaceId,
                                                )
                                                resultMessageId = await persistFixedAssistantReply(
                                                        persistedInbound.conversationId,
                                                        waitingText,
                                                        eventLease.id,
                                                )
                                                await prisma.conversation.update({
                                                        where: { id: persistedInbound.conversationId },
                                                        data: {
                                                                metadata: {
                                                                        ...(conv?.metadata as object ?? {}),
                                                                        waitingAckAt: new Date().toISOString(),
                                                                },
                                                        },
                                                }).catch(() => {})
                                                if (!eventLease.deliveryStartedAt) {
                                                        await deliveryAdapter.sendText(msg.chatId, waitingText).catch((e) => {
                                                                console.error(`[handler] ${type} waiting ack delivery failed:`, e)
                                                        })
                                                }
                                        }
                                } catch (e) {
                                        console.error('[handler] waiting-message gate failed:', e)
                                }
                                outcome = 'OPERATOR_OWNED'
                                return
                        }

                        // ─ A13: media-only inbound. Answer with the configurable fixed
                        // text before any automation/AI turn — the model never sees the
                        // media placeholder as a question and never guesses content.
                        if (mediaOnlyInbound) {
                                const mediaText = await fixedReplyForWorkspace(
                                        'mediaUnsupportedMessage',
                                        agent.workspaceId,
                                )
                                resultMessageId = await persistFixedAssistantReply(
                                        persistedInbound.conversationId,
                                        mediaText,
                                        eventLease.id,
                                )
                                if (eventLease.deliveryStartedAt) {
                                        deliveryUncertain = !eventLease.deliveryCompletedAt
                                        outcome = deliveryUncertain
                                                ? 'DELIVERY_UNCERTAIN'
                                                : 'DELIVERY_ALREADY_COMPLETED'
                                        return
                                }
                                await deliveryAdapter.sendText(msg.chatId, mediaText)
                                outcome = 'MEDIA_UNSUPPORTED_REPLIED'
                                return
                        }

                        // ─ A16: automation-only DM matched no scenario. Escalate to the
                        // operator instead of dropping the customer into silence: fixed
                        // acknowledgement + handoff alert + owner notification.
                        if (escalateAutomationUnmatched) {
                                const ackText = await fixedReplyForWorkspace(
                                        'automationUnmatchedAckMessage',
                                        agent.workspaceId,
                                )
                                resultMessageId = await persistFixedAssistantReply(
                                        persistedInbound.conversationId,
                                        ackText,
                                        eventLease.id,
                                )
                                await prisma.conversation.updateMany({
                                        where: { id: persistedInbound.conversationId },
                                        data: {
                                                handedOff: true,
                                                status: 'HANDED_OFF',
                                        },
                                }).catch(() => {})
                                await notifyHandoff({
                                        workspaceId: agent.workspaceId,
                                        conversationId: persistedInbound.conversationId,
                                        agentId: agent.id,
                                        agentName: agent.name,
                                        channel: type,
                                        contactId,
                                        contactName,
                                        contactPhone: null,
                                        reason: 'پیام بدون پاسخ خودکار (حالت فقط-اتوماسیون بدون سناریوی منطبق)',
                                }).catch(() => {})
                                await notifyWorkspace({
                                        workspaceId: agent.workspaceId,
                                        type: 'HANDOFF',
                                        title: 'پیام مشتری بدون پاسخ خودکار ماند',
                                        body: 'یک پیام اینستاگرام هیچ سناریو یا پاسخ خودکاری نداشت و برای پیگیری انسانی علامت خورد.',
                                        link: `/conversations/${persistedInbound.conversationId}`,
                                }).catch(() => {})
                                if (eventLease.deliveryStartedAt) {
                                        deliveryUncertain = !eventLease.deliveryCompletedAt
                                        outcome = deliveryUncertain
                                                ? 'DELIVERY_UNCERTAIN'
                                                : 'DELIVERY_ALREADY_COMPLETED'
                                        return
                                }
                                await deliveryAdapter.sendText(msg.chatId, ackText)
                                outcome = 'AUTOMATION_ONLY_ESCALATED'
                                return
                        }

                        // Universal campaign opt-out. It runs before Instagram
                        // automations or AI so STOP can never trigger a sales reply.
                        if (isMarketingOptOutMessage(text)) {
                                if (contactId) await optOutContact(contactId)
                                const confirmation = optOutConfirmation(text)
                                resultMessageId = await persistFixedAssistantReply(
                                        persistedInbound.conversationId,
                                        confirmation,
                                        eventLease.id,
                                )
                                if (eventLease.deliveryStartedAt) {
                                        deliveryUncertain = !eventLease.deliveryCompletedAt
                                        outcome = deliveryUncertain
                                                ? 'DELIVERY_UNCERTAIN'
                                                : 'DELIVERY_ALREADY_COMPLETED'
                                        return
                                }
                                await deliveryAdapter.sendText(msg.chatId, confirmation)
                                outcome = 'OPT_OUT_CONFIRMED'
                                return
                        }

                        // A prior attempt crossed the provider boundary. Without a
                        // provider idempotency key we must not auto-resend: either
                        // finish a known acknowledged send or surface ambiguity.
                        if (eventLease.deliveryStartedAt) {
                                deliveryUncertain = !eventLease.deliveryCompletedAt
                                outcome = deliveryUncertain
                                        ? 'DELIVERY_UNCERTAIN'
                                        : 'DELIVERY_ALREADY_COMPLETED'
                                return
                        }

                        // Best-effort backfill of the sender's profile (name, username, avatar).
                        // Instagram DM webhooks only carry the sender id + @username (no display
                        // name or avatar), so we make a separate Graph API call to enrich the
                        // contact. For Telegram/Bale the webhook already gave us the full name
                        // + username, so this primarily fetches the avatar. Each field is
                        // written independently with an "only when empty" guard so manual edits
                        // and previously-fetched values aren't clobbered. Fire-and-forget.
                        if (msg.senderId && contactId) {
                                const pf = profileFields(type)
                                // contactId is a mutable loop-scope mirror; capture it in a
                                // const so TS narrowing survives the async closures below.
                                const contactIdValue = contactId
                                // For Instagram, use the dedicated multi-token fetcher that
                                // tries every token × host × fields combination and logs each
                                // attempt — this is the only way to debug "ناشناس" contacts.
                                // The adapter's getSenderProfile only has ONE token (the
                                // resolved one), but the fetcher reads ALL tokens from config.
                                const profilePromise: Promise<{
                                        name?: string
                                        username?: string
                                        avatarUrl?: string
                                } | null> =
                                        type === 'INSTAGRAM'
                                                ? fetchInstagramSenderProfile(resolved.config, msg.senderId)
                                                : adapter.getSenderProfile
                                                        ? adapter.getSenderProfile(msg.senderId)
                                                        : adapter.getAvatarUrl
                                                                ? adapter.getAvatarUrl(msg.senderId).then((url) => url ? { avatarUrl: url } : null)
                                                                : Promise.resolve(null)
                                profilePromise
                                        .then((profile) => {
                                                if (!profile) return
                                                // Avatar — only set when still empty.
                                                if (profile.avatarUrl) {
                                                        prisma.contact
                                                                .updateMany({
                                                                        where: { id: contactIdValue, [pf.avatarField]: null },
                                                                        data: { [pf.avatarField]: profile.avatarUrl },
                                                                })
                                                                .catch(() => {})
                                                }
                                                // Username — only set when still empty.
                                                if (profile.username) {
                                                        prisma.contact
                                                                .updateMany({
                                                                        where: { id: contactIdValue, [pf.usernameField]: null },
                                                                        data: { [pf.usernameField]: profile.username },
                                                                })
                                                                .catch(() => {})
                                                }
                                                // Real name — backfill when the contact's name is empty OR
                                                // still the raw @handle (the webhook sets senderName to the
                                                // IG @username, so we want to replace it with the real name).
                                                if (profile.name) {
                                                        prisma.contact
                                                                .updateMany({
                                                                        where: {
                                                                                id: contactIdValue,
                                                                                OR: [{ name: null }, { name: msg.senderName ?? '' }],
                                                                        },
                                                                        data: { name: profile.name },
                                                                })
                                                                .catch(() => {})
                                                }
                                        })
                                        .catch((e) => console.error(`[handler] ${type} profile fetch failed:`, e))
                        }

                        // ─── Instagram automation layer ─────────────────────────────
                        // Keyword scenarios, comment→DM funnels, follow-gates, and smart story
                        // replies run here. When a scenario handles the message, we skip the
                        // default AI turn entirely.
                        if (type === 'INSTAGRAM') {
                                const policy = instagramPolicy ?? await loadAutomationPolicy(agent.id, resolved.config)
                                // A configured fixed reply has precedence over scenarios. When
                                                                // disabled we still let scenarios match, but never fall through to AI.
                                if (reactionClassInput) {
                                        const fixedReply = fixedInstagramReply
                                        if (fixedReply) {
                                                resultMessageId = await persistFixedAssistantReply(
                                                        persistedInbound.conversationId,
                                                        fixedReply,
                                                        eventLease.id,
                                                )
                                                await deliveryAdapter.sendText(msg.chatId, fixedReply, {
                                                        quickReplies: msg.kind === 'COMMENT' ? undefined : settings.quickReplies,
                                                })
                                                const likeEnabled = msg.kind === 'COMMENT'
                                                        ? policy.likeCommentAfterReply
                                                        : msg.kind === 'STORY_REACTION'
                                                                ? policy.likeStoryReactionAfterReply
                                                                : policy.likeDmAfterReply
                                                                                        await reactAfterInstagramReply(deliveryAdapter, msg, likeEnabled, agent.workspaceId)
                                                                                        outcome = 'FIXED_REPLY_SENT'
                                                                                        return
                                        }
                                }
                                const auto = await runInstagramAutomation({
                                        agent: { ...chatAgent, workspaceId: agent.workspaceId },
                                        channelId,
                                        channelConfig: resolved.config,
                                        adapter,
                                        msg,
                                        contactId,
                                        contactName,
                                        quickReplies: settings.quickReplies,
                                        conversationId: persistedInbound.conversationId,
                                        inboundEventId: eventLease.id,
                                        beforeDispatch: ensureDispatchStarted,
                                })
                                scenarioHandled = auto.handled
                                if (scenarioHandled) {
                                        const persistedResult = await prisma.message.findUnique({
                                                where: { resultForInboundEventId: eventLease.id },
                                                select: { id: true },
                                        })
                                        resultMessageId = persistedResult?.id ?? resultMessageId
                                }
                                if (scenarioHandled) {
                                        if (auto.replied) {
                                                const likeEnabled = msg.kind === 'COMMENT'
                                                        ? policy.likeCommentAfterReply
                                                        : msg.kind === 'STORY_REPLY' || msg.kind === 'STORY_MENTION'
                                                                ? policy.likeStoryReplyAfterReply
                                                                : msg.kind === 'STORY_REACTION'
                                                                        ? policy.likeStoryReactionAfterReply
                                                                        : policy.likeDmAfterReply
                                                                                        await reactAfterInstagramReply(deliveryAdapter, msg, likeEnabled, agent.workspaceId)
                                        }
                                                                                const effectivePolicy = msg.kind === 'COMMENT'
                                                                                        ? policy.commentReplyPolicy
                                                                                        : msg.kind === 'STORY_REPLY' || msg.kind === 'STORY_REACTION' || msg.kind === 'STORY_MENTION'
                                                                                                ? policy.storyReplyPolicy
                                                                                                : policy.dmReplyPolicy
                                                                                if (reactionClassInput || effectivePolicy !== 'ALL_AGENT') {
                                                                                        if (msg.kind !== 'REACTION') await persistInboundOnly({
                                                                                                workspaceId: agent.workspaceId,
                                                                                                agentId: agent.id,
                                                                                                contactId,
                                                                                                externalId: msg.chatId,
                                                                                                text,
                                                                                                channel: type,
                                                                                                metadata: inboundMetadata,
                                                                                                inboundEventId: eventLease.id,
                                                                                        })
                                                                                        outcome = auto.replied ? 'AUTOMATION_REPLIED' : 'AUTOMATION_HANDLED'
                                                                                        return
                                                                                }
                                }
                                                                if (reactionClassInput) {
                                                                                if (msg.kind !== 'REACTION') await persistInboundOnly({
                                                                                        workspaceId: agent.workspaceId,
                                                                                        agentId: agent.id,
                                                                                        contactId,
                                                                                        externalId: msg.chatId,
                                                                                text,
                                                                                channel: type,
                                                                                metadata: inboundMetadata,
                                                                                inboundEventId: eventLease.id,
                                                                                })
                                                                                outcome = 'REACTION_RECORDED'
                                                                                return
                                                                }
                        }

                        // ─── Channel reply policy gate (Instagram only) ────────────
                        // Even when no scenario matched, the channel-level policy can
                        // suppress the AI turn: AUTOMATION_ONLY turns AI off entirely,
                        // STOP_AI scenarios set conversation.metadata.aiPaused, and
                        // stop-words pause AI for this single turn. We load the policy
                        // from InstagramAutomationSettings (with a fallback to the inline
                        // snapshot in AgentChannel.config.automationSettings).
                        if (type === 'INSTAGRAM') {
                                const policy = instagramPolicy ?? await loadAutomationPolicy(agent.id, resolved.config)
                                // Look up the conversation's pause flag (best-effort; the
                                // conversation may not exist yet — that's fine, the
                                // metadata just isn't set).
                                const conv = await prisma.conversation.findFirst({
                                        where: {
                                                agentId: agent.id,
                                                channel: 'INSTAGRAM',
                                                externalId: msg.chatId,
                                        },
                                        orderBy: { createdAt: 'desc' },
                                        select: { id: true, metadata: true, status: true },
                                })
                                const allow = await shouldAgentReply({
                                        policy,
                                        scenarioHandled,
                                                                        text,
                                        kind: msg.kind,
                                        conversationMetadata: conv?.metadata ?? undefined,
                                        conversationStatus: conv?.status,
                                })
                                if (!allow) {
                                        // Record the inbound so the operator can see it in the
                                        // inbox, but skip the AI outbound. We do this by calling
                                        // generateReply and discarding the reply — that helper
                                        // persists the inbound USER message either way.
                                        try {
                                                await persistInboundOnly({
                                                        workspaceId: agent.workspaceId,
                                                        agentId: agent.id,
                                                        contactId,
                                                        externalId: msg.chatId,
                                                        text,
                                                        channel: type,
                                                        metadata: inboundMetadata,
                                                        inboundEventId: eventLease.id,
                                                })
                                        } catch (e) {
                                                console.error('[handler] instagram inbound-only persist failed:', e)
                                        }
                                        outcome = 'AI_POLICY_SUPPRESSED'
                                        return
                                }
                        }

                        // Start the typing lifecycle BEFORE the batching quiet-window so
                        // the customer sees the indicator while we deliberately wait for
                        // sibling messages, and keep it alive through retrieval + model
                        // generation. onGenerationStart below is a no-op via the ??= guard.
                        let stopTyping: (() => void) | undefined
                        if (adapter.sendTyping) {
                                stopTyping = startChannelTyping(
                                        adapter,
                                        msg.chatId,
                                        (e) => console.error(`[handler] ${type} typing failed:`, e),
                                )
                        }

                        // ─── Consecutive-message batching (wait-and-merge) ─────────
                        // «سلام» «خوبین» «محصول فلان رو دارین؟» arrive as three events;
                        // answering each one interrupting the customer with no shared
                        // context. The first turn to reach the AI holds the conversation
                        // lease, absorbs newer sibling events from the ledger and
                        // answers ONCE with the combined text. Comments stay instant.
                        let absorbedMessages: AbsorbedInbound[] = []
                        if (shouldBatchConsecutiveMessages(type, msg)) {
                                try {
                                        absorbedMessages = await absorbConsecutiveInboundMessages({
                                                workspaceId: agent.workspaceId,
                                                channelId,
                                                conversationKey: msg.chatId,
                                                conversationId: persistedInbound.conversationId,
                                                currentEventId: eventLease.id,
                                                persistInbound: async (absorbedText, absorbedEventId, absorbedKind) => {
                                                        const persisted = await persistInboundOnly({
                                                                workspaceId: agent.workspaceId,
                                                                agentId: agent.id,
                                                                contactId,
                                                                externalId: msg.chatId,
                                                                text: absorbedText,
                                                                channel: type,
                                                                metadata: {
                                                                        ...inboundMetadata,
                                                                        batchedKind: absorbedKind ?? 'DM',
                                                                },
                                                        })
                                                        return persisted.messageId
                                                },
                                        })
                                } catch (e) {
                                        // Batching is a UX nicety; never let it break the turn.
                                        console.error(`[handler] ${type} inbound batching failed:`, e)
                                }
                                if (absorbedMessages.length > 0) {
                                        text = combineTurnText(text, absorbedMessages)
                                }
                        }

                        // ─── Greeting fast-path (zero AI cost) ─────────────────────
                        // A greeting-only turn («سلام», «hello») is answered locally:
                        // no RAG, no model round-trip, no reserved AI credit. Runs
                        // AFTER batching so «سلام» + «خوبین» still merge into one
                        // free welcome instead of two AI turns.
                        if (isGreetingOnlyMessage(text)) {
                                const priorReply = await prisma.message.findFirst({
                                        where: {
                                                conversationId: persistedInbound.conversationId,
                                                role: 'ASSISTANT',
                                                // Retrying the first greeting must not mistake
                                                // this event's own committed reply for history.
                                                OR: [
                                                        { resultForInboundEventId: null },
                                                        { resultForInboundEventId: { not: eventLease.id } },
                                                ],
                                        },
                                        select: { id: true },
                                })
                                // ─ A2: use the business's configured welcome. Agent
                                // settings win, then the channel-level configured
                                // welcome (Instagram automation settings), then the
                                // warm default with the business's own name.
                                const [igWelcomeRow, workspaceProfile] = await Promise.all([
                                        type === 'INSTAGRAM'
                                                ? prisma.instagramAutomationSettings.findUnique({
                                                        where: { agentId: agent.id },
                                                        select: { welcomeMessage: true },
                                                })
                                                : Promise.resolve(null),
                                        prisma.workspace.findUnique({
                                                where: { id: agent.workspaceId },
                                                select: { name: true, businessProfile: true },
                                        }),
                                ])
                                const profile = (workspaceProfile?.businessProfile ?? null) as Record<string, unknown> | null
                                const profileName = typeof profile?.businessName === 'string' && profile.businessName.trim()
                                        ? profile.businessName.trim()
                                        : null
                                const businessName = profileName || workspaceProfile?.name || null
                                const greeting = greetingReplyText(text, !!priorReply, {
                                        configuredWelcome: agent.welcomeMessage,
                                        channelWelcome: igWelcomeRow?.welcomeMessage ?? null,
                                        businessName,
                                })
                                resultMessageId = await persistFixedAssistantReply(
                                        persistedInbound.conversationId,
                                        greeting,
                                        eventLease.id,
                                )
                                if (eventLease.deliveryStartedAt) {
                                        deliveryUncertain = !eventLease.deliveryCompletedAt
                                        outcome = deliveryUncertain
                                                ? 'DELIVERY_UNCERTAIN'
                                                : 'DELIVERY_ALREADY_COMPLETED'
                                        return
                                }
                                await deliveryAdapter.sendText(msg.chatId, greeting, {
                                        quickReplies: settings.quickReplies,
                                })
                                outcome = 'GREETING_REPLIED'
                                return
                        }

                        // generateReply stores the inbound message in the conversation AND
                        // generates the reply. We ALWAYS call it so the inbound is persisted —
                        // even if the outbound reply will fail (e.g. IG-user token can't send
                        // DMs, or the message came from the request folder and hasn't been
                        // accepted yet). A failed send is captured below; the stored inbound
                        // remains visible to the operator in the conversations inbox.
                        let textStream: ReturnType<NonNullable<typeof deliveryAdapter.startTextStream>> | undefined
                        let result: Awaited<ReturnType<typeof generateReply>>
                        try {
                                result = await generateReply(
                                        {
                                                workspaceId: agent.workspaceId,
                                                agent: chatAgent,
                                                message: text,
                                                channel: type,
                                                contactId: contactId ?? undefined,
                                                contactName,
                                                conversationId: persistedInbound.conversationId,
                                                externalId: msg.chatId,
                                                inboundMetadata,
                                                inboundEventId: eventLease.id,
                                                inboundAlreadyPersisted: true,
                                        },
                                        {
                                                // The engine invokes this only after operator ownership,
                                                // policy and smart-handoff gates allow an AI generation.
                                                // The lifecycle itself is fire-and-forget so a slow
                                                // provider nicety endpoint can never delay the model.
                                                onGenerationStart: adapter.sendTyping
                                                        || deliveryAdapter.startTextStream
                                                        ? () => {
                                                                if (adapter.sendTyping) {
                                                                        stopTyping ??= startChannelTyping(
                                                                                adapter,
                                                                                msg.chatId,
                                                                                (e) => console.error(`[handler] ${type} typing failed:`, e),
                                                                        )
                                                                }
                                                                textStream ??= deliveryAdapter.startTextStream?.(msg.chatId)
                                                        }
                                                        : undefined,
                                                onTextUpdate: deliveryAdapter.startTextStream
                                                        ? (partialText) => {
                                                                // Never expose internal product directives in a
                                                                // live draft, including an incomplete marker that
                                                                // has not received its closing brackets yet.
                                                                const openMarker = partialText.lastIndexOf('[[')
                                                                const closedMarker = partialText.lastIndexOf(']]')
                                                                const safePartial = openMarker > closedMarker
                                                                        ? partialText.slice(0, openMarker)
                                                                        : partialText
                                                                textStream?.update(parseProductDirectives(safePartial).text)
                                                        }
                                                        : undefined,
                                        },
                                )
                        } catch (error) {
                                await textStream?.cancel()
                                textStream = undefined
                                throw error
                        } finally {
                                // Instagram needs an explicit typing_off. Telegram/Bale clear
                                // the action when the outgoing message arrives; stopping here
                                // prevents further heartbeat requests while delivery begins.
                                stopTyping?.()
                        }
                        if ('error' in result) {
                                await textStream?.cancel()
                                // ─ A16: a gated turn (exhausted credit / expired plan /
                                // missing platform key) previously ended in TOTAL SILENCE —
                                // the customer message was persisted but no reply, no flag,
                                // no owner alert ever happened. Now: the customer gets the
                                // configurable polite message (quota/plan cases), the thread
                                // is flagged for the operator, and the owner is notified to
                                // upgrade. AI_UNAVAILABLE falls back to the technical-apology
                                // text, matching the A4 provider-failure behaviour.
                                const gateError = result.error
                                if (gateError === 'OPERATOR_ACTIVE' || !persistedInbound?.conversationId) {
                                        outcome = `AI_${gateError}`
                                        return
                                }
                                const gatedConversationId = persistedInbound.conversationId
                                const isQuotaGate = gateError === 'NO_CREDIT'
                                        || (gateError === 'PLAN_BLOCKED' && (result.reason === 'TRIAL_EXPIRED' || result.reason === 'SUBSCRIPTION_EXPIRED'))
                                if (isQuotaGate || gateError === 'AI_UNAVAILABLE' || gateError === 'PLAN_BLOCKED') {
                                        const gateText = isQuotaGate
                                                ? await fixedReplyForWorkspace('quotaExhaustedMessage', agent.workspaceId)
                                                : 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده'
                                        try {
                                                resultMessageId = await persistFixedAssistantReply(
                                                        gatedConversationId,
                                                        gateText,
                                                        eventLease.id,
                                                )
                                        } catch (e) {
                                                console.error('[handler] gate reply persist failed:', e)
                                        }
                                        if (isQuotaGate) {
                                                // Flag the thread for the operator + alert the owner.
                                                await prisma.conversation.updateMany({
                                                        where: { id: gatedConversationId },
                                                        data: { handedOff: true, status: 'HANDED_OFF' },
                                                }).catch(() => {})
                                                await notifyHandoff({
                                                        workspaceId: agent.workspaceId,
                                                        conversationId: gatedConversationId,
                                                        agentId: agent.id,
                                                        agentName: agent.name,
                                                        channel: type,
                                                        contactId,
                                                        contactName,
                                                        contactPhone: null,
                                                        reason: 'ظرفیت پاسخگویی رایگان/پلن این مجموعه تکمیل شده است',
                                                }).catch(() => {})
                                                void processTrialQuotaAlert({
                                                        workspaceId: agent.workspaceId,
                                                        exhausted: true,
                                                })
                                        }
                                        if (eventLease.deliveryStartedAt) {
                                                deliveryUncertain = !eventLease.deliveryCompletedAt
                                                outcome = deliveryUncertain
                                                        ? 'DELIVERY_UNCERTAIN'
                                                        : 'DELIVERY_ALREADY_COMPLETED'
                                                return
                                        }
                                        await deliveryAdapter.sendText(msg.chatId, gateText).catch((e) => {
                                                console.error(`[handler] ${type} quota gate delivery failed:`, e)
                                        })
                                        outcome = isQuotaGate ? 'QUOTA_EXHAUSTED_REPLIED' : `AI_${gateError}_REPLIED`
                                        return
                                }
                                outcome = `AI_${result.error}`
                                return
                        }
                        committedConversationId = result.conversationId
                        resultMessageId = result.messageId ?? null

                        // Product markers are never trusted as customer-facing data. Resolve
                        // them against active products assigned to this agent, then choose the
                        // richest presentation supported by the current channel.
                        const parsedReply = parseProductDirectives(result.reply)
                        const showcasedProducts = agent.productAccessEnabled
                                ? await resolveProductShowcases({
                                        workspaceId: agent.workspaceId,
                                        agentId: agent.id,
                                        directives: parsedReply.directives,
                                })
                                : []
                        const productFallback = formatProductFallback(
                                showcasedProducts,
                                agent.language !== 'en',
                        )
                        let spokenReply = parsedReply.text
                        const sendReplyText = async (replyText: string, quickReplies?: string[]) => {
                                if (textStream) {
                                        const currentStream = textStream
                                        textStream = undefined
                                        try {
                                                await currentStream.finish(replyText, { quickReplies })
                                        } catch (error) {
                                                await currentStream.cancel()
                                                throw error
                                        }
                                        return
                                }
                                await deliveryAdapter.sendText(msg.chatId, replyText, { quickReplies })
                        }

                        const canUseInstagramCarousel =
                                type === 'INSTAGRAM' &&
                                showcasedProducts.length > 0 &&
                                msg.kind !== 'COMMENT' &&
                                msg.kind !== 'REACTION'

                        // Telegram-like (Telegram + Bale) and Rubika: send each
                        // showcased product as a rich card (photo + caption +
                        // inline CTA button) when the adapter supports it. If
                        // sendProductCard fails for any reason, fall through
                        // to the text fallback so the customer still sees the
                        // product info (just less prettily).
                        const canUseProductCards =
                                !canUseInstagramCarousel &&
                                showcasedProducts.length > 0 &&
                                !!deliveryAdapter.sendProductCard

                        try {
                                if (canUseInstagramCarousel) {
                                        if (parsedReply.text) {
                                                await sendReplyText(parsedReply.text, settings.quickReplies)
                                        }
                                        try {
                                                await ensureDispatchStarted()
                                                await sendProductCarousel(
                                                        resolved.config,
                                                        msg.chatId,
                                                        showcasedProducts,
                                                )
                                        } catch (carouselError) {
                                                console.error('[handler] Instagram product carousel failed:', carouselError)
                                                if (productFallback) await deliveryAdapter.sendText(msg.chatId, productFallback)
                                        }
                                } else if (canUseProductCards) {
                                        // Send the text reply (without the text-only fallback,
                                        // since the cards carry the product info graphically),
                                        // then send each product card sequentially. If a card
                                        // send fails, we still send the rest + the text fallback.
                                        if (parsedReply.text) {
                                                await sendReplyText(parsedReply.text, settings.quickReplies)
                                        } else {
                                                await textStream?.cancel()
                                                textStream = undefined
                                        }
                                        const isFa = agent.language !== 'en'
                                        const failedProducts: typeof showcasedProducts = []
                                        for (const product of showcasedProducts) {
                                                try {
                                                        await deliveryAdapter.sendProductCard!(msg.chatId, {
                                                                name: product.name,
                                                                description: product.description ?? null,
                                                                price: product.price == null
                                                                        ? null
                                                                        : isFa
                                                                                ? `${product.price.toLocaleString('fa-IR')} تومان`
                                                                                : product.price.toLocaleString('en-US'),
                                                                badge: isFa ? 'موجود' : 'Available',
                                                                specs: product.specs,
                                                                imageUrl: product.imageUrl,
                                                                productUrl: product.productUrl,
                                                                ctaLabel: isFa ? '🛒 مشاهده و خرید' : 'View / Buy',
                                                        })
                                                } catch (cardError) {
                                                        console.error(`[handler] ${type} product card failed:`, cardError)
                                                        failedProducts.push(product)
                                                }
                                        }
                                        // Preserve every failed item as text. Previously a partial
                                        // failure silently hid the missing product whenever at least
                                        // one sibling card succeeded.
                                        const failedProductFallback = formatProductFallback(failedProducts, isFa)
                                        if (failedProductFallback) {
                                                await deliveryAdapter.sendText(msg.chatId, failedProductFallback, {
                                                        quickReplies: settings.quickReplies,
                                                })
                                        }
                                } else {
                                        const outboundText = [parsedReply.text, productFallback]
                                                .filter(Boolean)
                                                .join('\n\n')
                                        spokenReply = outboundText
                                        await sendReplyText(outboundText || result.reply, settings.quickReplies)
                                }
                        } catch (deliveryError) {
                                await textStream?.cancel()
                                await markAssistantDelivery(resultMessageId, 'failed')
                                throw deliveryError
                        }
                        await markAssistantDelivery(resultMessageId, 'sent')
                        if (type === 'INSTAGRAM') {
                                const policy = instagramPolicy ?? await loadAutomationPolicy(agent.id, resolved.config)
                                const likeEnabled = msg.kind === 'COMMENT'
                                        ? policy.likeCommentAfterReply
                                        : msg.kind === 'STORY_REPLY' || msg.kind === 'STORY_MENTION'
                                                ? policy.likeStoryReplyAfterReply
                                                : msg.kind === 'STORY_REACTION'
                                                        ? policy.likeStoryReactionAfterReply
                                                        : policy.likeDmAfterReply
                                                                await reactAfterInstagramReply(deliveryAdapter, msg, likeEnabled, agent.workspaceId)
                        }

                        // Optional voice reply when the agent has TTS enabled.
                        if (agent.voiceEnabled && deliveryAdapter.sendVoice && spokenReply) {
                                try {
                                        const speech = await synthesizeSpeech({
                                                text: spokenReply || parsedReply.text,
                                                workspaceId: agent.workspaceId,
                                                voice: agent.ttsVoice,
                                                // OpenRouter's dedicated TTS endpoint currently
                                                // guarantees MP3/PCM. Telegram-like adapters send
                                                // MP3 as an audio attachment rather than a voice note.
                                                format: 'mp3',
                                        })
                                        await deliveryAdapter.sendVoice(msg.chatId, speech)
                                } catch (e) {
                                        console.error('[handler] voice reply failed:', e)
                                }
                        }
                        outcome = result.replayed ? 'AI_REPLY_RESUMED' : 'AI_REPLY_SENT'
                        })()
                        await eventGuard.assertActive()
                        await conversationGuard.assertActive()
                        await markInboundEventEffectsCommitted(eventLease, {
                                conversationId: committedConversationId,
                                inboundMessageId,
                                resultMessageId,
                                result: { outcome },
                        })
                        if (deliveryUncertain) {
                                await markInboundEventDeliveryUncertain(
                                        eventLease,
                                        conversationGuard.lease,
                                        committedConversationId,
                                )
                                return
                        }
                        if (deliveryStartedThisAttempt) {
                                await markInboundEventDeliveryCompleted(eventLease)
                        }
                        await completeInboundEvent(eventLease, conversationGuard.lease)
                        },
                        )
                        })
                } catch (e) {
                        // An event absorbed into a concurrent turn dies with LeaseLost BY
                        // DESIGN — that is the merge path succeeding, not a failure. Skip
                        // silently: no error capture, no BullMQ retry (a retry would just
                        // re-claim into the COMPLETED ledger row anyway).
                        if (e instanceof InboundEventLeaseLostError
                                || (e instanceof Error && e.name === 'InboundEventLeaseLostError')) {
                                const mergedAway = await isInboundEventMergedIntoAnotherTurn(eventLease.id)
                                    .catch(() => false)
                                if (mergedAway) continue
                        }
                        // ─ A14: a closed 24-hour Instagram messaging window is a
                        // terminal, non-retryable condition. Retrying through BullMQ only
                        // produced silent FAILED loops (observed: error subcode 2534022,
                        // "This message is sent outside of allowed window"). Instead: mark
                        // the thread as needing an operator, alert the owner, and settle
                        // the ledger row as escalated — the customer's message stays in the
                        // inbox and the operator is explicitly told why the auto-send
                        // stopped.
                        if (e instanceof Error && (e.name === 'Instagram24hWindowError' || /INSTAGRAM_24H_WINDOW_CLOSED/.test(e.message))) {
                                const convId = escalationConversationId
                                if (convId) {
                                        await prisma.conversation.updateMany({
                                                where: { id: convId },
                                                data: { handedOff: true, status: 'HANDED_OFF' },
                                        }).catch(() => {})
                                        await notifyHandoff({
                                                workspaceId: agent.workspaceId,
                                                conversationId: convId,
                                                agentId: agent.id,
                                                agentName: agent.name,
                                                channel: 'INSTAGRAM',
                                                contactId: escalationContactId,
                                                contactName: escalationContactName,
                                                contactPhone: null,
                                                reason: 'پنجره ۲۴ ساعته پاسخ‌دهی اینستاگرام بسته شده است؛ ارسال خودکار ممکن نیست و گفتگو به اپراتور ارجاع شد',
                                        }).catch(() => {})
                                        await notifyWorkspace({
                                                workspaceId: agent.workspaceId,
                                                type: 'HANDOFF',
                                                title: 'پنجره ۲۴ ساعته اینستاگرام بسته است',
                                                body: 'پاسخ خودکار به این مشتری ارسال نشد چون بیش از ۲۴ ساعت از آخرین پیام او گذشته است. برای ادامه گفتگو باید اپراتور پاسخ دهد',
                                                link: `/conversations/${convId}`,
                                        }).catch(() => {})
                                }
                                captureError(`webhook:${type}:ig-window`, e, {
                                        workspaceId: agent.workspaceId,
                                        metadata: { agentId: agent.id, channelId, conversationId: convId },
                                })
                                // Settle the ledger row without a queue retry — the send can
                                // never succeed until the customer messages again.
                                await prisma.inboundEvent.update({
                                        where: { id: eventLease.id },
                                        data: {
                                                state: 'COMPLETED',
                                                completedAt: new Date(),
                                                lastError: null,
                                                result: { outcome: 'IG_WINDOW_CLOSED_ESCALATED' },
                                        },
                                }).catch(() => {})
                                continue
                        }
                        await failInboundEvent(eventLease, e).catch(() => {})
                        captureError(`webhook:${type}`, e, {
                                workspaceId: agent.workspaceId,
                                metadata: { agentId: agent.id, channelId },
                        })
                        deferredError ??= e
                }
        }
        // Surface the failure to the queue so the job is retried.
        if (deferredError) throw deferredError
}

/**
 * Process a raw webhook body for a messenger channel. Designed to run after
 * the HTTP response is returned (fire-and-forget) so platforms don't time out.
 */
export async function handleInbound(
        type: MessengerType,
        webhookToken: string,
        body: unknown,
): Promise<void> {
        if (!isMessengerType(type)) return

        const resolved = await resolveChannel(type, webhookToken)
        if (!resolved) return
        await processChannelInbound(type, resolved, body)
}

/**
 * Process a raw webhook body received by the GLOBAL Instagram webhook
 * (`/api/webhook/instagram`). The platform owns a single Meta App, so all IG
 * events arrive at one URL.
 *
 * DEMUX STRATEGY (the tricky part):
 *
 * With Instagram API with Instagram Login, the id we stored as `igUserId`
 * (from `GET /me`) is the IG user id of the connected account. BUT the id that
 * appears in webhook payloads is DIFFERENT depending on the event type:
 *
 *   - DM events (entry[].messaging[]): the connected account's id appears as
 *     `recipient.id` (NOT entry[].id). entry[].id is ALSO the recipient in
 *     most cases, but we've seen payloads where entry[].id is a different id.
 *   - Comment events (entry[].changes[] field 'comments'): the connected
 *     account appears as `changes[].value.to.id` or `entry[].id`.
 *   - Story mention events: similar to comments.
 *
 * Routing is PER ENTRY, not per batch: Meta aggregates events for multiple
 * subscribed accounts (= multiple tenants) into one POST, so each entry[] is
 * resolved to its own channel from owner-side ids only (entry.id,
 * messaging[].recipient.id, changes[].value.to/recipient.id). Sender-side ids
 * (messaging[].sender.id, changes[].value.from.id) are NEVER used — those
 * identify the customer/commenter and would route a tenant's traffic into
 * another tenant's workspace if that person is also a connected account.
 */
type IgWebhookEntry = {
        id?: string | number
        messaging?: Array<{
                recipient?: { id?: string | number }
                sender?: { id?: string | number }
        }>
        changes?: Array<{
                value?: {
                        to?: { id?: string | number }
                        from?: { id?: string | number }
                        recipient?: { id?: string | number }
                        sender?: { id?: string | number }
                }
        }>
}

/** Owner-side candidate ids for one webhook entry (never sender/commenter ids). */
function entryOwnerIds(e: IgWebhookEntry): string[] {
        const ids = new Set<string>()
        const addId = (v: string | number | undefined | null) => {
                if (v !== undefined && v !== null) ids.add(String(v))
        }
        addId(e.id)
        for (const m of e.messaging ?? []) {
                addId(m.recipient?.id)
                // NOTE: do NOT add sender.id — that's the customer who messaged us.
        }
        for (const c of e.changes ?? []) {
                addId(c.value?.to?.id)
                addId(c.value?.recipient?.id)
                // NOTE: do NOT add from.id — that's the commenter, not our account.
        }
        return Array.from(ids)
}

export async function handleInstagramGlobalInbound(body: unknown): Promise<void> {
        const entries = (body as { entry?: IgWebhookEntry[] })?.entry
        if (!entries?.length) return

        // Resolve each entry to its owning channel. Cache lookups per id so a
        // multi-entry batch for the same account costs one resolution.
        const resolutionCache = new Map<string, ResolvedChannel | null>()
        const resolveCached = async (entityId: string): Promise<ResolvedChannel | null> => {
                if (resolutionCache.has(entityId)) return resolutionCache.get(entityId) ?? null
                const r = await resolveInstagramChannelById(entityId)
                resolutionCache.set(entityId, r)
                return r
        }

        const groups = new Map<string, { resolved: ResolvedChannel; matchedId: string; entries: IgWebhookEntry[] }>()
        const unresolvedEntries: Array<{ entry: IgWebhookEntry; ids: string[] }> = []

        for (const entry of entries) {
                const ids = entryOwnerIds(entry)
                if (!ids.length) continue
                let resolved: ResolvedChannel | null = null
                let matchedId: string | null = null
                for (const entityId of ids) {
                        const r = await resolveCached(entityId)
                        if (r) {
                                resolved = r
                                matchedId = entityId
                                break
                        }
                }
                if (resolved && matchedId) {
                        const g = groups.get(resolved.channelId)
                        if (g) g.entries.push(entry)
                        else groups.set(resolved.channelId, { resolved, matchedId, entries: [entry] })
                } else {
                        unresolvedEntries.push({ entry, ids })
                }
        }

        if (unresolvedEntries.length) {
                // No channel matched an entry's owner-side ids. Older Instagram
                // Login channels may only have the app-scoped `GET /me.id`, while
                // Meta sends `GET /me.user_id` in entry[].id / recipient.id.
                //
                // FALLBACK: if there is exactly ONE Instagram channel in the entire
                // database, assume the unmatched entries are for it. This is safe for
                // the single-tenant case and self-heals: we persist the webhook
                // recipient.id into the channel config so future lookups match
                // directly via the indexed query.
                //
                // The count deliberately spans ALL Instagram channels — including
                // inactive ones, ones whose agent is paused, and ones whose token no
                // longer decrypts. Those are exactly the states that make a legitimate
                // owner unroutable, and counting only *active* channels would then
                // hand that owner's customer DMs to whichever workspace happened to be
                // the only active one.
                const totalIgChannels = await prisma.agentChannel.count({
                        where: { type: 'INSTAGRAM' },
                })
                const allIgChannels =
                        totalIgChannels === 1
                                ? await prisma.agentChannel.findMany({
                                                where: { type: 'INSTAGRAM', active: true, agent: { active: true } },
                                                select: {
                                                        id: true,
                                                        config: true,
                                                        agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                                                },
                                        })
                                : []

                if (totalIgChannels === 1 && allIgChannels.length === 1) {
                        const only = allIgChannels[0]
                        const onlyConfig = (only.config as Record<string, unknown> | null) ?? {}
                        const ignoredWebhookIds = Array.isArray(onlyConfig.ignoredWebhookIds)
                                ? onlyConfig.ignoredWebhookIds.map(String)
                                : []
                        const token = readPageToken(only.config)
                        for (const { entry, ids } of unresolvedEntries) {
                                // Events for a previously-connected account on this channel are
                                // intentionally ignored (account switch leftovers).
                                if (ids.some((id) => ignoredWebhookIds.includes(id))) continue
                                if (!token) continue
                                const resolved: ResolvedChannel = {
                                        channelId: only.id,
                                        config: only.config,
                                        agent: only.agent,
                                        adapter: getAdapter('INSTAGRAM', token),
                                        settings: normalizeInstagramSettings(only.config),
                                }
                                const g = groups.get(only.id)
                                if (g) g.entries.push(entry)
                                else groups.set(only.id, { resolved, matchedId: '(single-channel-fallback)', entries: [entry] })
                        }
                        // Self-heal: persist the webhook recipient.id as an alias so the
                        // indexed query matches next time. We store it under `webhookIgId`
                        // (don't overwrite igUserId — keep both).
                        const first = unresolvedEntries[0]?.entry
                        const recipientId = first?.messaging?.[0]?.recipient?.id
                        const entryId = first?.id
                        const alias = recipientId ? String(recipientId) : entryId ? String(entryId) : null
                        if (alias && token && onlyConfig.webhookIgId !== alias) {
                                await prisma.agentChannel
                                        .update({
                                                where: { id: only.id },
                                                data: {
                                                        config: { ...onlyConfig, webhookIgId: alias } as Prisma.InputJsonValue,
                                                },
                                        })
                                        .catch((e) =>
                                                console.error('[handler] self-heal webhookIgId persist failed:', e),
                                        )
                        }
                } else if (totalIgChannels > 1) {
                        const triedIds = Array.from(new Set(unresolvedEntries.flatMap((u) => u.ids)))
                        captureError(
                                'webhook:INSTAGRAM:no-channel',
                                new Error(
                                        `No Instagram channel found for the owner ids of ${unresolvedEntries.length} webhook entr${
                                                unresolvedEntries.length === 1 ? 'y' : 'ies'
                                        }: ${JSON.stringify(triedIds)}. ` +
                                                'Single-channel fallback not applicable: found ' +
                                                totalIgChannels +
                                                ' IG channels. ' +
                                                'Check /api/agents/{agentId}/channels/instagram-diagnostics to compare.',
                                ),
                                { metadata: { triedIds } },
                        )
                }
                // 0 routable channels: Meta may keep delivering events for an account
                // after its local channel was disconnected. Nothing to do — the signed
                // payload is retained in the webhook debug buffer and safely ignored.
        }

        // Process each tenant's slice of the batch independently so one tenant's
        // failure never blocks another tenant's messages.
        for (const { resolved, matchedId, entries: groupEntries } of Array.from(groups.values())) {
                try {
                        const scopedBody = {
                                ...((body as Record<string, unknown>) ?? {}),
                                entry: groupEntries,
                        }
                        await processChannelInbound('INSTAGRAM', resolved, scopedBody)
                } catch (e) {
                        captureError('webhook:INSTAGRAM:global', e, {
                                metadata: { matchedId },
                        })
                }
        }
}
