import { describe, expect, it, vi } from 'vitest'
import { historyForProductTurn, planProductRequest } from '@/lib/ai/conversation'
import type { ChatMessage } from '@/lib/ai/openrouter'
import { fetchWithProviderRetry, streamChatWithRetry } from '@/lib/ai/openrouter'

const user = (content: string): ChatMessage => ({ role: 'user', content })
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content })

describe('vitrin — a bare product phrase is a showcase demand', () => {
  it.each([
    'شومیز',
    'کیف',
    'سارافون مجلسی',
    'کیف دوشی دارین؟',
    'بلوز دارید؟',
    'ساعت مچی دارین؟',
    'شومیز مجلسی',
    'سلام شومیز دارین؟',
    'صندل',
    'کیف میخوام',
    'دنبال کیف هستم',
  ])('sends the vitrin (10 available products) for: %s', (message) => {
    const plan = planProductRequest(message, [])
    expect(plan.isProductTurn).toBe(true)
    expect(plan.explicitShowcase).toBe(true)
    expect(plan.requestedCount).toBe(10)
    expect(plan.inventoryMode).toBe('AVAILABLE')
    expect(plan.searchTerms.length).toBeGreaterThan(0)
  })

  it('carries the bare noun itself as the search term', () => {
    expect(planProductRequest('شومیز', []).searchTerms).toContain('شومیز')
    expect(planProductRequest('کیف دوشی دارین؟', []).searchTerms).toContain('کیف')
  })

  it.each([
    ['قیمت شومیز آریا چنده؟', 'price question'],
    ['شومیز آریا 0378', 'product code lookup'],
    ['شومیز سایز ۴۸ دارین؟', 'sized request'],
    ['شومیز رو دوست نداشتم', 'opinion statement'],
    ['پیراهن وارداتی شنل رنگ صورتی', 'long described item'],
    ['شومیز با پست ارسال میشه؟', 'shipping question'],
    ['شومیز مرجوعی داره؟', 'return policy'],
    ['سه تا شومیز بفرست', 'counted showcase (already explicit)'],
    ['کیف خریدم ولی هنوز نرسیده', 'completed-purchase follow-up'],
  ])('keeps %s a consultation/policy turn (%s), not a bare vitrin', (message) => {
    const plan = planProductRequest(message, [])
    const vitrinOnly =
      plan.explicitShowcase &&
      !/بفرست|ارسال|لیست|نشون/.test(message) &&
      !/سه|۳/.test(message)
    expect(vitrinOnly).toBe(false)
  })

  it('never turns shipping or policy phrases into product turns even with a product noun', () => {
    expect(planProductRequest('هزینه ارسال کتاب چقدره؟', []).isProductTurn).toBe(false)
    expect(planProductRequest('ارسال رایگان برای کفش دارین؟', []).isProductTurn).toBe(false)
    expect(planProductRequest('فروشگاه با اسنپ هم ارسال می‌کنه؟', []).isProductTurn).toBe(false)
    expect(planProductRequest('گوشی با باربری میفرستین؟', []).isProductTurn).toBe(false)
  })
})

describe('catalog intent vocabulary — every store vertical', () => {
  it.each([
    'کیف کوله دارین؟',
    'صندل تاپ دارین',
    'گوشی سامسونگ دارین؟',
    'گوشواره دارین',
    'عطر دارین؟',
    'لپ تاپ دارین',
    'شارژر دارین؟',
    'فرش دارین؟',
    'روتختی دارین',
    'شکلات دارین؟',
    'زعفران دارین',
    'کتاب دارین؟',
    'اسباب بازی دارین',
    'دوچرخه دارین؟',
    'عینک آفتابی دارین',
    'پاوربانک دارین',
  ])('recognizes %s as catalog intent', (message) => {
    expect(planProductRequest(message, []).isProductTurn).toBe(true)
  })

  it('keeps non-shopping sentences out of the catalog', () => {
    expect(planProductRequest('شماره تماس فروشگاه چیه؟', []).isProductTurn).toBe(false)
    expect(planProductRequest('رمز ورود رو فراموش کردم', []).isProductTurn).toBe(false)
    expect(planProductRequest('پشتیبانی آنلاین دارین؟', []).isProductTurn).toBe(false)
  })
})

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

describe('vitrin resets stale product context like any showcase', () => {
  it('drops pre-reset history for a bare vitrin phrase', () => {
    const history: ChatMessage[] = [
      user('تونیک روناز رو ببین'),
      assistant('تونیک روناز 0788 موجود است.'),
    ]
    const plan = planProductRequest('شومیز', history)
    expect(plan.resetProductContext).toBe(true)
    expect(historyForProductTurn(history, plan)).toEqual([])
  })
})
