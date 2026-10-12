import type { ChatMessage } from '@/lib/ai/openrouter'
import {
  buildLinkEvidence,
  cutUngroundedLinkSentences,
  findUngroundedLinks,
  MARKER_RE,
  type LinkEvidence,
} from '@/lib/agent/parsers/links'

export { buildLinkEvidence, findUngroundedLinks, type LinkEvidence }

export const LINK_GROUNDING_SKILL_VERSION = '1.0.0'

/**
 * Link grounding: a reply may only COPY a link, never compose one.
 *
 * A URL is grounded when it appears in what the model was shown on this turn
 * (agent instructions, retrieved knowledge, catalog rows, order data, the
 * conversation itself). Anything else — a transliterated brand name with a
 * guessed path, a placeholder domain — is invented, however plausible it
 * reads, and is never sent to a customer.
 */
export type LinkGuardMode = 'off' | 'shadow' | 'enforce'

/**
 * Rollout switch. Enforced by default; AGENT_LINK_GUARD=shadow records the
 * guard code without changing the reply, AGENT_LINK_GUARD=off is the
 * emergency stop.
 */
export function resolveLinkGuardMode(value: string | undefined = process.env.AGENT_LINK_GUARD): LinkGuardMode {
  return value === 'off' || value === 'shadow' ? value : 'enforce'
}

/**
 * The turn's model input, the catalog rows selected for it, and the texts the
 * business wrote itself (a fallback message may carry its own link).
 */
export function linkEvidenceForTurn(
  messages: ChatMessage[],
  catalogProducts: Array<{ url?: string | null }> = [],
  businessTexts: Array<string | null | undefined> = [],
): LinkEvidence {
  return buildLinkEvidence([
    ...messages.map((message) => (typeof message.content === 'string' ? message.content : null)),
    ...catalogProducts.map((product) => product.url),
    ...businessTexts,
  ])
}

function noLinkNotice(isFa: boolean, handoffEnabled: boolean): string {
  if (isFa) {
    return handoffEnabled
      ? 'لینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم؛ اگه بخواید، این موضوع رو به همکارم می‌سپارم'
      : 'لینک تأییدشده‌ای برای این مورد در اطلاعاتم ندارم'
  }
  return handoffEnabled
    ? 'I don’t have a confirmed link for this in my information; if you like, I can pass it to a colleague.'
    : 'I don’t have a confirmed link for this in my information.'
}

/**
 * Deterministic last resort: cut every sentence that carries an ungrounded
 * link and say plainly, in its place, that no confirmed link is on record. A
 * sentence that sends the customer to an invented address has no reliable
 * part worth keeping.
 */
export function stripUngroundedLinks(params: {
  reply: string
  evidence: LinkEvidence
  isFa: boolean
  handoffEnabled?: boolean
}): { reply: string; removed: string[] } {
  const MARKER = '\u0000notice\u0000'
  const cut = cutUngroundedLinkSentences(params.reply, params.evidence, MARKER)
  if (!cut.removed.length) return { reply: params.reply, removed: [] }
  const notice = noLinkNotice(params.isFa, params.handoffEnabled ?? false)
  const reply = cut.text.replace(MARKER, notice).replace(/\n{3,}/g, '\n\n').trim()
  return { reply, removed: cut.removed }
}

/**
 * One rewrite attempt before the deterministic strip: the model removes the
 * invented link itself, so the wording stays natural. The caller re-checks
 * the result; a rewrite that still carries an ungrounded link, or changes
 * the markers, is discarded.
 */
export function linkRepairMessages(params: {
  reply: string
  links: string[]
  userMessage?: string
  handoffEnabled?: boolean
}): ChatMessage[] {
  const handoff = params.handoffEnabled
    ? ', and offer once, briefly, to pass it to a colleague if the customer likes'
    : ''
  return [
    {
      role: 'system',
      content: [
        'You edit one customer-support reply before it is sent.',
        `These links in the reply are NOT in the business's verified data and must not be sent: ${params.links.join(' , ')}`,
        'Rewrite the reply with the smallest possible change:',
        '- Remove those links and every sentence or phrase that points to them or assumes the customer now has them («لینک زیر», «از این آدرس», "the link below").',
        `- In their place, say in one short sentence that you do not have a confirmed link for this${handoff}.`,
        '- Add no link, address, phone number, website section or any other new fact.',
        '- Keep every other sentence as it is, and write the new sentence in the same language and the same formal or informal register as the rest of the reply.',
        '- Copy any line that starts with [[ exactly as it is.',
        'Output only the rewritten reply.',
        ...(params.userMessage?.trim() ? [`For context, the customer wrote: «${params.userMessage.trim().slice(0, 400)}»`] : []),
      ].join('\n'),
    },
    { role: 'user', content: params.reply },
  ]
}

function markersOf(text: string): string {
  return (text.match(MARKER_RE) ?? []).join('\n')
}

/** Is the rewrite safe to send instead of the original reply? */
export function isAcceptableLinkRepair(params: { original: string; repaired: string; evidence: LinkEvidence }): boolean {
  const repaired = params.repaired.trim()
  if (!repaired) return false
  if (repaired.length > params.original.length * 1.5 + 120) return false
  if (markersOf(repaired) !== markersOf(params.original)) return false
  return findUngroundedLinks(repaired, params.evidence).length === 0
}
