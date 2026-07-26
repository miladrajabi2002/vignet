export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
import type { PlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { AGENT_MODELS } from '@/lib/ai/models'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: ChatToolCall[]
}

export interface ChatToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** Server-only platform credential. It is never read from a Workspace row. */
export function getPlatformOpenRouterKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  return key ? key : null
}

function requirePlatformKey(): string {
  const key = getPlatformOpenRouterKey()
  if (!key) throw new Error('PLATFORM_AI_NOT_CONFIGURED')
  return key
}

function appHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requirePlatformKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
    'X-Title': 'Vigent',
  }
}

// Providers charging above the catalog reference rate × this margin are
// filtered out by OpenRouter. Derived from AGENT_MODELS so a model rotation
// can never leave a stale hardcoded cap that silently filters out EVERY
// provider for a tier (the old substring check on 'qwen3.5' did exactly that
// after the catalog moved to qwen3.6/3.7 — those tiers were capped below
// their own listed rates).
const MAX_PRICE_MARGIN = 3
const DEFAULT_MAX_PRICE = { prompt: 1.5, completion: 3 }

function maxPriceFor(model: string): { prompt: number; completion: number } {
  const catalog = AGENT_MODELS.find((m) => m.providerId === model)
  if (!catalog) return DEFAULT_MAX_PRICE
  return {
    prompt: catalog.inputUsdPerMillion * MAX_PRICE_MARGIN,
    completion: catalog.outputUsdPerMillion * MAX_PRICE_MARGIN,
  }
}

function requestBody(
  opts: ChatOptions,
  stream: boolean,
  runtime: Pick<PlatformCommercialConfig, 'providerSort' | 'zeroDataRetention'>,
): Record<string, unknown> {
  const maxPrice = maxPriceFor(opts.model)
  return {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.55,
    // Hard server-side ceiling: a stale Agent row can no longer request an
    // 8,000-token completion against the shared platform account.
    max_tokens: Math.min(Math.max(opts.maxTokens ?? 700, 1), 1200),
    stream,
    reasoning: { enabled: false },
    provider: {
      sort: runtime.providerSort,
      data_collection: 'deny',
      zdr: runtime.zeroDataRetention,
      allow_fallbacks: true,
      max_price: maxPrice,
    },
    ...(stream && opts.onUsage ? { stream_options: { include_usage: true } } : {}),
    ...(opts.tools?.length ? { tools: opts.tools, tool_choice: opts.toolChoice ?? 'auto' } : {}),
  }
}

export interface ChatOptions {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  onUsage?: (usage: ChatUsage) => void
  tools?: ChatTool[]
  toolChoice?: 'auto' | 'none'
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  cachedTokens: number
  /** Exact OpenRouter request cost when supplied by the API, in USD. */
  costUSD: number | null
  providerRequestId: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function firstChoice(json: Record<string, unknown>): Record<string, unknown> {
  return Array.isArray(json.choices) ? asRecord(json.choices[0]) : {}
}

function parseUsage(payload: unknown): ChatUsage {
  const json = asRecord(payload)
  const usage = asRecord(json.usage)
  const details = asRecord(usage.completion_tokens_details)
  const promptDetails = asRecord(usage.prompt_tokens_details)
  const rawCost = Number(usage.cost)
  return {
    promptTokens: Number(usage.prompt_tokens) || 0,
    completionTokens: Number(usage.completion_tokens) || 0,
    reasoningTokens: Number(details.reasoning_tokens) || 0,
    cachedTokens: Number(promptDetails.cached_tokens) || 0,
    costUSD: Number.isFinite(rawCost) ? rawCost : null,
    providerRequestId: typeof json.id === 'string' ? json.id : null,
  }
}

/** Non-streaming chat completion. Returns text plus exact provider usage. */
export async function chatCompletion(
  opts: ChatOptions,
): Promise<{ content: string; usage: ChatUsage; toolCalls: ChatToolCall[] }> {
  const { getPlatformCommercialConfig } = await import('@/lib/platform/commercial-config')
  const runtime = await getPlatformCommercialConfig()
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(),
    body: JSON.stringify(requestBody(opts, false, runtime)),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    // Do not persist provider bodies: they may contain request fragments.
    throw new Error(`OPENROUTER_CHAT_${res.status}`)
  }
  const json = asRecord(await res.json())
  const message = asRecord(firstChoice(json).message)
  const rawToolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
  const toolCalls = rawToolCalls.flatMap((value): ChatToolCall[] => {
    const call = asRecord(value)
    const fn = asRecord(call.function)
    if (
      typeof call.id !== 'string' ||
      call.type !== 'function' ||
      typeof fn.name !== 'string' ||
      typeof fn.arguments !== 'string'
    ) return []
    return [{
      id: call.id,
      type: 'function',
      function: { name: fn.name, arguments: fn.arguments },
    }]
  })
  return {
    content: typeof message.content === 'string' ? message.content : '',
    usage: parseUsage(json),
    toolCalls,
  }
}

/** Stream content deltas and report the final token/cost record. */
export async function* streamChat(
  opts: ChatOptions,
): AsyncGenerator<string, void, unknown> {
  const { getPlatformCommercialConfig } = await import('@/lib/platform/commercial-config')
  const runtime = await getPlatformCommercialConfig()
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(),
    body: JSON.stringify(requestBody(opts, true, runtime)),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok || !res.body) {
    throw new Error(`OPENROUTER_STREAM_${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const parsed: unknown = JSON.parse(data)
        const json = asRecord(parsed)
        const delta = asRecord(firstChoice(json).delta).content
        if (typeof delta === 'string' && delta) yield delta
        if (json.usage && opts.onUsage) opts.onUsage(parseUsage(json))
      } catch {
        // Ignore keep-alive comments and malformed partial chunks.
      }
    }
  }
}
