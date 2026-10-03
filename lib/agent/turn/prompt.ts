/**
 * System prompt assembly for one customer turn (moved from chat-engine.ts).
 */
import type { ChannelType, Prisma } from '@prisma/client'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { resolveSystemPrompt } from '@/lib/ai/prompt-builder'
import { customerPreferenceInstruction, type CustomerAgentPreference } from '@/lib/ai/customer-agent-preferences'
import { evidenceMemoryInstruction, type EvidenceMemory } from '@/lib/ai/memory-evidence'
import { identificationInstruction } from '@/lib/ai/customer-identification'
import { buildPlatformContextBlock } from '@/lib/ai/platform-context'
import { readInboundSource } from '@/lib/conversations/source'
import type { TurnLanguage } from '@/lib/ai/turn-language'
import type { ChatAgent } from '@/lib/ai/chat-types'
import { insertBeforeTurnMarker } from '@/lib/ai/catalog-tools'

/**
 * Inject runtime variables into the system prompt.
 *
 * Supported placeholders:
 *   {customer_name}  → contact name (or "مشتری" if unknown)
 *
 * Example system prompt:
 *   "تو دستیار فروش هستی. اگر نام مشتری را می‌دانی، با نام او خطاب کن. نام: {customer_name}"
 */
export function hydrateSystemPrompt(prompt: string, contactName?: string | null): string {
        if (!prompt) return prompt
        const name = (contactName && contactName.trim()) || 'مشتری'
        return prompt.replaceAll('{customer_name}', name)
}

/**
 * Resolve the final system prompt: layered prompt config → role template → legacy
 * free-form. Then hydrate {customer_name}. If the conversation is still in the
 * 'pending' identification state, append the identification instruction.
 */
export function buildSystemPrompt(params: {
        agent: ChatAgent
        customerInfoState: string
        contactName: string | null
        customerPreferences?: CustomerAgentPreference[]
        /** Evidence-anchored long-term memory for this contact+agent (provenance, quarantine, audit). */
        evidenceMemory?: EvidenceMemory | null
        /** Language of the customer's current turn (kernel mirrors it). */
        turnLanguage?: TurnLanguage
        /** Channel the customer is currently talking on (TELEGRAM / WHATSAPP / ...). */
        channel: ChannelType
        /** Channel-native origin (DM / COMMENT / STORY_REPLY / ...) when known. */
        inboundSource?: Prisma.InputJsonValue | null
}): string {
        const { agent, customerInfoState, contactName, customerPreferences = [], turnLanguage, channel, inboundSource } = params

        // 1. Resolve the layered/role prompt, with the legacy prompt as fallback.
        let base = resolveSystemPrompt({
                promptConfig: agent.promptConfig,
                roleTemplate: agent.roleTemplate,
                legacySystemPrompt: agent.systemPrompt,
                language: agent.language,
        })

        // 2. Hydrate {customer_name}.
        base = hydrateSystemPrompt(base, contactName)

        // 3. If the conversation is still pending identification, inject the
        //    collect-info instruction so the agent asks for name+phone first.
        //    The instruction script follows the customer's own turn language
        //    (the kernel's mirroring rule owns the reply language itself).
        if (customerInfoState === 'pending' && agent.requireCustomerInfo) {
                const isFa = (turnLanguage ?? agent.language) !== 'en'
                base += identificationInstruction(isFa, agent.customerInfoPrompt)
        }

        // Explicit per-customer interaction preferences are isolated in CRM
        // metadata and subordinate to business facts, tools and safety rules.
        base += customerPreferenceInstruction((turnLanguage ?? agent.language) === 'en' ? 'en' : 'fa', customerPreferences)

        // Evidence-anchored customer memory: confirmed facts, recorded
        // statements and pending conflict confirmations. Same isolation rules
        // as the preferences block above — this customer's own data only.
        base += evidenceMemoryInstruction((turnLanguage ?? agent.language) === 'en' ? 'en' : 'fa', params.evidenceMemory ?? null)

        // Platform-awareness block: tells the agent which surface it is on
        // (Telegram / WhatsApp / Instagram DM / public comment / story reply /
        // web widget / chat link / API). The block is appended last so it
        // cannot override evidence, scope or safety rules — it only shapes
        // formatting, length and CTA guidance for the active channel.
        base += '\n\n' + buildPlatformContextBlock({
                channel,
                source: readInboundSource(inboundSource ?? null),
                turnLanguage: turnLanguage ?? (agent.language === 'en' ? 'en' : 'fa') as TurnLanguage,
        })

        return base
}

/** Locale-aware default text for provider failures (no configured fallback). */
export function defaultProviderFailureText(lang: TurnLanguage): string {
        if (lang === 'ar') return 'حدث خطأ تقني مؤقت، من فضلك أعد إرسال رسالتك بعد لحظات'
        if (lang === 'en') return 'A temporary technical issue occurred — please message again in a few moments'
        return 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده'
}

export function appendSalesGuidance(
        messages: ChatMessage[],
        guidance: string,
): void {
        const system = messages.find((item) => item.role === 'system')
        if (!system) return
        // Sales advice changes every turn, so it must not sit in FRONT of the
        // long stable agent prompt: that defeated provider prefix caching on
        // every single reply. Insert it just before the per-turn instruction
        // block instead, which still keeps the authoritative per-turn rules
        // after the (historical) sales advice.
        system.content = insertBeforeTurnMarker(system.content ?? '', `\n\n${guidance}`)
}
