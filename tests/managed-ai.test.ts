import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentCreateSchema } from '@/lib/validations/agent'
import {
  DEFAULT_MODEL,
  getReplyPriceIRR,
  resolveModelAlias,
  resolveModelId,
} from '@/lib/ai/models'
import { chatCompletion } from '@/lib/ai/openrouter'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('managed model policy', () => {
  it('maps historical or arbitrary provider slugs into a safe alias', () => {
    expect(resolveModelAlias('openai/gpt-4o')).toBe('smart')
    expect(resolveModelAlias('deepseek/deepseek-v4-flash')).toBe('fast')
    expect(resolveModelAlias('deepseek/deepseek-v4.1-flash')).toBe('smart')
    expect(resolveModelAlias('unknown/very-expensive-model')).toBe(DEFAULT_MODEL)
    expect(resolveModelAlias(null)).toBe('fast')
  })

  it('resolves provider models from the admin panel, not env', () => {
    vi.stubEnv('OPENROUTER_MODEL_FAST', 'vendor/ignored')
    expect(resolveModelId('fast')).toBe('deepseek/deepseek-v4-flash')
    expect(resolveModelId('fast', { fast: 'vendor/panel-fast' })).toBe('vendor/panel-fast')
  })

  it('maps the retired managed modes onto the two current ones', () => {
    expect(resolveModelAlias('standard')).toBe('smart')
    expect(resolveModelAlias('balanced')).toBe('smart')
    expect(resolveModelAlias('premium')).toBe('smart')
    expect(resolveModelId('premium')).toBe('deepseek/deepseek-v4.1-flash')
    expect(resolveModelId(null)).toBe('deepseek/deepseek-v4-flash')
  })

  it('rejects raw model slugs and strips legacy client completion controls', () => {
    const rawModel = agentCreateSchema.safeParse({
      name: 'Support',
      model: 'provider/arbitrary-model',
    })
    const oversized = agentCreateSchema.safeParse({
      name: 'Support',
      model: 'fast',
      maxTokens: 8000,
    })
    expect(rawModel.success).toBe(false)
    expect(oversized.success).toBe(true)
    if (oversized.success) expect(oversized.data).not.toHaveProperty('maxTokens')
  })

  it('uses the catalog reply prices (the admin panel overrides them at runtime)', () => {
    vi.stubEnv('AI_REPLY_PRICE_FAST_IRR', '1')
    expect(getReplyPriceIRR('fast')).toBe(4_000)
    expect(getReplyPriceIRR('smart')).toBe(6_500)
    expect(getReplyPriceIRR('premium')).toBe(6_500)
  })
})

describe('OpenRouter platform wrapper', () => {
  it('enforces privacy, price routing and output caps and captures exact cost', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-platform-key')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'gen_test',
          choices: [{ message: { content: 'پاسخ' } }],
          usage: {
            prompt_tokens: 4000,
            completion_tokens: 500,
            cost: 0.00045,
            prompt_tokens_details: { cached_tokens: 250 },
            completion_tokens_details: { reasoning_tokens: 0 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await chatCompletion({
      model: 'deepseek/deepseek-v4-flash',
      messages: [{ role: 'user', content: 'سلام' }],
      maxTokens: 8000,
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.max_tokens).toBe(1200)
    expect(body.reasoning).toEqual({ enabled: false })
    expect(body.provider).toMatchObject({
      sort: 'price',
      data_collection: 'deny',
      zdr: true,
      // Derived from the AGENT_MODELS catalog reference rates × safety margin
      // (deepseek-v4-flash: 0.09/0.18 per M × 3) — a model rotation updates
      // the cap automatically instead of leaving a stale hardcoded value.
      max_price: { prompt: 0.27, completion: 0.54 },
    })
    expect(result.usage).toMatchObject({
      promptTokens: 4000,
      completionTokens: 500,
      cachedTokens: 250,
      costUSD: 0.00045,
      providerRequestId: 'gen_test',
    })
  })
})
