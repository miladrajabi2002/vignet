import type { ChannelType } from '@prisma/client'
import type { PromptConfig } from '@/lib/ai/prompt-builder'

/**
 * Shared chat-engine types, extracted so the conversation/handoff/engine
 * modules can share them without circular imports.
 */

export interface ChatAgent {
        id: string
        systemPrompt: string
        language: string
        model: string | null
        temperature: number
        maxTokens: number
        fallbackMessage: string | null
        handoffEnabled: boolean
        handoffMessage: string | null
        handoffKeywords: string[]
        // ─ F1: layered prompt
        promptConfig: PromptConfig | null
        roleTemplate: string | null
        // ─ F3: customer identification
        requireCustomerInfo: boolean
        customerInfoPrompt: string | null
}

export interface StartChatParams {
        workspaceId: string
        agent: ChatAgent
        message: string
        conversationId?: string
        channel: ChannelType
        contactId?: string
        /** Platform thread id (e.g. Telegram chat id) used to resume conversations. */
        externalId?: string
        /** Customer display name — when present, replaces {customer_name} in the system prompt. */
        contactName?: string | null
        /** Customer phone, e.g. from the widget's pre-chat lead form. */
        contactPhone?: string | null
        /** Id of the message this turn is replying to (quote/reply-to). When set, the quoted message's text is included in the LLM context and the persisted USER message gets `parentId`. */
        replyToMessageId?: string
}

export interface ExperimentConfig {
        active: boolean
        hasVariant: boolean
        split: number
}
