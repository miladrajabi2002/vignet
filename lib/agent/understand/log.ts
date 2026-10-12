/**
 * Persist one TurnUnderstandingLog row per analysed turn (fire-and-forget).
 * Bounded JSON only: the verified acts and refs, never the transcript.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { UnderstandOutcome } from '@/lib/agent/understand/understand'

export function writeUnderstandingLog(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  messageId: string | null
  outcome: UnderstandOutcome | null
  routedDomains: string[]
}): void {
  const outcome = params.outcome
  const verified = outcome?.ok ? outcome.verified : null
  const data = {
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    // The layer has one mode. «fallback» = no reading: the turn was answered
    // as a plain conversation turn; «skipped» = a message with no text.
    mode: 'on',
    status: outcome?.ok ? 'ok' : outcome ? 'fallback' : 'skipped',
    errorCode: outcome && !outcome.ok ? outcome.errorCode : null,
    model: outcome?.model ?? null,
    latencyMs: outcome ? Math.round(outcome.latencyMs) : null,
    promptTokens: outcome?.usage?.promptTokens ?? 0,
    completionTokens: outcome?.usage?.completionTokens ?? 0,
    costUSD: outcome?.usage?.costUSD ?? null,
    confidence: verified?.confidence ?? null,
    acts: verified ? verified.acts.map((act) => act.type) : [],
    routedDomains: params.routedDomains,
    understanding: verified
      ? JSON.parse(JSON.stringify({
        relation: verified.relation,
        acts: verified.acts,
        answersPending: verified.answersPending,
        clarify: verified.clarify ?? null,
        customer: verified.customer,
        refs: verified.refs,
        notes: verified.notes.slice(0, 12),
        unavailable: verified.unavailable,
      })) as Prisma.InputJsonValue
      : undefined,
  }
  void prisma.turnUnderstandingLog.create({ data }).catch(() => {})
}
