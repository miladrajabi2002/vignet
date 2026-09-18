import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    knowledgeChunk: { findMany: vi.fn(), create: vi.fn() },
    knowledgeBase: { findFirst: vi.fn(), create: vi.fn() },
    agentCatalog: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({ embedText: vi.fn() }))
vi.mock('@/lib/knowledge/vector-store', () => ({
  insertChunk: vi.fn(),
  deleteChunksForProduct: vi.fn(),
}))
vi.mock('@/lib/ai/catalog-lexicon', () => ({ invalidateAgentCatalogLexicon: vi.fn() }))

import { buildProductIdentityText, buildProductText } from '@/lib/products/catalog'

function sampleProduct(overrides: Partial<Parameters<typeof buildProductIdentityText>[0]> = {}) {
  return {
    id: 'p1',
    workspaceId: 'ws1',
    name: 'میز عسلی نگار آکام چوب طرح ترکمن',
    description: 'میز عسلی با صفحه متحرک و باکس مخفی. چوب راش با روغن طبیعی. مناسب نشیمن کمکی و پذیرایی.',
    price: 6_970_000,
    comparePrice: null,
    sku: 'AK-60-asali',
    stock: 3,
    tags: ['محصولات نگار آکام چوب', 'محصولات طرح ترکمن'],
    attributes: { 'رنگ چوب': ['افرا', 'بلوط', 'گردویی'] },
    category: { name: 'میز عسلی' },
    ...overrides,
  }
}

describe('buildProductIdentityText — compact semantic index v2', () => {
  it('carries identity fields only, never the description', () => {
    const text = buildProductIdentityText(sampleProduct())
    expect(text).toContain('نام محصول: میز عسلی نگار آکام چوب طرح ترکمن')
    expect(text).toContain('دسته: میز عسلی')
    expect(text).toContain('کد: AK-60-asali')
    expect(text).toContain('رنگ چوب: افرا، بلوط، گردویی')
    // description words must NOT leak into the identity doc
    expect(text).not.toContain('باکس مخفی')
    expect(text).not.toContain('چوب راش')
  })

  it('renders tags once, compactly', () => {
    const text = buildProductIdentityText(sampleProduct())
    expect(text).toContain('تگ‌ها: محصولات نگار آکام چوب، محصولات طرح ترکمن')
  })

  it('flattens WooCommerce variation attribute values as lines', () => {
    const text = buildProductIdentityText(
      sampleProduct({
        attributes: {
          _variations: [
            { attributes: { 'رنگ': 'آبی', 'سایز': 'XL' } },
            { attributes: { 'رنگ': 'سبز', 'سایز': 'L' } },
          ],
        },
      }),
    )
    expect(text).toContain('رنگ: آبی')
    expect(text).toContain('سایز: XL')
    expect(text).toContain('رنگ: سبز')
    expect(text).toContain('سایز: L')
  })

  it('dedupes repeated variation lines', () => {
    const text = buildProductIdentityText(
      sampleProduct({
        attributes: {
          _variations: [
            { attributes: { 'رنگ': 'گردویی' } },
            { attributes: { 'رنگ': 'گردویی' } },
          ],
        },
      }),
    )
    expect(text.match(/رنگ: گردویی/g)?.length).toBe(1)
  })

  it('stays compact compared to the full product text', () => {
    const product = sampleProduct()
    expect(buildProductIdentityText(product).length).toBeLessThan(
      buildProductText(product).length,
    )
  })

  it('handles minimal products (name only) without crashing', () => {
    const text = buildProductIdentityText(
      sampleProduct({ description: null, sku: null, tags: [], attributes: null, category: null }),
    )
    expect(text).toBe('نام محصول: میز عسلی نگار آکام چوب طرح ترکمن')
  })
})
