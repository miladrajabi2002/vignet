/**
 * Auxiliary model calls — every model request that is not the customer reply
 * itself (turn understanding, cart planner, catalog planner, summaries…).
 *
 * One entry point so that no auxiliary call can skip the accounting:
 *   • the platform monthly budget is checked before the request;
 *   • the economical tier is used unless a caller passes a model on purpose;
 *   • a UsageLog row is written with the call's `purpose` and the customer
 *     turn it served (`turnKey`), so admin reports can split cost by job and
 *     sum the cost of a whole turn;
 *   • the per-turn TurnLedger (when given) collects every call, and the chat
 *     engine stores the total on the assistant message (metadata.turnCost).
 *
 * ESLint forbids importing `chatCompletion` outside lib/ai/llm/ and the reply
 * engines (see .eslintrc.json), so a new auxiliary call has to come through
 * here.
 */
import { prisma } from '@/lib/prisma'
import {
  chatCompletion,
  getPlatformOpenRouterKey,
  type ChatMessage,
  type ChatOptions,
  type ChatTool,
  type ChatToolCall,
  type ChatUsage,
} from '@/lib/ai/openrouter'
import { resolveModelId } from '@/lib/ai/models'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'

export type AuxPurpose =
  | 'understand'
  | 'cart_plan'
  | 'catalog_plan'
  | 'turn_analyzer'
  | 'summary'
  | 'memory'
  | 'eval'
  | 'identity'

export interface AuxCallRecord {
  purpose: AuxPurpose
  model: string
  ok: boolean
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  costUSD: number | null
  latencyMs: number
  errorCode?: string
}

/** Every model call of one customer turn, reply included. */
export class TurnLedger {
  readonly calls: AuxCallRecord[] = []
  reply: { model: string; promptTokens: number; completionTokens: number; cachedTokens: number; costUSD: number | null } | null = null

  constructor(readonly turnKey: string | null = null) {}

  add(record: AuxCallRecord): void {
    this.calls.push(record)
  }

  setReply(model: string, usage: ChatUsage | null): void {
    if (!usage) return
    this.reply = {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedTokens: usage.cachedTokens,
      costUSD: usage.costUSD,
    }
  }

  /** JSON stored on the assistant message as metadata.turnCost. */
  summary(): TurnCostSummary {
    const auxUSD = this.calls.reduce((sum, call) => sum + (call.costUSD ?? 0), 0)
    const replyUSD = this.reply?.costUSD ?? 0
    return {
      v: 1,
      replyUSD: round6(replyUSD),
      auxUSD: round6(auxUSD),
      totalUSD: round6(replyUSD + auxUSD),
      replyModel: this.reply?.model ?? null,
      replyTokens: this.reply ? { in: this.reply.promptTokens, out: this.reply.completionTokens, cached: this.reply.cachedTokens } : null,
      calls: this.calls.map((call) => ({
        purpose: call.purpose,
        model: call.model,
        ok: call.ok,
        in: call.promptTokens,
        out: call.completionTokens,
        usd: call.costUSD == null ? null : round6(call.costUSD),
        ms: call.latencyMs,
        ...(call.errorCode ? { error: call.errorCode } : {}),
      })),
    }
  }
}

export interface TurnCostSummary {
  v: 1
  replyUSD: number
  auxUSD: number
  totalUSD: number
  replyModel: string | null
  replyTokens: { in: number; out: number; cached: number } | null
  calls: Array<{ purpose: AuxPurpose; model: string; ok: boolean; in: number; out: number; usd: number | null; ms: number; error?: string }>
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export class AuxUnavailableError extends Error {
  constructor(readonly code: 'NO_KEY' | 'NO_BUDGET') {
    super(`AUX_${code}`)
    this.name = 'AuxUnavailableError'
  }
}

export interface AuxCompletionParams {
  purpose: AuxPurpose
  workspaceId: string
  agentId?: string | null
  conversationId?: string | null
  messages: ChatMessage[]
  /** A caller that must use a specific model (rare). Default: the economical tier. */
  model?: string
  tools?: ChatTool[]
  toolChoice?: ChatOptions['toolChoice']
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  retries?: number
  ledger?: TurnLedger | null
  /** Overrides ledger.turnKey for the UsageLog row. */
  turnKey?: string | null
}

export interface AuxCompletionResult {
  content: string
  toolCalls: ChatToolCall[]
  usage: ChatUsage
  model: string
  latencyMs: number
}

/** The economical model the platform currently maps the `fast` tier to. */
export async function economicalModel(): Promise<string> {
  const config = await getPlatformAiConfig()
  return resolveModelId(applyPlatformModelPolicy('fast', config), config.providerModels)
}

export async function auxCompletion(params: AuxCompletionParams): Promise<AuxCompletionResult> {
  if (!getPlatformOpenRouterKey()) throw new AuxUnavailableError('NO_KEY')
  const config = await getPlatformAiConfig()
  if (!(await hasPlatformAiBudget(config))) throw new AuxUnavailableError('NO_BUDGET')
  const model = params.model ?? resolveModelId(applyPlatformModelPolicy('fast', config), config.providerModels)
  const startedAt = Date.now()
  try {
    const result = await chatCompletion({
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0,
      maxTokens: params.maxTokens ?? 300,
      tools: params.tools,
      toolChoice: params.toolChoice,
      timeoutMs: params.timeoutMs,
      retries: params.retries,
    })
    const latencyMs = Date.now() - startedAt
    params.ledger?.add({
      purpose: params.purpose,
      model,
      ok: true,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      cachedTokens: result.usage.cachedTokens,
      costUSD: result.usage.costUSD,
      latencyMs,
    })
    recordAuxUsage({
      workspaceId: params.workspaceId,
      agentId: params.agentId ?? null,
      conversationId: params.conversationId ?? null,
      purpose: params.purpose,
      turnKey: params.turnKey ?? params.ledger?.turnKey ?? null,
      model,
      usage: result.usage,
    })
    return { content: result.content, toolCalls: result.toolCalls, usage: result.usage, model, latencyMs }
  } catch (error) {
    params.ledger?.add({
      purpose: params.purpose,
      model,
      ok: false,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      costUSD: null,
      latencyMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name === 'TimeoutError' ? 'TIMEOUT' : error.message.slice(0, 40) : 'ERROR',
    })
    throw error
  }
}

/**
 * Write the UsageLog row. Fire-and-forget: accounting must never fail a
 * customer turn. Before the purpose/turnKey migration is applied the row is
 * still written without those two columns.
 */
export function recordAuxUsage(params: {
  workspaceId: string
  agentId: string | null
  conversationId: string | null
  purpose: AuxPurpose
  turnKey: string | null
  model: string
  usage: ChatUsage
}): void {
  const base = {
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    conversationId: params.conversationId,
    type: 'SUMMARY' as const,
    model: params.model,
    promptTokens: params.usage.promptTokens,
    completionTokens: params.usage.completionTokens,
    reasoningTokens: params.usage.reasoningTokens,
    cachedTokens: params.usage.cachedTokens,
    providerRequestId: params.usage.providerRequestId,
    cost: params.usage.costUSD,
  }
  void prisma.usageLog
    .create({ data: { ...base, purpose: params.purpose, turnKey: params.turnKey } })
    .catch((error: unknown) => {
      const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined
      if (code !== 'P2022' && !(error instanceof Error && error.name === 'PrismaClientValidationError')) return
      return prisma.usageLog.create({ data: base }).catch(() => {})
    })
    .catch(() => {})
}
