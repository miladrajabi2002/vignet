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
import { runInstagramAutomation } from '@/lib/instagram/automation'
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
 * Resolve an Instagram channel by its Facebook Page id — used by the GLOBAL
 * webhook (`/api/webhook/instagram`) which receives all events for the
 * platform's single Meta App and demultiplexes them by page.
 */
async function resolveInstagramChannelByPageId(
        pageId: string,
): Promise<ResolvedChannel | null> {
        const channel = await prisma.agentChannel.findFirst({
                where: {
                        type: 'INSTAGRAM',
                        active: true,
                        config: { path: ['pageId'], equals: pageId },
                },
                select: {
                        id: true,
                        config: true,
                        agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                },
        })
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
                        if (type === 'INSTAGRAM') {
                                const auto = await runInstagramAutomation({
                                        agent: { ...chatAgent, workspaceId: agent.workspaceId },
                                        channelId,
                                        adapter,
                                        msg,
                                        contactId,
                                        contactName,
                                        quickReplies: settings.quickReplies,
                                })
                                if (auto.handled) continue
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
        const entries = (body as { entry?: { id?: string }[] })?.entry
        if (!entries?.length) return

        // Collect the distinct page ids mentioned in this batch. `entry.id` is the
        // Page id for both messaging and change events on Instagram.
        const pageIds = new Set<string>()
        for (const e of entries) {
                if (e.id) pageIds.add(e.id)
        }
        if (!pageIds.size) return

        // Resolve each page to its channel and process. Multiple pages in one batch
        // (rare) are handled independently.
        await Promise.all(
                Array.from(pageIds).map(async (pageId) => {
                        try {
                                const resolved = await resolveInstagramChannelByPageId(pageId)
                                if (!resolved) return
                                await processChannelInbound('INSTAGRAM', resolved, body)
                        } catch (e) {
                                captureError('webhook:INSTAGRAM:global', e, {
                                        metadata: { pageId },
                                })
                        }
                }),
        )
}
