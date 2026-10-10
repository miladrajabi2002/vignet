/**
 * One understanding call per customer turn: economical tier, one JSON object
 * as the reply (see schema.ts for why not a tool call), short timeout, no
 * retry. Any failure (no key, budget, timeout,
 * malformed output, circuit open) returns { ok: false } and the turn falls
 * back to the legacy router — a slow provider never stalls a customer.
 */
import { auxCompletion, AuxUnavailableError, type TurnLedger } from '@/lib/ai/llm/aux'
import type { ChatUsage } from '@/lib/ai/openrouter'
import { buildUnderstandMessages } from '@/lib/agent/understand/prompt'
import { parseUnderstanding } from '@/lib/agent/understand/schema'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import type { TurnCandidates, TurnUnderstanding, VerifiedUnderstanding } from '@/lib/agent/understand/types'

export type UnderstandOutcome =
  | {
      ok: true
      raw: TurnUnderstanding
      verified: VerifiedUnderstanding
      model: string
      latencyMs: number
      usage: ChatUsage
    }
  | {
      ok: false
      errorCode: 'NO_KEY' | 'NO_BUDGET' | 'TIMEOUT' | 'PROVIDER' | 'MALFORMED' | 'CIRCUIT_OPEN' | 'DISABLED'
      model?: string
      latencyMs: number
      usage?: ChatUsage
    }

// Consecutive failures open a short circuit so an outage costs no latency.
const CIRCUIT_LIMIT = 4
const CIRCUIT_COOLDOWN_MS = 2 * 60_000
let consecutiveFailures = 0
let circuitOpenUntil = 0

export function resetUnderstandingCircuit(): void {
  consecutiveFailures = 0
  circuitOpenUntil = 0
}

function failed(): void {
  consecutiveFailures += 1
  if (consecutiveFailures >= CIRCUIT_LIMIT) circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS
}

export interface UnderstandTurnParams {
  workspaceId: string
  agentId: string
  conversationId: string
  message: string
  recent: Array<{ role: 'user' | 'assistant'; content: string | null }>
  candidates: TurnCandidates
  vocabulary?: ReadonlySet<string> | null
  ledger?: TurnLedger | null
  timeoutMs?: number
}

export async function understandTurn(params: UnderstandTurnParams): Promise<UnderstandOutcome> {
  if (process.env.AGENT_UNDERSTANDING_DISABLED === '1') return { ok: false, errorCode: 'DISABLED', latencyMs: 0 }
  if (Date.now() < circuitOpenUntil) return { ok: false, errorCode: 'CIRCUIT_OPEN', latencyMs: 0 }
  const startedAt = Date.now()
  let model: string | undefined
  let usage: ChatUsage | undefined
  try {
    const result = await auxCompletion({
      purpose: 'understand',
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      conversationId: params.conversationId,
      ledger: params.ledger,
      messages: buildUnderstandMessages({ message: params.message, recent: params.recent, candidates: params.candidates }),
      responseFormat: 'json_object',
      temperature: 0,
      maxTokens: 450,
      timeoutMs: params.timeoutMs ?? 6_000,
      retries: 0,
    })
    model = result.model
    usage = result.usage
    const raw = parseUnderstanding(extractJson(result.content))
    if (!raw) {
      failed()
      return { ok: false, errorCode: 'MALFORMED', model, latencyMs: Date.now() - startedAt, usage }
    }
    consecutiveFailures = 0
    const verified = verifyUnderstanding({
      understanding: raw,
      candidates: params.candidates,
      message: params.message,
      recentText: params.recent.map((turn) => turn.content ?? '').join('\n'),
      vocabulary: params.vocabulary,
    })
    return { ok: true, raw, verified, model, latencyMs: Date.now() - startedAt, usage }
  } catch (error) {
    if (error instanceof AuxUnavailableError) return { ok: false, errorCode: error.code, latencyMs: Date.now() - startedAt }
    failed()
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return { ok: false, errorCode: timeout ? 'TIMEOUT' : 'PROVIDER', model, latencyMs: Date.now() - startedAt, usage }
  }
}

function extractJson(content: string): string | null {
  const cleaned = content.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : null
}
