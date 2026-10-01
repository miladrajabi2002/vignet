import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Colour × size cart flow + one-hour hold, against an in-memory store ──

type Row = Record<string, unknown> & { id: string; status: string; updatedAt: Date; conversationId: string }
const drafts: Row[] = []
const coat = {
  id: 'coat', name: 'کت گرامی', price: 2_480_000, stock: null, active: true, externalUrl: null,
  attributes: { _variations: [
    { id: 11, attributes: { رنگ: 'مشکی', سایز: 'S' }, manageStock: true, stockQuantity: 0, price: 2_480_000 },
    { id: 12, attributes: { رنگ: 'مشکی', سایز: 'M' }, manageStock: true, stockQuantity: 2, price: 2_480_000 },
    { id: 13, attributes: { رنگ: 'مشکی', سایز: 'L' }, manageStock: true, stockQuantity: 1, price: 2_480_000 },
    { id: 14, attributes: { رنگ: 'کرم', سایز: 'M' }, manageStock: true, stockQuantity: 1, price: 2_580_000 },
  ] },
}
const lamp = { id: 'lamp', name: 'آباژور چوبی', price: 900_000, stock: 1, active: true, attributes: null, externalUrl: null }
const products = [coat, lamp]

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderDraft: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        // Active cart lookup (by conversation) or live holds (by workspace).
        if (typeof where.conversationId === 'string') {
          const statuses = (where.status as { in: string[] }).in
          return drafts.filter((row) => row.conversationId === where.conversationId && statuses.includes(row.status))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        }
        const not = (where.conversationId as { not?: string } | undefined)?.not
        return drafts.filter((row) => row.conversationId !== not && ['HELD', 'REMINDED'].includes(String(row.holdState))
          && row.heldUntil instanceof Date && row.heldUntil.getTime() > Date.now())
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => drafts.find((row) => row.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; holdState?: null }; data: Record<string, unknown> }) => {
        const row = drafts.find((item) => item.id === where.id && ('holdState' in where ? item.holdState == null : true))
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = drafts.find((item) => item.id === where.id)!
        Object.assign(row, data, { updatedAt: new Date() })
        return row
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `d${drafts.length + 1}`, updatedAt: new Date(), ...data } as Row
        drafts.push(row)
        return { id: row.id, code: row.code }
      }),
    },
    product: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => products.filter((product) => where.id.in.includes(product.id))),
    },
    $executeRaw: vi.fn(async () => 1),
  },
}))

import { resolveOrderCaptureTurn, type OrderCaptureTurnParams } from '@/lib/commerce/order-service'

function params(message: string, overrides: Partial<OrderCaptureTurnParams> = {}): OrderCaptureTurnParams {
  return {
    enabled: true,
    workspaceId: 'w',
    agentId: 'a',
    conversationId: 'c1',
    contactId: null,
    channel: 'TELEGRAM',
    message,
    lang: 'fa',
    catalogProducts: [],
    recentCardIds: ['coat'],
    activeEntityId: null,
    variantHint: null,
    lastAssistantText: null,
    prefill: { name: null, phone: null, city: null, address: null },
    restockEnabled: false,
    ...overrides,
  }
}

beforeEach(() => { drafts.length = 0 })

describe('colour + size in the chat cart', () => {
  it('«مشکی» keeps the colour and asks only the size, listing sizes in stock', async () => {
    const reply = await resolveOrderCaptureTurn(params('همین مشکی رو میخوام بخرم'))
    expect(reply.kind).toBe('reply')
    const text = reply.kind === 'reply' ? reply.text : ''
    expect(text).toContain('کت گرامی — مشکی')
    expect(text).toContain('سایز')
    expect(text).toContain('M')
    expect(text).toContain('L')
    expect(text).not.toMatch(/\bS\b/) // black S is sold out
    const items = drafts[0].items as Array<{ variationId: number | null; variant: string | null }>
    expect(items[0].variationId).toBeNull() // no silent pick
    expect(items[0].variant).toBe('مشکی')
  })

  it('the next message completes the pick with the carried colour', async () => {
    await resolveOrderCaptureTurn(params('همین مشکی رو میخوام بخرم'))
    await resolveOrderCaptureTurn(params('L'))
    const items = drafts[0].items as Array<{ variationId: number | null; variant: string | null }>
    expect(items[0].variationId).toBe(13)
    expect(items[0].variant).toBe('مشکی، L')
  })

  it('a sold-out combination is named, never swapped silently', async () => {
    const reply = await resolveOrderCaptureTurn(params('مشکی سایز S میخوام بخرم'))
    const text = reply.kind === 'reply' ? reply.text : ''
    expect(text).toContain('مشکی، S')
    expect(text).toMatch(/ناموجود|تموم|موجود نیست/)
  })

  it('with no option named, asks one option at a time (colour), not every combination', async () => {
    const reply = await resolveOrderCaptureTurn(params('میخوام همینو بخرم'))
    const text = reply.kind === 'reply' ? reply.text : ''
    expect(text).toContain('رنگ')
    expect(text).toContain('مشکی')
    expect(text).toContain('کرم')
    expect(text).not.toContain('مشکی، M')
  })
})

describe('one-hour cart hold', () => {
  it('announces the hold once, with the Tehran clock time', async () => {
    const first = await resolveOrderCaptureTurn(params('آباژور چوبی میخوام بخرم', { recentCardIds: ['lamp'], cartHold: true }))
    expect(first.kind === 'reply' && first.text).toMatch(/تا ساعت .+ \(یک ساعت\) براتون رزرو شد/)
    expect(drafts[0].holdState).toBe('HELD')
    const second = await resolveOrderCaptureTurn(params('علی رضایی 09123456789', { recentCardIds: ['lamp'], cartHold: true }))
    expect(second.kind === 'reply' && second.text).not.toContain('رزرو شد')
  })

  it('a unit held by another chat counts as taken', async () => {
    await resolveOrderCaptureTurn(params('آباژور چوبی میخوام بخرم', { recentCardIds: ['lamp'], cartHold: true }))
    const other = await resolveOrderCaptureTurn(params('آباژور چوبی میخوام بخرم', { recentCardIds: ['lamp'], cartHold: true, conversationId: 'c2' }))
    expect(other.kind === 'reply' && other.text).toMatch(/ناموجود|تموم|موجود نیست/)
  })

  it('without the switch, nothing is held', async () => {
    const first = await resolveOrderCaptureTurn(params('آباژور چوبی میخوام بخرم', { recentCardIds: ['lamp'] }))
    expect(first.kind === 'reply' && first.text).not.toContain('رزرو')
    expect(drafts[0].holdState).toBeUndefined()
  })
})
