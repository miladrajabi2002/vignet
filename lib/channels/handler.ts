import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateReply, type ChatAgent } from '@/lib/ai/chat-engine'
import { transcribeAudio, downloadAudio } from '@/lib/voice/stt'
import { synthesizeSpeech } from '@/lib/voice/tts'
import { readBotToken, normalizeMessengerSettings } from '@/lib/channels/config'
import {
        getAdapter,
        contactIdField,
        isMessengerType,
        type MessengerType,
} from '@/lib/channels/registry'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'
import { captureError } from '@/lib/errors/capture'
import {
        runInstagramAutomation,
        shouldAgentReply,
        loadAutomationPolicy,
} from '@/lib/instagram/automation'
import {
        readPageToken,
        normalizeInstagramSettings,
} from '@/lib/instagram/config'

const AGENT_SELECT = {
        id: true,
        systemPrompt: true,
        language: true,
        model: true,
        temperature: true,
        maxTokens: true,
        fallbackMessage: true,
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
} satisfies Prisma.AgentSelect

interface ResolvedChannel {
        channelId: string
        config: Prisma.JsonValue
        agent: {
                id: string
                workspaceId: string
                systemPrompt: string
                language: string
                model: string | null
                temperature: number
                maxTokens: number
                fallbackMessage: string | null
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
 *   - For Instagram Login channels: the IG user id (config.igUserId)
 *   - For legacy FB Login channels: the Facebook Page id (config.pageId)
 * We try both fields to cover both connection models.
 */
async function resolveInstagramChannelById(
        entityId: string,
): Promise<ResolvedChannel | null> {
        // First try the indexed Prisma JSON path query (fast).
        let channel = await prisma.agentChannel.findFirst({
                where: {
                        type: 'INSTAGRAM',
                        active: true,
                        OR: [
                                { config: { path: ['igUserId'], equals: entityId } },
                                { config: { path: ['pageId'], equals: entityId } },
                                { config: { path: ['igBusinessAccountId'], equals: entityId } },
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
                        where: { type: 'INSTAGRAM', active: true },
                        select: {
                                id: true,
                                config: true,
                                agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                        },
                })
                channel = all.find((c) => {
                        const cfg = c.config as Record<string, unknown> | null
                        if (!cfg) return false
                        const candidates = [
                                cfg.igUserId,
                                cfg.pageId,
                                cfg.igBusinessAccountId,
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

/** Find or create the contact behind an inbound message. */
async function upsertContact(
        workspaceId: string,
        type: MessengerType,
        msg: InboundMessage,
): Promise<string> {
        const field = contactIdField(type)
        // 1) Match by the channel-specific id first.
        const byChannel = await prisma.contact.findFirst({
                where: { workspaceId, [field]: msg.senderId },
                select: { id: true, name: true, phone: true },
        })
        if (byChannel) {
                // Backfill name/phone if we learned them since.
                const data: Prisma.ContactUpdateInput = {}
                if (!byChannel.name && msg.senderName) data.name = msg.senderName
                if (!byChannel.phone && msg.senderPhone) data.phone = msg.senderPhone
                if (Object.keys(data).length) {
                        await prisma.contact.update({ where: { id: byChannel.id }, data })
                }
                return byChannel.id
        }
        // 2) Cross-channel unification: if the visitor gave the same phone on a
        //    different channel (e.g. WhatsApp now after Telegram earlier), merge by
        //    stamping the new channel id onto the existing contact row. This is the
        //    "one customer, many channels" rule.
        if (msg.senderPhone) {
                const byPhone = await prisma.contact.findFirst({
                        where: { workspaceId, phone: msg.senderPhone },
                        select: { id: true, name: true },
                })
                if (byPhone) {
                        const data: Prisma.ContactUpdateInput = { [field]: msg.senderId }
                        if (!byPhone.name && msg.senderName) data.name = msg.senderName
                        await prisma.contact.update({ where: { id: byPhone.id }, data })
                        return byPhone.id
                }
        }
        // 3) New contact.
        const created = await prisma.contact.create({
                data: {
                        workspaceId,
                        name: msg.senderName ?? null,
                        phone: msg.senderPhone ?? null,
                        [field]: msg.senderId,
                },
                select: { id: true, name: true },
        })
        return created.id
}

/** Look up the contact's display name so we can greet them by name. */
async function getContactName(contactId: string): Promise<string | null> {
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
        for (const msg of messages) {
                try {
                        const text = await resolveText(agent.workspaceId, adapter, msg)
                        if (!text) continue

                        const contactId = await upsertContact(agent.workspaceId, type, msg)
                        const contactName = await getContactName(contactId)

                        // Best-effort "typing…" indicator while the model generates the reply.
                        if (adapter.sendTyping) {
                                adapter
                                        .sendTyping(msg.chatId)
                                        .catch((e) => console.error(`[handler] ${type} typing failed:`, e))
                        }

                        // ─── Instagram automation layer ─────────────────────────────
                        // Keyword scenarios, comment→DM funnels, follow-gates, and smart story
                        // replies run here. When a scenario handles the message, we skip the
                        // default AI turn entirely.
                        let scenarioHandled = false
                        if (type === 'INSTAGRAM') {
                                const auto = await runInstagramAutomation({
                                        agent: { ...chatAgent, workspaceId: agent.workspaceId },
                                        channelId,
                                        channelConfig: resolved.config,
                                        adapter,
                                        msg,
                                        contactId,
                                        contactName,
                                        quickReplies: settings.quickReplies,
                                })
                                scenarioHandled = auto.handled
                                if (scenarioHandled) continue
                        }

                        // ─── Channel reply policy gate (Instagram only) ────────────
                        // Even when no scenario matched, the channel-level policy can
                        // suppress the AI turn: AUTOMATION_ONLY turns AI off entirely,
                        // STOP_AI scenarios set conversation.metadata.aiPaused, and
                        // stop-words pause AI for this single turn. We load the policy
                        // from InstagramAutomationSettings (with a fallback to the inline
                        // snapshot in AgentChannel.config.automationSettings).
                        if (type === 'INSTAGRAM') {
                                const policy = await loadAutomationPolicy(
                                        agent.id,
                                        channelId,
                                        resolved.config,
                                )
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
                                        select: { id: true, metadata: true },
                                })
                                const allow = await shouldAgentReply({
                                        policy,
                                        scenarioHandled,
                                        text,
                                        conversationMetadata: conv?.metadata ?? undefined,
                                })
                                if (!allow) {
                                        // Record the inbound so the operator can see it in the
                                        // inbox, but skip the AI outbound. We do this by calling
                                        // generateReply and discarding the reply — that helper
                                        // persists the inbound USER message either way.
                                        try {
                                                await generateReply({
                                                        workspaceId: agent.workspaceId,
                                                        agent: chatAgent,
                                                        message: text,
                                                        channel: type,
                                                        contactId,
                                                        contactName,
                                                        externalId: msg.chatId,
                                                })
                                        } catch (e) {
                                                console.error(
                                                        '[handler] instagram inbound-only persist failed:',
                                                        e,
                                                )
                                        }
                                        continue
                                }
                        }

                        // generateReply stores the inbound message in the conversation AND
                        // generates the reply. We ALWAYS call it so the inbound is persisted —
                        // even if the outbound reply will fail (e.g. IG-user token can't send
                        // DMs, or the message came from the request folder and hasn't been
                        // accepted yet). A failed send is captured below; the stored inbound
                        // remains visible to the operator in the conversations inbox.
                        const result = await generateReply({
                                workspaceId: agent.workspaceId,
                                agent: chatAgent,
                                message: text,
                                channel: type,
                                contactId,
                                contactName,
                                externalId: msg.chatId,
                        })
                        if ('error' in result) continue

                        // Attempt the outbound reply. For Instagram DMs with an IG-user token
                        // (IGAA…) or for messages still in the request folder, this will throw
                        // — the catch below captures it to /admin/errors so the operator sees
                        // a clear reason. The inbound is already stored at this point.
                        await adapter.sendText(msg.chatId, result.reply, {
                                quickReplies: settings.quickReplies,
                        })

                        // Optional voice reply when the agent has TTS enabled.
                        if (agent.voiceEnabled && adapter.sendVoice) {
                                try {
                                        const speech = await synthesizeSpeech({
                                                text: result.reply,
                                                workspaceId: agent.workspaceId,
                                                voice: agent.ttsVoice,
                                                format: 'ogg',
                                        })
                                        await adapter.sendVoice(msg.chatId, speech)
                                } catch (e) {
                                        console.error('[handler] voice reply failed:', e)
                                }
                        }
                } catch (e) {
                        captureError(`webhook:${type}`, e, {
                                workspaceId: agent.workspaceId,
                                metadata: { agentId: agent.id, channelId },
                        })
                }
        }
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
 * events arrive at one URL; we demultiplex them by the Facebook Page id carried
 * in every entry (`entry.id` for page-scoped events, or the recipient id for
 * messaging events) and route each to the channel that owns that page.
 */
export async function handleInstagramGlobalInbound(
        body: unknown,
): Promise<void> {
        const entries = (body as { entry?: { id?: string | number }[] })?.entry
        if (!entries?.length) return

        // Collect the distinct entity ids mentioned in this batch. `entry.id` is the
        // IG user id (for Instagram Login channels) or the Facebook Page id (for
        // legacy FB Login channels). We coerce to string because Meta sometimes
        // sends `id` as a number in JSON, but our config stores it as a string.
        const entityIds = new Set<string>()
        for (const e of entries) {
                if (e?.id !== undefined && e?.id !== null) {
                        entityIds.add(String(e.id))
                }
        }
        if (!entityIds.size) return

        // Resolve each entity to its channel and process. Multiple entities in one
        // batch (rare) are handled independently.
        await Promise.all(
                Array.from(entityIds).map(async (entityId) => {
                        try {
                                const resolved = await resolveInstagramChannelById(entityId)
                                if (!resolved) {
                                        // Channel not found for this entity id. This is the #1 cause of
                                        // "messages arrive but nothing happens" — log it to /admin/errors
                                        // so the operator can see exactly which id Meta sent vs. what's
                                        // stored in the channel config.
                                        captureError(
                                                'webhook:INSTAGRAM:no-channel',
                                                new Error(
                                                        `No Instagram channel found for entity id "${entityId}". ` +
                                                                'This means the webhook received an event for an IG account that is not connected to any agent, ' +
                                                                'OR the connected channel stores a different id (e.g. pageId instead of igUserId). ' +
                                                                'Check /api/agents/{agentId}/channels/instagram-diagnostics to compare.',
                                                ),
                                                { metadata: { entityId, entityIds: Array.from(entityIds) } },
                                        )
                                        return
                                }
                                await processChannelInbound('INSTAGRAM', resolved, body)
                        } catch (e) {
                                captureError('webhook:INSTAGRAM:global', e, {
                                        metadata: { entityId },
                                })
                        }
                }),
        )
}
