export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

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

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function requestBody(opts: ChatOptions, stream: boolean): Record<string, unknown> {
  const maxPrice = opts.model.includes('v4-pro')
    ? { prompt: 1.2, completion: 2.4 }
    : opts.model.includes('qwen3.5')
      ? { prompt: 0.2, completion: 1.2 }
      : { prompt: 0.12, completion: 0.24 }
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
      sort: process.env.OPENROUTER_PROVIDER_SORT || 'price',
      data_collection: 'deny',
      zdr: envBoolean('OPENROUTER_ZDR', true),
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
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(),
    body: JSON.stringify(requestBody(opts, false)),
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
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(),
    body: JSON.stringify(requestBody(opts, true)),
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
