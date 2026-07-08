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
import { readPageToken, normalizeInstagramSettings } from '@/lib/instagram/config'

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
        // First try the indexed Prisma JSON path query (fast). We check all
        // possible id fields: igUserId (Instagram Login /me), pageId (legacy FB
        // Login), igBusinessAccountId (legacy), and webhookIgId (self-healed alias
        // — the recipient.id Meta actually sends in webhooks, persisted on first
        // fallback match).
        let channel = await prisma.agentChannel.findFirst({
                where: {
                        type: 'INSTAGRAM',
                        active: true,
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
                        where: { type: 'INSTAGRAM', active: true },
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
): { idField: 'telegramId' | 'baleId' | 'rubikaId' | 'whatsappId' | 'instagramId'; usernameField: string; avatarField: string } {
        switch (type) {
                case 'TELEGRAM':
                        return { idField: 'telegramId', usernameField: 'telegramUsername', avatarField: 'telegramAvatarUrl' }
                case 'BALE':
                        return { idField: 'baleId', usernameField: 'baleUsername', avatarField: 'baleAvatarUrl' }
                case 'RUBIKA':
                        return { idField: 'rubikaId', usernameField: 'rubikaUsername', avatarField: 'rubikaAvatarUrl' }
                case 'WHATSAPP':
                        return { idField: 'whatsappId', usernameField: 'whatsappName', avatarField: 'whatsappAvatarUrl' }
                case 'INSTAGRAM':
                        return { idField: 'instagramId', usernameField: 'instagramUsername', avatarField: 'instagramAvatarUrl' }
        }
}

/** Find or create the contact behind an inbound message. */
async function upsertContact(
        workspaceId: string,
        type: MessengerType,
        msg: InboundMessage,
): Promise<string> {
        const field = contactIdField(type)
        const pf = profileFields(type)
        // 1) Match by the channel-specific id first.
        const byChannel = await prisma.contact.findFirst({
                where: { workspaceId, [field]: msg.senderId },
                select: { id: true, name: true, phone: true },
        })
        if (byChannel) {
                // Backfill name/phone/username if we learned them since.
                const data: Prisma.ContactUpdateInput = {}
                if (!byChannel.name && msg.senderName) data.name = msg.senderName
                if (!byChannel.phone && msg.senderPhone) data.phone = msg.senderPhone
                if (msg.senderUsername) data[pf.usernameField as keyof Prisma.ContactUpdateInput] = msg.senderUsername as never
                if (msg.senderAvatarUrl) data[pf.avatarField as keyof Prisma.ContactUpdateInput] = msg.senderAvatarUrl as never
                if (Object.keys(data).length) {
                        await prisma.contact.update({ where: { id: byChannel.id }, data })
                }
                // Every inbound message keeps the contact's last-activity fresh.
                prisma.contact
                        .update({ where: { id: byChannel.id }, data: { lastActivityAt: new Date() } })
                        .catch(() => {})
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
                        const data: Prisma.ContactUpdateInput = {
                                [field]: msg.senderId,
                                lastActivityAt: new Date(),
                        }
                        if (!byPhone.name && msg.senderName) data.name = msg.senderName
                        if (msg.senderUsername) data[pf.usernameField as keyof Prisma.ContactUpdateInput] = msg.senderUsername as never
                        if (msg.senderAvatarUrl) data[pf.avatarField as keyof Prisma.ContactUpdateInput] = msg.senderAvatarUrl as never
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
                        lastActivityAt: new Date(),
                        ...(msg.senderUsername
                                ? { [pf.usernameField]: msg.senderUsername }
                                : {}),
                        ...(msg.senderAvatarUrl
                                ? { [pf.avatarField]: msg.senderAvatarUrl }
                                : {}),
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

                        // Best-effort backfill of the sender's profile picture. The adapter
                        // fetches the avatar via a platform API call (Telegram getUserProfilePhotos,
                        // Instagram graph profile); when it returns a URL we stamp it onto the
                        // contact's per-channel avatar field (only when empty, so a manually-set
                        // avatar isn't clobbered). Fire-and-forget — never blocks the reply.
                        if (adapter.getAvatarUrl && msg.senderId) {
                                const pf = profileFields(type)
                                adapter
                                        .getAvatarUrl(msg.senderId)
                                        .then((url) => {
                                                if (!url) return null
                                                return prisma.contact.updateMany({
                                                        where: { id: contactId, [pf.avatarField]: null },
                                                        data: { [pf.avatarField]: url },
                                                })
                                        })
                                        .catch((e) => console.error(`[handler] ${type} avatar fetch failed:`, e))
                        }

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
                                const policy = await loadAutomationPolicy(agent.id, channelId, resolved.config)
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
                                                console.error('[handler] instagram inbound-only persist failed:', e)
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
 * To handle ALL cases, we extract EVERY id we can find in the payload
 * (entry[].id, recipient.id, sender.id where it matches entry[].id, changes
 * value.to.id/from.id) and try to resolve ANY of them. The first channel that
 * matches any of these ids handles the whole batch.
 */
export async function handleInstagramGlobalInbound(body: unknown): Promise<void> {
        const entries = (
                body as {
                        entry?: Array<{
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
                        }>
                }
        )?.entry
        if (!entries?.length) return

        // Collect EVERY id mentioned in the payload — entry.id, recipient.id,
        // sender.id, changes.to.id, changes.from.id. Any of these might match our
        // stored igUserId. We try all of them.
        const allIds = new Set<string>()
        const addId = (v: string | number | undefined | null) => {
                if (v !== undefined && v !== null) allIds.add(String(v))
        }
        for (const e of entries) {
                addId(e.id)
                for (const m of e.messaging ?? []) {
                        addId(m.recipient?.id)
                        // NOTE: do NOT add sender.id here — that's the customer who messaged
                        // us, not our account. Adding it would route to the wrong channel.
                }
                for (const c of e.changes ?? []) {
                        addId(c.value?.to?.id)
                        addId(c.value?.from?.id)
                        addId(c.value?.recipient?.id)
                }
        }
        if (!allIds.size) return

        // Try each id until one resolves to a channel. The first match handles the
        // whole batch (the batch is for one account).
        let resolved: ResolvedChannel | null = null
        let matchedId: string | null = null
        for (const entityId of Array.from(allIds)) {
                const r = await resolveInstagramChannelById(entityId)
                if (r) {
                        resolved = r
                        matchedId = entityId
                        break
                }
        }

        if (!resolved) {
                // No channel matched ANY id in the payload. This happens with Instagram
                // API with Instagram Login because the id returned by `GET /me` (what
                // we store as igUserId) can DIFFER from the id Meta sends in webhook
                // payloads (entry[].id / recipient.id). This is a known Meta behavior.
                //
                // FALLBACK: if there is exactly ONE active Instagram channel, assume
                // this payload is for it. This is safe for the common case (one IG
                // account per platform) and self-heals: we also persist the webhook
                // recipient.id into the channel config so future lookups match
                // directly via the indexed query.
                const allIgChannels = await prisma.agentChannel.findMany({
                        where: { type: 'INSTAGRAM', active: true },
                        select: {
                                id: true,
                                config: true,
                                agent: { select: { ...AGENT_SELECT, workspaceId: true } },
                        },
                })
                if (allIgChannels.length === 1) {
                        const only = allIgChannels[0]
                        const token = readPageToken(only.config)
                        if (token && only.agent?.active) {
                                resolved = {
                                        channelId: only.id,
                                        config: only.config,
                                        agent: only.agent,
                                        adapter: getAdapter('INSTAGRAM', token),
                                        settings: normalizeInstagramSettings(only.config),
                                }
                                matchedId = '(single-channel-fallback)'
                                // Self-heal: persist the webhook recipient.id as an alias so the
                                // indexed query matches next time. We store it under
                                // `webhookIgId` (don't overwrite igUserId — keep both).
                                const recipientId = entries[0]?.messaging?.[0]?.recipient?.id
                                const entryId = entries[0]?.id
                                const alias = recipientId ? String(recipientId) : entryId ? String(entryId) : null
                                if (alias) {
                                        const cfg = (only.config as Record<string, unknown> | null) ?? {}
                                        if (cfg.webhookIgId !== alias) {
                                                await prisma.agentChannel
                                                        .update({
                                                                where: { id: only.id },
                                                                data: {
                                                                        config: { ...cfg, webhookIgId: alias } as Prisma.InputJsonValue,
                                                                },
                                                        })
                                                        .catch((e) =>
                                                                console.error('[handler] self-heal webhookIgId persist failed:', e),
                                                        )
                                        }
                                }
                        }
                }

                if (!resolved) {
                        captureError(
                                'webhook:INSTAGRAM:no-channel',
                                new Error(
                                        `No Instagram channel found for any of the ids in this payload: ${JSON.stringify(
                                                Array.from(allIds),
                                        )}. ` +
                                                'Tried single-channel fallback but found ' +
                                                allIgChannels.length +
                                                ' active IG channels. ' +
                                                'Check /api/agents/{agentId}/channels/instagram-diagnostics to compare.',
                                ),
                                { metadata: { triedIds: Array.from(allIds) } },
                        )
                        return
                }
        }

        try {
                await processChannelInbound('INSTAGRAM', resolved, body)
        } catch (e) {
                captureError('webhook:INSTAGRAM:global', e, {
                        metadata: { matchedId },
                })
        }
}
