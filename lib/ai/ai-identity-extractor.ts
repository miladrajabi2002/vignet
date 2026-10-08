/**
 * AI IDENTITY EXTRACTOR — the LLM layer of customer identification (F3 v2)
 * ====================================================================
 *
 * WHY THIS EXISTS
 * The regex extractor (lib/ai/customer-identification.ts) is deliberately
 * high-precision after the production junk-name audit: it only trusts
 * unambiguous self-introduction formulas («اسمم علی هستم», "my name is John").
 * That safety costs recall — perfectly natural prose like «من علی هستم»,
 * «مینا هستم، شماره‌ام ۰۹۱۲…» or «جواد فرجی، مازندranی» no longer yields a
 * name, because the patterns that matched them were the same patterns that
 * manufactured contacts named «دیروز درخو» and «تازه».
 *
 * A small language model reads ONE message and answers with strict JSON.
 * It understands context (self-introduction vs. description vs. question),
 * something no practical regex can do for Persian.
 *
 * Both fields are ANCHORED to the customer's own text before they reach the
 * CRM: the name must be a run of whole words from the message and the phone's
 * digits must appear in it. A phone is a merge key (applyContactIdentity
 * joins contacts by it), so an invented number would not just be wrong — it
 * could attach this conversation to another customer's record.
 *
 * DEPLOYMENT SHAPE
 *   • Runs ONLY while the conversation is in the identification flow
 *     (customerInfoState 'pending', or the widget lead form supplied partial
 *     identity) AND the regex found no name in the message.
 *   • Fire-and-forget from the chat engine: the customer's reply never waits
 *     on it. It applies what it finds through the same locked find-or-create
 *     path (applyExtractedIdentity → applyContactIdentity), so concurrent
 *     regex/AI/race outcomes all converge on one merged contact row.
 *   • Budgeted + accounted like every other aux call (auxCompletion with
 *     purpose 'identity' — UsageLog rows included).
 *   • Fail-open by construction: no key, no budget, timeout, malformed JSON
 *     or a model hallucination that fails validation → the turn continues
 *     exactly as if the extractor had never run.
 */

import { prisma } from '@/lib/prisma'
import { auxCompletion, AuxUnavailableError } from '@/lib/ai/llm/aux'
import { toEnglishDigits, normalizePhone } from '@/lib/phone'
import {
        applyExtractedIdentity,
        looksLikePersonName,
        type ExtractedIdentity,
} from '@/lib/ai/customer-identification'
import { captureError } from '@/lib/errors/capture'

const SYSTEM_PROMPT = [
        'You extract a customer\'s own name and phone number from ONE chat message.',
        'Reply with STRICT JSON only: {"name": <string|null>, "phone": <string|null>}',
        'Rules:',
        '- "name": the customer\'s OWN first/last name as they introduce themselves. Examples that MUST yield a name: «اسمم علیه», «نامم سارا محمدی است», «من رضا هستم», «جواد فرجی، از مازندران», "John Doe", "I\'m Jane".',
        '- NEVER return intent words, phrases, places, prices, quantities, product words, or words like «شماره»/«تلفن»/«قیمت»/«سبسکرایبر» as the name.',
        '- The name must be how the person calls THEMSELVES, not the name of a third party, agent, company, or platform.',
        '- If the message does not clearly state the customer\'s own name, "name" must be null.',
        '- "phone": any phone number visible in the message (digits, keep country code if present); null when absent.',
        '- Never invent values. Never guess. JSON only, no markdown fences.',
].join('\n')

/** Only messages worth a model call: cheap pre-filter before the API hit. */
const MIN_MESSAGE_LEN = 3
const MAX_MESSAGE_LEN = 1200

/** Tolerant JSON extraction: strip code fences, slice first { … last }. */
function extractJsonObject(raw: string): string | null {
        const cleaned = raw
                .replace(/```(?:json)?/gi, '')
                .replace(/```/g, '')
                .trim()
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        if (start === -1 || end <= start) return null
        return cleaned.slice(start, end + 1)
}

/** Tokenize into lowercase words with edge punctuation stripped, ZWNJ kept
 *  inside tokens («شماره‌ام» is ONE word, «نام‌خانوادگی» is ONE word). */
function tokenizeWords(value: string): string[] {
        return value
                .toLowerCase()
                .split(/\s+/)
                .map((token) => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
                .filter(Boolean)
}

/** The candidate must be a contiguous run of WHOLE words from the source —
 *  a prefix of a longer word is NOT a quote («دیروز درخو» is not inside
 *  «من دیروز درخواست دادم», because «درخو» is not a whole word there). */
function quotedIn(candidate: string, source: string): boolean {
        const needle = tokenizeWords(candidate)
        if (!needle.length) return false
        const haystack = tokenizeWords(source)
        const n = needle.length
        if (n > haystack.length) return false
        for (let i = 0; i + n <= haystack.length; i++) {
                if (needle.every((word, j) => haystack[i + j] === word)) return true
        }
        return false
}

/** The phone's ten national digits must appear in the message's digits —
 *  spaces, dashes and Persian digits in the source are fine, invention is not. */
function phoneQuotedIn(phone: string, source: string): boolean {
        const national = phone.replace(/\D/g, '').slice(-10)
        return national.length === 10 && toEnglishDigits(source).replace(/\D/g, '').includes(national)
}

/**
 * Parse + validate the model's answer. Pure function (unit-tested): every
 * field passes the same sanity gates the regex layer uses, so a hallucinated
 * «قیمت» or a 200-char "name" can never reach the CRM.
 *
 * When the source message is supplied, the name must be QUOTED from it — a
 * contiguous run of whole words (edge punctuation stripped, ASCII
 * case-insensitive). This is the anti-hallucination anchor: the model can
 * only echo what the customer actually typed, never invent, paraphrase or
 * truncate («دیروز درخو» is not quotable from «من دیروز درخواست دادم»,
 * because «درخو» is not a whole word there).
 */
export function parseAiIdentity(raw: string, sourceMessage?: string): ExtractedIdentity | null {
        const jsonText = extractJsonObject(raw)
        if (!jsonText) return null
        let parsed: unknown
        try {
                parsed = JSON.parse(jsonText)
        } catch {
                return null
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
        const obj = parsed as Record<string, unknown>

        // ── name ──
        let name: string | null = null
        if (typeof obj.name === 'string') {
                const candidate = obj.name.trim().replace(/\s+/g, ' ').slice(0, 60)
                // Letters of any script (plus spaces/apostrophes/hyphens) — a name is
                // never digits, punctuation soup, or a URL. Then the same intent-word
                // filter the regex layer uses, and the quoted-from-source anchor.
                if (
                        candidate.length >= 2 &&
                        candidate.length <= 40 &&
                        /^[\p{L}][\p{L}\s'’\-]*$/u.test(candidate) &&
                        looksLikePersonName(candidate, { contextual: true }) &&
                        (!sourceMessage || quotedIn(candidate, sourceMessage))
                ) {
                        name = candidate
                }
        }

        // ── phone ──
        let phone: string | null = null
        if (typeof obj.phone === 'string' && obj.phone.trim()) {
                const digits = toEnglishDigits(obj.phone).replace(/[^\d+]/g, '')
                phone = normalizePhone(digits)
                if (phone && sourceMessage && !phoneQuotedIn(phone, sourceMessage)) phone = null
        }

        return { name, phone }
}

/**
 * Extract identity from one customer message with a cheap LLM call and, when
 * something is found, apply it to the CRM through the locked merge path.
 * Returns the extracted identity (or null when nothing usable came back) —
 * the caller treats it as best-effort and never blocks on failure.
 */
export async function extractIdentityWithAi(params: {
        workspaceId: string
        conversationId: string
        agentId?: string | null
        message: string
}): Promise<ExtractedIdentity | null> {
        const message = params.message.trim()
        if (message.length < MIN_MESSAGE_LEN) return null
        try {
                // What is still missing? The conversation stays 'pending' until BOTH
                // fields exist, so without this check every turn of a customer who
                // gave a name but no phone would cost a model call that can teach us
                // nothing.
                const conversation = await prisma.conversation
                        .findUnique({
                                where: { id: params.conversationId },
                                select: { contactId: true, contact: { select: { name: true, phone: true } } },
                        })
                        .catch(() => null)
                const needsName = !conversation?.contact?.name?.trim()
                const needsPhone = !conversation?.contact?.phone?.trim()
                const mayHoldPhone = toEnglishDigits(message).replace(/\D/g, '').length >= 10
                if (!needsName && !(needsPhone && mayHoldPhone)) return null

                const result = await auxCompletion({
                        purpose: 'identity',
                        workspaceId: params.workspaceId,
                        agentId: params.agentId ?? null,
                        conversationId: params.conversationId,
                        messages: [
                                { role: 'system', content: SYSTEM_PROMPT },
                                { role: 'user', content: message.slice(0, MAX_MESSAGE_LEN) },
                        ],
                        maxTokens: 100,
                        timeoutMs: 12_000,
                })

                const parsed = parseAiIdentity(result.content, message)
                if (!parsed) return null
                // A name the CRM already holds is never replaced by a model reading.
                if (!needsName) parsed.name = null
                if (!parsed.name && !parsed.phone) return parsed

                // Attach to the conversation's existing contact when one exists (the
                // main flow may have already linked one via phone/platform identity);
                // applyExtractedIdentity merges instead of duplicating.
                await applyExtractedIdentity({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        contactId: conversation?.contactId ?? null,
                        extracted: parsed,
                })
                return parsed
        } catch (error) {
                // Expected, benign unavailability (no key / no platform budget) is not
                // an error worth polluting the log with — anything else is captured.
                if (!(error instanceof AuxUnavailableError)) {
                        captureError('ai:identity-extractor', error as Error, {
                                workspaceId: params.workspaceId,
                                metadata: { conversationId: params.conversationId },
                        })
                }
                return null
        }
}
