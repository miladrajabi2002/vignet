/**
 * Persist one TurnUnderstandingLog row per analysed turn (fire-and-forget).
 * Bounded JSON only: the verified acts and refs, never the transcript.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { UnderstandOutcome } from '@/lib/agent/understand/understand'
import type { LegacyReading } from '@/lib/agent/understand/legacy-adapter'
import type { UnderstandingMode } from '@/lib/agent/understand/mode'

export function writeUnderstandingLog(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  messageId: string | null
  mode: UnderstandingMode
  outcome: UnderstandOutcome | null
  legacy: LegacyReading | null
  diffKinds: string[]
  agreed: boolean | null
  routedDomains: string[]
  status?: 'ok' | 'fallback' | 'skipped'
}): void {
  const outcome = params.outcome
  const verified = outcome?.ok ? outcome.verified : null
  const data = {
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    mode: params.mode,
    status: params.status ?? (outcome?.ok ? 'ok' : outcome ? 'fallback' : 'skipped'),
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
    legacy: params.legacy ? (JSON.parse(JSON.stringify(params.legacy)) as Prisma.InputJsonValue) : undefined,
    diffKinds: params.diffKinds,
    agreed: params.agreed,
  }
  void prisma.turnUnderstandingLog.create({ data }).catch(() => {})
}
