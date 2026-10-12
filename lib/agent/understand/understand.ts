/**
 * The understanding reading of one customer turn: economical tier, one JSON
 * object as the reply (see schema.ts for why not a tool call). A failed
 * attempt (timeout, provider error, malformed output) is tried again, each
 * time starting at the next provider of the curated order: waiting a few
 * seconds longer costs the customer less than a misread message. When every
 * attempt fails — or there is no key, no budget, or the circuit is open — the
 * result is { ok: false } and the turn is answered without a reading.
 */
import { auxCompletion, AuxUnavailableError, type TurnLedger } from '@/lib/ai/llm/aux'
import type { ChatUsage } from '@/lib/ai/openrouter'
import { UNDERSTANDING_TIMEOUT_MS } from '@/lib/agent/understand/domains'
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

/** Attempts per turn. Each one is a fresh request, on the next provider, with its own timeout. */
export const UNDERSTAND_ATTEMPTS = 3

// Consecutive failed turns open a short circuit so an outage costs no latency.
const CIRCUIT_LIMIT = 4
const CIRCUIT_COOLDOWN_MS = 2 * 60_000
let consecutiveFailures = 0
let circuitOpenUntil = 0

/** Test hook: start every case with a closed circuit. */
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
  let outcome = await attemptUnderstanding(params, startedAt, 0)
  for (let attempt = 1; attempt < UNDERSTAND_ATTEMPTS && isRetryable(outcome); attempt += 1) {
    outcome = await attemptUnderstanding(params, startedAt, attempt)
  }
  if (outcome.ok) consecutiveFailures = 0
  else if (isRetryable(outcome)) failed()
  return outcome
}

/** A missing key or an exhausted budget does not change on a second try. */
function isRetryable(outcome: UnderstandOutcome): boolean {
  return !outcome.ok && (outcome.errorCode === 'TIMEOUT' || outcome.errorCode === 'PROVIDER' || outcome.errorCode === 'MALFORMED')
}

async function attemptUnderstanding(params: UnderstandTurnParams, startedAt: number, attempt: number): Promise<UnderstandOutcome> {
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
      timeoutMs: params.timeoutMs ?? UNDERSTANDING_TIMEOUT_MS,
      retries: 0,
      providerAttempt: attempt,
    })
    model = result.model
    usage = result.usage
    const raw = parseUnderstanding(extractJson(result.content))
    if (!raw) return { ok: false, errorCode: 'MALFORMED', model, latencyMs: Date.now() - startedAt, usage }
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
