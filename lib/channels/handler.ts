import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateReply, type ChatAgent } from '@/lib/ai/chat-engine'
import { transcribeAudio, downloadAudio } from '@/lib/voice/stt'
import { synthesizeSpeech } from '@/lib/voice/tts'
import { readBotToken } from '@/lib/channels/config'
import {
  getAdapter,
  contactIdField,
  isMessengerType,
  type MessengerType,
} from '@/lib/channels/registry'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'

const AGENT_SELECT = {
  id: true,
  systemPrompt: true,
  language: true,
  model: true,
  temperature: true,
  maxTokens: true,
  fallbackMessage: true,
  voiceEnabled: true,
  ttsVoice: true,
  active: true,
} satisfies Prisma.AgentSelect

/**
 * Locate the active messenger channel for a webhook token, returning the
 * channel, its parent agent, and a ready-to-use adapter. Null when not found.
 */
async function resolveChannel(type: MessengerType, webhookToken: string) {
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

  return { agent: channel.agent, adapter: getAdapter(type, token) }
}

/** Find or create the contact behind an inbound message. */
async function upsertContact(
  workspaceId: string,
  type: MessengerType,
  msg: InboundMessage,
): Promise<string> {
  const field = contactIdField(type)
  const existing = await prisma.contact.findFirst({
    where: { workspaceId, [field]: msg.senderId },
    select: { id: true, name: true, phone: true },
  })
  if (existing) {
    // Backfill name/phone if we learned them since.
    const data: Prisma.ContactUpdateInput = {}
    if (!existing.name && msg.senderName) data.name = msg.senderName
    if (!existing.phone && msg.senderPhone) data.phone = msg.senderPhone
    if (Object.keys(data).length) {
      await prisma.contact.update({ where: { id: existing.id }, data })
    }
    return existing.id
  }
  const created = await prisma.contact.create({
    data: {
      workspaceId,
      name: msg.senderName ?? null,
      phone: msg.senderPhone ?? null,
      [field]: msg.senderId,
    },
    select: { id: true },
  })
  return created.id
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
  const { agent, adapter } = resolved

  const chatAgent: ChatAgent = {
    id: agent.id,
    systemPrompt: agent.systemPrompt,
    language: agent.language,
    model: agent.model,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    fallbackMessage: agent.fallbackMessage,
  }

  const messages = adapter.parseUpdate(body)
  for (const msg of messages) {
    try {
      const text = await resolveText(agent.workspaceId, adapter, msg)
      if (!text) continue

      const contactId = await upsertContact(agent.workspaceId, type, msg)

      const result = await generateReply({
        workspaceId: agent.workspaceId,
        agent: chatAgent,
        message: text,
        channel: type,
        contactId,
        externalId: msg.chatId,
      })
      if ('error' in result) continue

      await adapter.sendText(msg.chatId, result.reply)

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
      console.error(`[handler] ${type} message failed:`, e)
    }
  }
}
