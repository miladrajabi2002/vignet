/**
 * Provider prompt caching reuses the longest identical PREFIX of a request.
 * These guards keep the stable parts first: a per-turn value placed before
 * them would make every call pay full price for the whole prompt.
 */
import { describe, expect, it } from 'vitest'
import { buildUnderstandMessages } from '@/lib/agent/understand/prompt'
import { UNDERSTAND_TOOL } from '@/lib/agent/understand/schema'
import { buildMessages } from '@/lib/ai/rag'
import type { TurnCandidates } from '@/lib/agent/understand/types'

const candidates = (overrides: Partial<TurnCandidates> = {}): TurnCandidates => ({
  capabilities: ['products'], pending: null, task: null, shownCards: [], cart: [], active: null, seen: [],
  services: [], courses: [], vocabulary: [], categories: [], ...overrides,
})

describe('cache-friendly prompt layout', () => {
  it('the understanding call has a fully static system prompt and tool; every per-turn value is in the last message', () => {
    const one = buildUnderstandMessages({ message: 'شومیز دارین؟', recent: [], candidates: candidates() })
    const two = buildUnderstandMessages({ message: 'پسفردا عصر وقت دارید؟', recent: [{ role: 'assistant', content: 'سلام' }], candidates: candidates({ capabilities: ['bookings'], services: [{ ref: 'svc:1', id: 'x', name: 'کوتاهی مو' }] }) })
    expect(one[0]).toEqual(two[0])
    expect(one).toHaveLength(2)
    expect(JSON.stringify(UNDERSTAND_TOOL)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('the reply prompt starts with the agent’s own stable prompt, before catalog rows, knowledge and state', () => {
    const base = 'تو دستیار فروشگاه هستی. همیشه مؤدب و کوتاه جواب بده.'
    const turn = (userMessage: string, productName: string) => buildMessages({
      systemPrompt: base,
      language: 'fa',
      contextText: `دانش: ${userMessage}`,
      catalogProducts: [{ id: 'p', name: productName, description: null, price: 1000, stock: 1, category: null, image: null, url: null, attributes: null, tags: [] }],
      history: [],
      userMessage,
      turnSignal: true,
    })
    const a = turn('مبل دارین؟', 'مبل ونیز')
    const b = turn('میز دارین؟', 'میز آپادانا')
    expect(a[0].content?.startsWith(base)).toBe(true)
    expect(b[0].content?.startsWith(base)).toBe(true)
  })
})
