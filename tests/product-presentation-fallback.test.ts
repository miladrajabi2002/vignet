import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { agentCatalog: { findMany: mocks.findMany } },
}))

import { buildTrustedProductReply, parseProductDirectives } from '@/lib/products/presentation'

const products = [
  {
    id: 'p1',
    name: 'تونیک مینا 0725',
    description: 'جنس: بابوس',
    price: 398000,
    images: ['https://shop.example/mina.jpg'],
    externalUrl: 'https://shop.example/mina',
    attributes: { 'رنگ': 'کرم' },
  },
  {
    id: 'p2',
    name: 'شومیز مونا 0724',
    description: 'جنس: بابوس',
    price: 398000,
    images: ['https://shop.example/mona.jpg'],
    externalUrl: 'https://shop.example/mona',
    attributes: { 'رنگ': 'سفید' },
  },
  {
    id: 'p3',
    name: 'شلوار رویا',
    description: null,
    price: 420000,
    images: [],
    externalUrl: null,
    attributes: null,
  },
]

beforeEach(() => {
  mocks.findMany.mockReset().mockResolvedValue(products.map((product) => ({ product })))
})

describe('trusted product presentation fallback', () => {
  it('hydrates rich cards from exact catalog names when the model omits markers', async () => {
    const raw = [
      'از جنس بابوس دو محصول دارم:',
      '۱. **تونیک مینا 0725** به رنگ کرم.',
      '۲. **شومیز مونا 0724** به رنگ سفید.',
    ].join('\n')

    const reply = await buildTrustedProductReply({
      raw,
      workspaceId: 'w1',
      agentId: 'a1',
      isFa: true,
      preferredProductIds: ['p1', 'p2', 'p3'],
    })
    const parsed = parseProductDirectives(reply)

    expect(parsed.text).toBe(raw)
    expect(parsed.directives.map((directive) => directive.id)).toEqual(['p1', 'p2'])
    expect(reply).not.toContain('[[product:{"id":"p3"')
  })

  it('does not add cards when no exact returned product name is present', async () => {
    const raw = 'چند گزینه موجود است؛ چه رنگی می‌خواهید؟'
    const reply = await buildTrustedProductReply({
      raw,
      workspaceId: 'w1',
      agentId: 'a1',
      isFa: true,
      preferredProductIds: ['p1', 'p2'],
    })

    expect(reply).toBe(raw)
  })
})
