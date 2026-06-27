import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function appHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    // OpenRouter attribution headers (recommended).
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
    'X-Title': 'Vigent',
  }
}

/**
 * Validate an OpenRouter API key by querying the key info endpoint.
 * Returns true when the key is accepted (HTTP 200).
 */
export async function validateOpenRouterKey(key: string): Promise<boolean> {
  if (!key || !key.startsWith('sk-or-')) return false
  try {
    const res = await fetch(`${OPENROUTER_BASE}/key`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    return res.ok
  } catch (e) {
    console.error('[openrouter] validate error:', e)
    return false
  }
}

/**
 * Decrypt and return a workspace's stored OpenRouter key, or null.
 * Server-only — never expose the decrypted key to the client.
 */
export async function getWorkspaceOpenRouterKey(
  workspaceId: string,
): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { openrouterKeyEnc: true },
  })
  if (!ws?.openrouterKeyEnc) return null
  try {
    return decrypt(ws.openrouterKeyEnc)
  } catch (e) {
    console.error('[openrouter] decrypt error:', e)
    return null
  }
}

export interface ChatOptions {
  key: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
}

/** Non-streaming chat completion. Returns the text + token usage. */
export async function chatCompletion(
  opts: ChatOptions,
): Promise<{ content: string; usage: ChatUsage }> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(opts.key),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1000,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenRouter chat failed (${res.status}): ${body}`)
  }
  const json = await res.json()
  return {
    content: json.choices?.[0]?.message?.content ?? '',
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    },
  }
}

/**
 * Streaming chat completion. Yields content deltas as they arrive by parsing
 * the OpenRouter SSE stream. When `onUsage` is provided, we request usage in
 * the stream (`stream_options.include_usage`) and invoke it with the final
 * token counts so callers can log usage without a second request.
 */
export async function* streamChat(
  opts: ChatOptions & { onUsage?: (usage: ChatUsage) => void },
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: appHeaders(opts.key),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1000,
      stream: true,
      ...(opts.onUsage ? { stream_options: { include_usage: true } } : {}),
    }),
  })
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenRouter stream failed (${res.status}): ${body}`)
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
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
        if (json.usage && opts.onUsage) {
          opts.onUsage({
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
          })
        }
      } catch {
        // Ignore keep-alive comments / partial JSON.
      }
    }
  }
}
