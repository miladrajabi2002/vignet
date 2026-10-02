import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/platform/commercial-config', () => ({
  getPlatformCommercialConfig: vi.fn(async () => ({ providerSort: 'price', zeroDataRetention: false })),
}))

import { streamChat } from '@/lib/ai/openrouter'

function sseResponse(events: unknown[]): Response {
  const body = events.map((event) => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`).join('')
  return new Response(new TextEncoder().encode(body), { status: 200 })
}

async function collect(iterator: AsyncGenerator<string>): Promise<string> {
  let text = ''
  for await (const delta of iterator) text += delta
  return text
}

describe('OpenRouter streaming', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('streams content deltas and reports usage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      { choices: [{ delta: { content: 'سلام' } }] },
      ': keep-alive',
      { choices: [{ delta: { content: ' دوست' } }] },
      { id: 'req-1', choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.001 } },
      '[DONE]',
    ])))
    const onUsage = vi.fn()

    const text = await collect(streamChat({ model: 'm', messages: [], onUsage }))

    expect(text).toBe('سلام دوست')
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 10, completionTokens: 2, costUSD: 0.001 }))
  })

  it('fails a stream that reports a provider error after the handshake', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      { choices: [{ delta: { content: 'نیمه' } }] },
      { error: { code: 502, message: 'upstream died' }, choices: [{ delta: { content: '' }, finish_reason: 'error' }] },
    ])))

    await expect(collect(streamChat({ model: 'm', messages: [] }))).rejects.toThrow('OPENROUTER_STREAM_ERROR')
  })
})

describe('streaming chat credit settlement contract', () => {
  const engine = readFileSync(join(process.cwd(), 'lib/ai/chat-engine.ts'), 'utf8')
  const cancelBody = engine.slice(engine.indexOf('cancel() {'), engine.indexOf('return { conversationId, stream }'))

  it('does not refund a reply just because the client disconnected', () => {
    // start() keeps generating and persisting after a disconnect, so a refund
    // in cancel() would make every abandoned stream a free reply.
    expect(cancelBody).not.toContain('releaseChatCredit')
    expect(engine).not.toContain('if (clientGone && full.trim()) providerFailed = false')
  })

  it('releases the reservation when the turn throws unexpectedly', () => {
    expect(engine).toContain("await releaseChatCredit(reservation, 'Turn failed unexpectedly')")
    expect(engine).toContain("'chat-engine:stream-turn'")
    // Messenger turns release too; a redelivered event simply reserves again.
    expect(engine.slice(engine.indexOf('export async function generateReply'))).toContain("releaseChatCredit(prep.reservation, 'Turn failed unexpectedly')")
  })
})
