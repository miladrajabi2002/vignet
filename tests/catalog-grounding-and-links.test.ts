import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findProducts: vi.fn(),
  findAgentCatalog: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: mocks.findProducts },
    agentCatalog: { findMany: mocks.findAgentCatalog },
  },
}))

import {
  extractProductTerms,
  fetchCatalogProducts,
  planProductRequest,
} from '@/lib/ai/conversation'
import { enforceTrustedLinkPresentation } from '@/lib/agent-kernel/skills/action-capabilities'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import { buildTrustedProductReply, parseProductDirectives } from '@/lib/products/presentation'

function product(params: {
  id: string
  name: string
  description?: string
  attributes?: Record<string, unknown>
  category?: string
  url?: string
}) {
  return {
    id: params.id,
    name: params.name,
    description: params.description ?? null,
    price: 245_000,
    stock: 3,
    images: [`https://cdn.example.com/${params.id}.jpg`],
    externalUrl: params.url ?? `https://shop.example.com/product/${params.id}`,
    sku: null,
    tags: [],
    attributes: params.attributes ?? null,
    queryCount: 0,
    updatedAt: new Date('2026-09-16T00:00:00.000Z'),
    category: params.category ? { name: params.category } : null,
  }
}

describe('catalog grounding for concrete product requests', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not turn cross-field semantic neighbours into the requested product', async () => {
    mocks.findProducts.mockResolvedValue([
      product({
        id: 'home-set',
        name: 'ست خانگی میو پلنگی',
        description: 'بلوز و شلوار راحتی',
        attributes: { رنگ: 'قهوه ای' },
        category: 'ست خانگی',
      }),
      product({ id: 'wide-jeans', name: 'شلوار جین واید', category: 'شلوار' }),
    ])

    const rows = await fetchCatalogProducts('agent-1', ['home-set'], planProductRequest('شلوار پلنگی', []))
    expect(rows).toEqual([])
  })

  it('keeps the real exact item and identifies it for automatic card/link hydration', async () => {
    mocks.findProducts.mockResolvedValue([
      product({
        id: 'leopard-pants',
        name: 'شلوار پلنگی آوا',
        attributes: { رنگ: 'قهوه ای', سایز: '36, 38, 40, 42' },
        category: 'شلوار',
        url: 'https://shop.example.com/product/leopard-pants',
      }),
      product({ id: 'wide-jeans', name: 'شلوار جین واید', category: 'شلوار' }),
    ])

    const rows = await fetchCatalogProducts('agent-1', [], planProductRequest('شلوار پلنگی', []))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'leopard-pants',
      url: 'https://shop.example.com/product/leopard-pants',
      fullTermMatch: true,
    })
  })

  it('does not mislabel a broad one-word category result as one exact product', async () => {
    mocks.findProducts.mockResolvedValue([
      product({ id: 'pants-a', name: 'شلوار آوا', category: 'شلوار' }),
      product({ id: 'pants-b', name: 'شلوار بهار', category: 'شلوار' }),
    ])

    const rows = await fetchCatalogProducts('agent-1', [], planProductRequest('شلوار', []))
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.fullTermMatch === false)).toBe(true)
  })

  it('drops conversational price words from catalog identity terms', () => {
    expect(extractProductTerms('قیمت شومیز آریا چنده؟')).toEqual(['شومیز', 'آریا'])
  })
})

describe('trusted product-link presentation', () => {
  it('removes an empty generic Markdown link instead of showing a fake CTA', () => {
    const reply = enforceTrustedLinkPresentation({
      reply: 'سایز ۴۲ موجود است.\n\nبرای ثبت سفارش، از [این لینک] اقدام کنید.',
      isFa: true,
    })
    expect(reply).toBe('سایز ۴۲ موجود است.')
    expect(reply).not.toContain('[این لینک]')
  })

  it('points to the native product-card button when the same trusted URL will be attached', () => {
    const reply = enforceTrustedLinkPresentation({
      reply: 'برای ثبت سفارش، از [این لینک] اقدام کنید.',
      isFa: true,
      trustedUrl: 'https://shop.example.com/product/leopard-pants',
      preferStructuredProductLink: true,
    })
    expect(reply).toContain('دکمهٔ «مشاهده و خرید» در کارت محصول')
    expect(reply).not.toContain('https://')
    expect(reply).not.toContain('[این لینک]')
  })

  it('replaces a model-authored off-catalog destination with the trusted URL', () => {
    const reply = enforceTrustedLinkPresentation({
      reply: 'از [این لینک](https://evil.example/item) وارد شوید.',
      isFa: true,
      trustedUrl: 'https://shop.example.com/product/leopard-pants',
    })
    expect(reply).toContain('https://shop.example.com/product/leopard-pants')
    expect(reply).not.toContain('evil.example')
  })

  it('keeps the core reply text and appends the canonical card carrying the native URL CTA', async () => {
    const row = product({
      id: 'leopard-pants',
      name: 'شلوار پلنگی آوا',
      attributes: { رنگ: 'قهوه ای', سایز: '36, 38, 40, 42' },
      category: 'شلوار',
      url: 'https://shop.example.com/product/leopard-pants',
    })
    mocks.findAgentCatalog.mockResolvedValue([{ product: row }])
    const skillPlan = compileAgentSkillPlan({
      language: 'fa',
      userMessage: '۴۲',
      history: [],
      productTurn: true,
      catalogAccessEnabled: true,
      richProductCards: true,
    })
    const guarded = runAgentSkillPostprocessors(
      'سایز ۴۲ موجود است.\n\nبرای ثبت سفارش، از [این لینک] اقدام کنید.',
      skillPlan,
      {
        userMessage: '۴۲',
        isFa: true,
        catalogProducts: [{
          name: row.name,
          url: row.externalUrl,
        }],
        preferStructuredProductLink: true,
      },
    )
    const hydrated = await buildTrustedProductReply({
      raw: guarded,
      workspaceId: 'workspace-1',
      agentId: 'agent-1',
      isFa: true,
      preferredProductIds: [row.id],
      identifiedProductIds: [row.id],
    })
    const parsed = parseProductDirectives(hydrated)

    expect(parsed.text).toContain('دکمهٔ «مشاهده و خرید» در کارت محصول')
    expect(parsed.directives).toEqual([{ id: row.id, name: row.name, variant: null }])
    expect(hydrated).toContain('"url":"https://shop.example.com/product/leopard-pants"')
  })
})
