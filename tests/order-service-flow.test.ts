import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown> & { id: string; status: string; updatedAt: Date; conversationId: string }
const drafts: Row[] = []
const products = [
  { id: 'tv160', name: 'میز تلویزیون نقش طرح آپادانا سایز 160', price: 25_970_000, stock: null, active: true, attributes: null, externalUrl: 'https://shop.test/tv160' },
  {
    id: 'pouf', name: 'پاف مراکشی', price: 1_590_000, stock: null, active: true, externalUrl: null,
    attributes: { _variations: [
      { id: 1, attributes: { رنگ: 'کرم' }, manageStock: true, stockQuantity: 2, price: 1_590_000 },
      { id: 2, attributes: { رنگ: 'سبز' }, manageStock: true, stockQuantity: 0, price: 1_590_000 },
      { id: 3, attributes: { رنگ: 'آبی' }, manageStock: false, inStock: true, price: 1_690_000 },
    ] },
  },
  { id: 'soldout', name: 'میز عسلی شهداد', price: 9_470_000, stock: 0, active: true, attributes: null, externalUrl: null },
]
const rememberedOffers: unknown[] = []

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderDraft: {
      findMany: vi.fn(async ({ where }: { where: { conversationId: string; status: { in: string[] } } }) =>
        drafts.filter((row) => row.conversationId === where.conversationId && where.status.in.includes(row.status))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())),
      updateMany: vi.fn(async () => ({ count: 0 })),
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
    $executeRaw: vi.fn(async (...args: unknown[]) => { rememberedOffers.push(args); return 1 }),
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
    recentCardIds: ['tv160'],
    activeEntityId: null,
    variantHint: null,
    lastAssistantText: null,
    prefill: { name: null, phone: null, city: null, address: null },
    restockEnabled: true,
    ...overrides,
  }
}

beforeEach(() => {
  drafts.length = 0
  rememberedOffers.length = 0
})

describe('pre-order conversation, end to end', () => {
  it('collects, summarizes, and files only after confirmation', async () => {
    const start = await resolveOrderCaptureTurn(params('میخوام همینو بخرم'))
    expect(start.kind).toBe('reply')
    expect(start.kind === 'reply' && start.text).toContain('آپادانا')
    expect(drafts[0].status).toBe('COLLECTING')

    const partial = await resolveOrderCaptureTurn(params('علی رضایی 09123456789'))
    expect(partial.kind === 'reply' && partial.text).toMatch(/^ممنون علی/)
    expect(partial.kind === 'reply' && partial.text).toContain('آدرس')

    const summary = await resolveOrderCaptureTurn(params('تهران، خیابان آزادی، پلاک ۱۲'))
    expect(summary.kind === 'reply' && summary.text).toContain('خلاصهٔ سفارشتون')
    expect(summary.kind === 'reply' && summary.text).toContain('۲۵٬۹۷۰٬۰۰۰ تومان')
    expect(drafts[0].status).toBe('AWAITING_CONFIRM')

    const done = await resolveOrderCaptureTurn(params('بله'))
    expect(done.kind).toBe('submit')
    if (done.kind === 'submit') {
      expect(done.text).toContain(done.code)
      expect(done.operatorSummary).toContain('09123456789')
      expect(done.operatorSummary).toContain('خیابان آزادی')
    }
    expect(drafts[0].status).toBe('SUBMITTED')
  })

  it('a correction at the summary step re-summarizes instead of filing', async () => {
    await resolveOrderCaptureTurn(params('ثبت سفارش', { prefill: { name: 'سارا کریمی', phone: '09120000000', city: 'کرج', address: 'کرج گوهردشت بلوار موذن' } }))
    expect(drafts[0].status).toBe('AWAITING_CONFIRM')
    const corrected = await resolveOrderCaptureTurn(params('آدرس: کرج، مهرشهر، بلوار ارم، پلاک ۴'))
    expect(corrected.kind === 'reply' && corrected.text).toContain('اصلاح شد')
    expect(corrected.kind === 'reply' && corrected.text).toContain('مهرشهر')
    const no = await resolveOrderCaptureTurn(params('نه'))
    expect(no.kind === 'reply' && no.text).toContain('کدوم مورد')
  })

  it('a question mid-order goes to the model with a reminder', async () => {
    await resolveOrderCaptureTurn(params('میخوام همینو بخرم'))
    const question = await resolveOrderCaptureTurn(params('ارسالش به شیراز چند روز طول میکشه؟'))
    expect(question.kind).toBe('instruct')
    expect(question.kind === 'instruct' && question.instruction).toContain('هرگز نگو سفارش ثبت شد')
  })

  it('cancel ends the draft', async () => {
    await resolveOrderCaptureTurn(params('میخوام همینو بخرم'))
    const cancel = await resolveOrderCaptureTurn(params('بیخیال'))
    expect(cancel.kind === 'reply' && cancel.text).toContain('لغو')
    expect(drafts[0].status).toBe('CANCELLED')
  })

  it('asks which variant, skips sold-out ones, then continues', async () => {
    const start = await resolveOrderCaptureTurn(params('میخوام سفارش بدم', { recentCardIds: ['pouf'] }))
    expect(start.kind === 'reply' && start.text).toContain('کرم')
    expect(start.kind === 'reply' && start.text).not.toContain('سبز')
    const pick = await resolveOrderCaptureTurn(params('آبی', { recentCardIds: ['pouf'] }))
    expect(pick.kind === 'reply' && pick.text).toContain('پاف مراکشی — آبی')
  })

  it('a sold-out variant is refused honestly with a back-in-stock offer', async () => {
    await resolveOrderCaptureTurn(params('میخوام سفارش بدم', { recentCardIds: ['pouf'] }))
    const sold = await resolveOrderCaptureTurn(params('سبز', { recentCardIds: ['pouf'] }))
    expect(sold.kind === 'reply' && sold.text).toContain('ناموجوده')
    expect(sold.kind === 'reply' && sold.text).toContain('خبرتون می‌کنم')
    expect(sold.kind === 'reply' && sold.text).toContain('مدل‌های موجود')
    expect(rememberedOffers.length).toBe(1)
  })

  it('a sold-out product never starts a draft', async () => {
    const sold = await resolveOrderCaptureTurn(params('میخوام همینو بخرم', { recentCardIds: ['soldout'] }))
    expect(sold.kind === 'reply' && sold.text).toContain('ناموجوده')
    expect(drafts.length).toBe(0)
  })

  it('several cards shown: asks which one, then resolves «دومی»', async () => {
    const ask = await resolveOrderCaptureTurn(params('میخوام سفارش بدم', { recentCardIds: ['tv160', 'pouf'] }))
    expect(ask.kind === 'reply' && ask.text).toContain('کدوم رو می‌خواید')
    const pick = await resolveOrderCaptureTurn(params('اولی', { recentCardIds: ['tv160', 'pouf'] }))
    expect(pick.kind === 'reply' && pick.text).toContain('آپادانا')
  })

  it('off when the agent has pre-orders disabled', async () => {
    expect((await resolveOrderCaptureTurn(params('میخوام همینو بخرم', { enabled: false }))).kind).toBe('none')
  })
})
