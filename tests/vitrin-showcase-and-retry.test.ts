import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { fetchWithProviderRetry, streamChatWithRetry } from '@/lib/ai/openrouter'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

describe('provider retry — timeouts are really retried', () => {
  it('builds a fresh AbortSignal per attempt so a timed-out attempt is retried', async () => {
    const seenSignals: Array<AbortSignal | null | undefined> = []
    let calls = 0
    const originalFetch = global.fetch
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls += 1
      seenSignals.push(init?.signal)
      if (calls < 3) {
        // Simulate the transport-level error a timeout produces.
        throw Object.assign(new Error('This operation was aborted'), { name: 'TimeoutError' })
      }
      return new Response('{"ok":true}', { status: 200 })
    })
    vi.useFakeTimers()
    try {
      const pending = fetchWithProviderRetry('https://example.invalid/x', { method: 'GET' }, { timeoutMs: 5_000 })
      const advanced = vi.advanceTimersByTimeAsync(10_000)
      const res = await pending
      await advanced
      expect(res.ok).toBe(true)
      expect(calls).toBe(3)
      // Distinct, non-aborted signals per attempt: the pre-fix behavior reused
      // one aborted signal, which made every retry fail instantly.
      expect(seenSignals[0]).toBeTruthy()
      expect(seenSignals[1]).toBeTruthy()
      expect(seenSignals[2]).toBeTruthy()
      expect(seenSignals[0]).not.toBe(seenSignals[1])
      expect(seenSignals[1]).not.toBe(seenSignals[2])
      expect(seenSignals[2]!.aborted).toBe(false)
    } finally {
      vi.useRealTimers()
      global.fetch = originalFetch
    }
  })

  it('fails fast on non-retryable transport errors', async () => {
    const originalFetch = global.fetch
    let calls = 0
    global.fetch = vi.fn(async () => {
      calls += 1
      throw new Error('CERTAIN_FAIL_MARKER')
    })
    try {
      await expect(
        fetchWithProviderRetry('https://example.invalid/x', { method: 'GET' }),
      ).rejects.toThrow('CERTAIN_FAIL')
      expect(calls).toBe(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('exposes the stream retry wrapper used by the chat engine', () => {
    expect(typeof streamChatWithRetry).toBe('function')
    // It must be an async generator so `for await` consumers keep working.
    const probe = streamChatWithRetry({} as never)
    expect(typeof probe[Symbol.asyncIterator]).toBe('function')
    void probe.return?.(undefined as never)
  })
})
