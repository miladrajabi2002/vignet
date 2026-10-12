/**
 * The understanding call asks for one plain JSON object and reads it from the
 * reply content. A forced tool call depended on which provider served the
 * request (see lib/agent/understand/schema.ts), so no tool is sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ aux: vi.fn() }))
vi.mock('@/lib/ai/llm/aux', () => ({
  auxCompletion: mocks.aux,
  AuxUnavailableError: class AuxUnavailableError extends Error {},
}))

import { AuxUnavailableError } from '@/lib/ai/llm/aux'
import { resetUnderstandingCircuit, understandTurn, UNDERSTAND_ATTEMPTS } from '@/lib/agent/understand/understand'
import { UNDERSTAND_SYSTEM_PROMPT } from '@/lib/agent/understand/prompt'
import type { TurnCandidates } from '@/lib/agent/understand/types'

const candidates: TurnCandidates = {
  capabilities: ['products', 'order_capture'], pending: null, task: 'order', shownCards: [],
  cart: [{ ref: 'cart:1', line: 1, productId: 'p1', name: 'میز تلویزیون آپادانا', variant: null, quantity: 1 }, { ref: 'cart:2', line: 2, productId: 'p2', name: 'پاف مراکشی', variant: 'کرم', quantity: 1 }],
  active: null, seen: [], services: [], courses: [], vocabulary: [], categories: [],
}
const usage = { promptTokens: 2800, completionTokens: 60, reasoningTokens: 0, cachedTokens: 0, costUSD: 0.0002, providerRequestId: null }
const reply = (content: string) => ({ content, toolCalls: [], usage, model: 'm', latencyMs: 800 })
const call = (message: string) => understandTurn({ workspaceId: 'w', agentId: 'a', conversationId: 'c', message, recent: [], candidates })

describe('understanding call format', () => {
  beforeEach(() => {
    mocks.aux.mockReset()
    resetUnderstandingCircuit()
  })

  it('asks for a JSON object, sends no tool, and reads the reply content', async () => {
    mocks.aux.mockResolvedValue(reply('{"language":"fa","relation":"reference","answers_pending":false,"confidence":0.95,"customer":{"mood":"neu","buy":2,"cues":[]},"acts":[{"type":"cart_edit","ops":[{"op":"remove","line":"cart:1"}]}]}'))
    const outcome = await call('میزه رو بی‌خیال')
    const sent = mocks.aux.mock.calls[0][0]
    expect(sent.responseFormat).toBe('json_object')
    expect(sent.tools).toBeUndefined()
    expect(sent.toolChoice).toBeUndefined()
    expect(sent.retries).toBe(0)
    expect(outcome.ok && outcome.verified.acts).toEqual([{ type: 'cart_edit', ops: [{ op: 'remove', line: 'cart:1' }] }])
  })

  it('reads JSON wrapped in a code fence or pretty-printed', async () => {
    mocks.aux.mockResolvedValue(reply('```json\n{\n  "language": "fa",\n  "relation": "closing",\n  "confidence": 1,\n  "customer": {"mood": "pos", "buy": 0, "cues": ["thanks"]},\n  "acts": [{"type": "thanks"}]\n}\n```'))
    const outcome = await call('خیلی ممنون')
    expect(outcome.ok && outcome.verified.acts).toEqual([{ type: 'thanks' }])
  })

  it('a reply that is not the agreed shape falls back (MALFORMED), it is never guessed', async () => {
    mocks.aux.mockResolvedValue(reply('{"intent":"cart_edit","target":"cart:1","field":"variant","value":"مشکی"}'))
    expect(await call('مشکیش کن')).toMatchObject({ ok: false, errorCode: 'MALFORMED' })
  })

  const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
  const thanks = '{"language":"fa","relation":"closing","confidence":1,"customer":{"mood":"pos","buy":0,"cues":[]},"acts":[{"type":"thanks"}]}'

  it('tries a slow reading once more instead of routing the turn by regex', async () => {
    mocks.aux.mockRejectedValueOnce(timeout()).mockResolvedValueOnce(reply(thanks))
    const outcome = await call('خیلی ممنون')
    expect(mocks.aux).toHaveBeenCalledTimes(2)
    expect(outcome.ok && outcome.verified.acts).toEqual([{ type: 'thanks' }])
  })

  it('retries a malformed reading too, and gives up after the last attempt', async () => {
    mocks.aux.mockRejectedValue(timeout()).mockResolvedValueOnce(reply('not json'))
    expect(await call('مشکیش کن')).toMatchObject({ ok: false, errorCode: 'TIMEOUT' })
    expect(mocks.aux).toHaveBeenCalledTimes(UNDERSTAND_ATTEMPTS)
  })

  it('starts every retry at the next provider of the curated order', async () => {
    mocks.aux.mockRejectedValue(timeout())
    await call('سلام')
    expect(mocks.aux.mock.calls.map((args) => args[0].providerAttempt)).toEqual(Array.from({ length: UNDERSTAND_ATTEMPTS }, (_, index) => index))
  })

  it('does not retry what a second request cannot change', async () => {
    mocks.aux.mockRejectedValue(Object.assign(new AuxUnavailableError('NO_BUDGET'), { code: 'NO_BUDGET' as const }))
    expect(await call('سلام')).toMatchObject({ ok: false, errorCode: 'NO_BUDGET' })
    expect(mocks.aux).toHaveBeenCalledTimes(1)
  })

  it('opens the circuit after consecutive failed turns, not failed attempts', async () => {
    mocks.aux.mockRejectedValue(timeout())
    for (let turn = 0; turn < 3; turn += 1) expect(await call('سلام')).toMatchObject({ errorCode: 'TIMEOUT' })
    expect(mocks.aux).toHaveBeenCalledTimes(3 * UNDERSTAND_ATTEMPTS)
    expect(await call('سلام')).toMatchObject({ errorCode: 'TIMEOUT' })
    expect(await call('سلام')).toMatchObject({ ok: false, errorCode: 'CIRCUIT_OPEN' })
    expect(mocks.aux).toHaveBeenCalledTimes(4 * UNDERSTAND_ATTEMPTS)
  })

  it('the prompt states the output object and the real-thread definitions', () => {
    expect(UNDERSTAND_SYSTEM_PROMPT).toContain('Reply with ONE JSON object and nothing else')
    expect(UNDERSTAND_SYSTEM_PROMPT).not.toContain('report_understanding')
    // «تو انسانی؟» is not a request for a person; a problem report is not a complaint.
    expect(UNDERSTAND_SYSTEM_PROMPT).toContain('«تو انسانی؟»')
    expect(UNDERSTAND_SYSTEM_PROMPT).toContain('is NOT a complaint')
  })
})
