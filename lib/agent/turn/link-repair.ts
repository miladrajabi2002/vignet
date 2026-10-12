/**
 * Turn stage «link repair»: when the reply carries a link that is in none of
 * this turn's evidence, the economical model rewrites the reply once without
 * it. Any failure (no key, budget, timeout, a rewrite that still invents a
 * link or drops a marker) returns null and the deterministic strip in the
 * postprocessors takes over, so this stage can only improve the wording.
 */
import { auxCompletion, type TurnLedger } from '@/lib/ai/llm/aux'
import {
  findUngroundedLinks,
  isAcceptableLinkRepair,
  linkRepairMessages,
  type LinkEvidence,
} from '@/lib/agent-kernel/skills/link-grounding'

export interface LinkRepairParams {
  reply: string
  evidence: LinkEvidence
  userMessage?: string
  handoffEnabled?: boolean
  workspaceId: string
  agentId: string
  conversationId: string
  maxTokens: number
  ledger?: TurnLedger | null
}

export async function repairUngroundedLinkReply(params: LinkRepairParams): Promise<string | null> {
  const links = findUngroundedLinks(params.reply, params.evidence)
  if (!links.length) return null
  try {
    const result = await auxCompletion({
      purpose: 'link_repair',
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      conversationId: params.conversationId,
      ledger: params.ledger,
      messages: linkRepairMessages({ reply: params.reply, links, userMessage: params.userMessage, handoffEnabled: params.handoffEnabled }),
      temperature: 0,
      maxTokens: params.maxTokens,
      timeoutMs: 8_000,
      retries: 0,
    })
    const repaired = result.content.trim()
    return isAcceptableLinkRepair({ original: params.reply, repaired, evidence: params.evidence }) ? repaired : null
  } catch {
    return null
  }
}
