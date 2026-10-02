import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sendText: vi.fn(),
  sendProductCard: vi.fn(),
  sendProductCarousel: vi.fn(),
  productFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentChannel: { findFirst: mocks.findFirst },
    product: { findMany: mocks.productFindMany },
  },
}))
vi.mock('@/lib/channels/config', () => ({ readBotToken: () => 'token' }))
vi.mock('@/lib/instagram/config', () => ({ readPageToken: () => 'token' }))
vi.mock('@/lib/instagram/media', () => ({
  sendProductCarousel: mocks.sendProductCarousel,
  pickTemplateImageUrl: (images: string[] | null) => images?.[0] ?? null,
}))
vi.mock('@/lib/channels/registry', () => ({
  isMessengerType: (channel: string) => ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'].includes(channel),
  getAdapter: (channel: string) => ({
    sendText: mocks.sendText,
    // Instagram's carousel goes through the media helper, not the adapter.
    ...(channel === 'INSTAGRAM' ? {} : { sendProductCard: mocks.sendProductCard }),
  }),
}))

import { sendOutboundProducts } from '@/lib/channels/outbound'
import {
  productShowcaseMarker,
  resolveWorkspaceProductShowcases,
  type TrustedProductShowcase,
} from '@/lib/products/presentation'
import { parseProductShowcaseContent } from '@/components/products/product-showcase'
import { conversationPreviewText } from '@/lib/conversations/preview'

function card(id: string, overrides: Partial<TrustedProductShowcase> = {}): TrustedProductShowcase {
  return {
    id,
    name: `Product ${id}`,
    description: 'Soft cotton',
    price: 250000,
    imageUrl: `https://shop.example/${id}.jpg`,
    productUrl: `https://shop.example/p/${id}`,
    specs: ['Color: blue'],
    variation: null,
    cartId: null,
    ...overrides,
  }
}

const products = [card('a'), card('b'), card('c')]

describe('operator product delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findFirst.mockResolvedValue({ config: { token: 'x' } })
    mocks.sendText.mockResolvedValue(undefined)
    mocks.sendProductCard.mockResolvedValue(undefined)
    mocks.sendProductCarousel.mockResolvedValue(undefined)
  })

  it('sends Instagram products as one carousel after the text', async () => {
    const result = await sendOutboundProducts({
      agentId: 'agent-1', channel: 'INSTAGRAM', externalId: 'ig-user', text: 'Here you go', products, lang: 'fa',
    })
    expect(result).toEqual({ status: 'sent' })
    expect(mocks.sendText).toHaveBeenCalledWith('ig-user', 'Here you go')
    expect(mocks.sendProductCarousel).toHaveBeenCalledTimes(1)
    expect(mocks.sendProductCarousel).toHaveBeenCalledWith({ token: 'x' }, 'ig-user', products)
    expect(mocks.sendText.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendProductCarousel.mock.invocationCallOrder[0])
  })

  it('falls back to a numbered text list when the Instagram carousel is rejected', async () => {
    mocks.sendProductCarousel.mockRejectedValue(new Error('template rejected'))
    const result = await sendOutboundProducts({
      agentId: 'agent-1', channel: 'INSTAGRAM', externalId: 'ig-user', text: '', products, lang: 'fa',
    })
    expect(result).toEqual({ status: 'sent' })
    const fallback = mocks.sendText.mock.calls.at(-1)?.[1] as string
    expect(fallback).toContain('1. Product a')
    expect(fallback).toContain('3. Product c')
    expect(fallback).toContain('https://shop.example/p/b')
  })

  it.each(['TELEGRAM', 'BALE', 'RUBIKA'] as const)('sends one photo card per product on %s', async (channel) => {
    const result = await sendOutboundProducts({
      agentId: 'agent-1', channel, externalId: 'chat-1', text: '', products, lang: 'fa',
    })
    expect(result).toEqual({ status: 'sent' })
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.sendProductCard).toHaveBeenCalledTimes(3)
    expect(mocks.sendProductCard).toHaveBeenCalledWith('chat-1', expect.objectContaining({
      name: 'Product a',
      price: `${(250000).toLocaleString('fa-IR')} تومان`,
      imageUrl: 'https://shop.example/a.jpg',
      productUrl: 'https://shop.example/p/a',
      ctaLabel: '🛒 مشاهده و خرید',
    }))
  })

  it('keeps a failed Telegram card as text instead of dropping it', async () => {
    mocks.sendProductCard.mockImplementation(async (_chat: string, value: { name: string }) => {
      if (value.name === 'Product b') throw new Error('photo rejected')
    })
    const result = await sendOutboundProducts({
      agentId: 'agent-1', channel: 'TELEGRAM', externalId: 'chat-1', text: '', products, lang: 'en',
    })
    expect(result).toEqual({ status: 'sent' })
    expect(mocks.sendText).toHaveBeenCalledTimes(1)
    const fallback = mocks.sendText.mock.calls[0][1] as string
    expect(fallback).toContain('Product b')
    expect(fallback).not.toContain('Product a')
  })

  it('reports failed only when nothing reached the customer', async () => {
    mocks.sendProductCard.mockRejectedValue(new Error('down'))
    mocks.sendText.mockRejectedValue(new Error('down'))
    const result = await sendOutboundProducts({
      agentId: 'agent-1', channel: 'BALE', externalId: 'chat-1', text: '', products, lang: 'fa',
    })
    expect(result.status).toBe('failed')
    expect(result.reason).toBe('provider_error')
  })

  it.each(['WEB_WIDGET', 'CHAT_LINK', 'API'] as const)('leaves %s delivery to the persisted card snapshots', async (channel) => {
    const result = await sendOutboundProducts({
      agentId: 'agent-1', channel, externalId: null, text: 'hi', products, lang: 'fa',
    })
    expect(result).toEqual({ status: 'stored', reason: 'history_delivery' })
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.sendProductCard).not.toHaveBeenCalled()
  })

  it('persists snapshots the web rail parses back into the same cards', () => {
    const content = ['Our picks', ...products.map((product) => productShowcaseMarker(product, 'fa'))].join('\n')
    const parsed = parseProductShowcaseContent(content)
    expect(parsed.text).toBe('Our picks')
    expect(parsed.products.map((product) => product.name)).toEqual(['Product a', 'Product b', 'Product c'])
    expect(parsed.products[0].imageUrl).toBe('https://shop.example/a.jpg')
    expect(parsed.products[0].productUrl).toBe('https://shop.example/p/a')
  })

  it('previews a cards-only message by its product names', () => {
    const content = products.map((product) => productShowcaseMarker(product, 'fa')).join('\n')
    expect(conversationPreviewText(content)).toBe('🛍 Product a، Product b، Product c')
  })

  it('resolves only active workspace products, in the order the operator picked', async () => {
    mocks.productFindMany.mockResolvedValue([
      { id: 'p1', name: 'One', description: null, price: 10, images: ['https://x/1.jpg'], externalUrl: null, sourceIntegrationId: null, externalId: null, attributes: null, stock: 3 },
      { id: 'p2', name: 'Two', description: null, price: null, images: [], externalUrl: null, sourceIntegrationId: null, externalId: null, attributes: null, stock: 0 },
    ])
    const cards = await resolveWorkspaceProductShowcases({ workspaceId: 'ws-1', productIds: ['p2', 'p1', 'p2', 'missing'] })
    expect(mocks.productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'ws-1', active: true, id: { in: ['p2', 'p1', 'missing'] } },
    }))
    expect(cards.map((item) => item.id)).toEqual(['p2', 'p1'])
    // A deliberately picked sold-out product says so on its card.
    expect(cards[0].badge).toBe('ناموجود')
  })
})
