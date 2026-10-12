import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PROVIDER_ORDERS,
  DEFAULT_PROVIDER_ROUTING,
  MAX_PROVIDER_ORDER,
  PROVIDER_BENCHMARKS,
  isProviderSlug,
  normalizeProviderRouting,
  parseProviderRouting,
  providerPreferences,
  serializeProviderRouting,
  type ProviderRouting,
} from '@/lib/ai/provider-routing'
import { AGENT_MODELS } from '@/lib/ai/models'

const FAST = 'deepseek/deepseek-v4-flash'
const routing: ProviderRouting = { mode: 'order', sort: 'latency', orders: { [FAST]: ['a', 'b/fp8', 'c'] } }

describe('provider routing — the request preferences', () => {
  it('tries the curated order of the model, best first', () => {
    expect(providerPreferences(FAST, routing)).toEqual({ order: ['a', 'b/fp8', 'c'] })
  })

  it('starts a retry at the next provider instead of the one that just failed', () => {
    expect(providerPreferences(FAST, routing, { attempt: 1 })).toEqual({ order: ['b/fp8', 'c', 'a'] })
    expect(providerPreferences(FAST, routing, { attempt: 2 })).toEqual({ order: ['c', 'a', 'b/fp8'] })
    expect(providerPreferences(FAST, routing, { attempt: 3 })).toEqual({ order: ['a', 'b/fp8', 'c'] })
  })

  it('leaves the choice to OpenRouter in sort mode and for a model without a list', () => {
    expect(providerPreferences(FAST, { ...routing, mode: 'sort' })).toEqual({ sort: 'latency' })
    expect(providerPreferences('other/model', routing)).toEqual({ sort: 'latency' })
    expect(providerPreferences(FAST, { ...routing, orders: { [FAST]: [] } })).toEqual({ sort: 'latency' })
  })

  it('lets an evaluation run pin one provider or score one sort', () => {
    expect(providerPreferences(FAST, routing, { only: 'gmicloud/fp8' })).toEqual({ only: ['gmicloud/fp8'] })
    expect(providerPreferences(FAST, routing, { sort: 'price' })).toEqual({ sort: 'price' })
  })
})

describe('provider routing — stored settings', () => {
  it('reads a row saved before the curated order existed: its sort is kept, the order becomes active', () => {
    expect(parseProviderRouting('latency')).toEqual({ ...DEFAULT_PROVIDER_ROUTING, sort: 'latency' })
    expect(parseProviderRouting('price')).toMatchObject({ mode: 'order', sort: 'price', orders: DEFAULT_PROVIDER_ORDERS })
    expect(parseProviderRouting(null)).toEqual(DEFAULT_PROVIDER_ROUTING)
    expect(parseProviderRouting('{broken')).toEqual(DEFAULT_PROVIDER_ROUTING)
  })

  it('round-trips what the panel saves', () => {
    const saved: ProviderRouting = { mode: 'sort', sort: 'throughput', orders: { ...DEFAULT_PROVIDER_ORDERS, [FAST]: ['gmicloud/fp8', 'baidu/fp8'] } }
    expect(parseProviderRouting(serializeProviderRouting(saved))).toEqual(saved)
  })

  it('drops what is not a provider slug, duplicates, and anything past the limit', () => {
    const cleaned = normalizeProviderRouting({
      mode: 'nonsense',
      sort: 'fastest',
      orders: { [FAST]: ['gmicloud/fp8', 'gmicloud/fp8', 'bad slug', '../etc', 42, ...Array.from({ length: 12 }, (_, index) => `p${index}`)] },
    })
    expect(cleaned.mode).toBe('order')
    expect(cleaned.sort).toBe(DEFAULT_PROVIDER_ROUTING.sort)
    expect(cleaned.orders[FAST]).toHaveLength(MAX_PROVIDER_ORDER)
    expect(cleaned.orders[FAST].slice(0, 2)).toEqual(['gmicloud/fp8', 'p0'])
    expect(isProviderSlug('azure/us')).toBe(true)
    expect(isProviderSlug('Azure US')).toBe(false)
  })

  it('an emptied list stays empty instead of silently returning to the default', () => {
    expect(normalizeProviderRouting({ mode: 'order', sort: 'price', orders: { [FAST]: [] } }).orders[FAST]).toEqual([])
  })
})

describe('provider routing — measured defaults', () => {
  it('has five measured providers, best first, for every reply model', () => {
    for (const model of AGENT_MODELS) {
      const order = DEFAULT_PROVIDER_ORDERS[model.providerId]
      expect(order, model.providerId).toHaveLength(5)
      expect(new Set(order).size).toBe(5)
      expect(order.every(isProviderSlug)).toBe(true)
      expect(order).toEqual(PROVIDER_BENCHMARKS[model.providerId].slice(0, 5).map((row) => row.slug))
    }
  })
})

describe('provider routing — the request body', () => {
  const mocks = vi.hoisted(() => ({ config: vi.fn() }))
  vi.mock('@/lib/platform/commercial-config', () => ({ getPlatformCommercialConfig: mocks.config }))

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    mocks.config.mockResolvedValue({ providerRouting: routing })
  })

  async function sentProvider(options: Record<string, unknown> = {}, model = FAST) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { chatCompletion } = await import('@/lib/ai/openrouter')
    await chatCompletion({ model, messages: [{ role: 'user', content: 'سلام' }], retries: 0, ...options })
    vi.unstubAllGlobals()
    return JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)).provider as Record<string, unknown>
  }

  it('sends the curated order with fallbacks and no data-retention flag', async () => {
    const provider = await sentProvider()
    expect(provider.order).toEqual(['a', 'b/fp8', 'c'])
    expect(provider.allow_fallbacks).toBe(true)
    expect(provider.data_collection).toBe('deny')
    expect(provider).not.toHaveProperty('zdr')
    expect(provider).not.toHaveProperty('sort')
  })

  it('rotates the order on a retry and pins a single provider without fallback for evaluation', async () => {
    expect((await sentProvider({ providerAttempt: 1 })).order).toEqual(['b/fp8', 'c', 'a'])
    const pinned = await sentProvider({ providerOnly: 'gmicloud/fp8' })
    expect(pinned.only).toEqual(['gmicloud/fp8'])
    expect(pinned.allow_fallbacks).toBe(false)
  })

  it('keeps the price cap from filtering out the curated providers', async () => {
    const { maxPriceFor } = await import('@/lib/ai/openrouter')
    for (const model of AGENT_MODELS) {
      const cap = maxPriceFor(model.providerId)
      expect(cap.prompt, model.providerId).toBeGreaterThanOrEqual(0.5)
      expect(cap.completion, model.providerId).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('provider routing — the admin editor', () => {
  it('lists each model’s order with what was measured, and nothing about data retention', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { ProviderRoutingField } = await import('@/components/admin/provider-routing-field')
    const { readFileSync } = await import('node:fs')

    const models = AGENT_MODELS.map((model) => ({ id: model.providerId, label: model.name }))
    const ordered = renderToStaticMarkup(createElement(ProviderRoutingField, { value: DEFAULT_PROVIDER_ROUTING, onChange: () => {}, models }))
    for (const model of AGENT_MODELS) {
      for (const slug of DEFAULT_PROVIDER_ORDERS[model.providerId]) expect(ordered).toContain(slug)
    }
    expect(ordered).toContain('دقت')
    expect(ordered).toContain('بالا بردن')

    const sorted = renderToStaticMarkup(createElement(ProviderRoutingField, { value: { ...DEFAULT_PROVIDER_ROUTING, mode: 'sort' }, onChange: () => {}, models }))
    expect(sorted).not.toContain('relace/fp4')

    const form = readFileSync('components/admin/platform-settings-form.tsx', 'utf8')
    expect(form).toContain('<ProviderRoutingField')
    expect(form).not.toContain('Zero Data Retention')
    expect(form).not.toContain('zeroDataRetention')
  })
})
