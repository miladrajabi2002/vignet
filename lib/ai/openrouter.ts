export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
import type { PlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { AGENT_MODELS } from '@/lib/ai/models'

// ─ A4: provider retry policy ────────────────────────────────────────────────
// Transient failures (network blips, timeouts, 429/5xx) are retried up to
// PROVIDER_RETRY_ATTEMPTS extra times with a short back-off. Non-retryable
// statuses (4xx auth/validation) fail immediately — retrying those only adds
// latency before the same rejection.
const PROVIDER_RETRY_ATTEMPTS = 2
const PROVIDER_RETRY_DELAY_MS = 4_000

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableProviderStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599)
}

function isRetryableProviderError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e.name === 'TimeoutError' || e.name === 'AbortError' || e.name === 'TypeError') return true
  return /fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(e.message)
}

/**
 * fetch() with provider-grade retries (A4). Returns the first acceptable
 * response (ok OR non-retryable status). Throws the last network error when
 * every attempt fails.
 */
export async function fetchWithProviderRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= PROVIDER_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleepMs(PROVIDER_RETRY_DELAY_MS)
    try {
      const res = await fetch(url, init)
      if (res.ok || !isRetryableProviderStatus(res.status)) return res
      // Retryable status — drain the body so the socket is released, then retry.
      await res.text().catch(() => undefined)
      lastError = new Error(`OPENROUTER_HTTP_${res.status}`)
    } catch (e) {
      if (!isRetryableProviderError(e)) throw e
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('OPENROUTER_RETRY_EXHAUSTED')
}

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
    max_tokens: Math.min(Math.max(opts.maxTokens ?? 700, 1), opts.task === 'learning-review' ? 4500 : 1200),
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
  /** Internal batch analysis; never populated from customer request fields. */
  task?: 'learning-review'
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
  const res = await fetchWithProviderRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(),
    body: JSON.stringify(requestBody(opts, false, runtime)),
    signal: AbortSignal.timeout(opts.task === 'learning-review' ? 120_000 : 60_000),
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
  // A4: retried via fetchWithProviderRetry — a failed handshake (timeout / 5xx /
  // 429) is transparently retried before the stream surfaces any error.
  const res = await fetchWithProviderRetry(`${OPENROUTER_BASE}/chat/completions`, {
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
