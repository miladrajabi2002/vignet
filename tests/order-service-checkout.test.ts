import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown> & { id: string; status: string; updatedAt: Date; conversationId: string }
const drafts: Row[] = []
const products = [
  {
    id: 'arta', name: 'میز تلویزیون آرتا', price: 6_900_000, stock: null, active: true, externalUrl: null,
    attributes: { _variations: [
      { id: 13, attributes: { رنگ: 'گردویی' }, manageStock: true, stockQuantity: 5, price: 6_900_000 },
      { id: 15, attributes: { رنگ: 'مشکی' }, manageStock: true, stockQuantity: 0, price: 7_200_000 },
    ] },
  },
  {
    id: 'puff', name: 'پاف مخمل', price: 1_250_000, stock: null, active: true, externalUrl: null,
    attributes: { _variations: [
      { id: 20, attributes: { رنگ: 'طوسی' }, manageStock: true, stockQuantity: 8, price: 1_250_000 },
      { id: 22, attributes: { رنگ: 'کرم' }, manageStock: true, stockQuantity: 6, price: 1_100_000 },
    ] },
  },
  { id: 'lamp', name: 'آباژور چوبی', price: 890_000, stock: null, active: true, attributes: null, externalUrl: null },
  { id: 'table', name: 'میز جلو مبلی سنگی', price: 3_200_000, stock: 1, active: true, attributes: null, externalUrl: null },
]

const svc = vi.hoisted(() => ({
  quoteDraft: vi.fn(),
  issueCheckoutLink: vi.fn(),
  quoteIsFresh: vi.fn(() => false),
  refreshCheckoutStatus: vi.fn(),
  cancelCheckoutOnStore: vi.fn(async () => {}),
  buildCheckoutCard: vi.fn(() => ({ code: 'OLD111', url: 'https://shop.example/?vigent_checkout=abcdefghijklmnopqrstuvwx', storeHost: 'shop.example', items: [], shipping: null, discount: null, total: 1, expiresAt: '', lang: 'fa' })),
  composeStatusNotice: vi.fn(() => 'پرداخت با موفقیت انجام شد ✅'),
}))
vi.mock('@/lib/commerce/checkout-service', () => svc)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderDraft: {
      findMany: vi.fn(async ({ where }: { where: { conversationId: string; status: { in: string[] } } }) =>
        drafts.filter((row) => row.conversationId === where.conversationId && where.status.in.includes(row.status))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())),
      findFirst: vi.fn(async ({ where }: { where: { conversationId: string; OR: Array<{ status: string | { in: string[] } }> } }) => {
        const open = (row: Row) => where.OR.some((clause) => typeof clause.status === 'string' ? row.status === clause.status : clause.status.in.includes(row.status))
        return drafts.filter((row) => row.conversationId === where.conversationId && open(row))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = drafts.find((item) => item.id === where.id)!
        Object.assign(row, data, { updatedAt: new Date() })
        return row
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `d${drafts.length + 1}`, updatedAt: new Date(Date.now() + drafts.length), ...data } as Row
        drafts.push(row)
        return { ...row, code: row.code }
      }),
    },
    product: {
      findMany: vi.fn(async ({ where }: { where: { id?: { in: string[] } } }) =>
        where.id ? products.filter((product) => where.id!.in.includes(product.id)) : products.map(({ id, name }) => ({ id, name }))),
    },
    $executeRaw: vi.fn(async () => 1),
  },
}))

import { resolveOrderCaptureTurn, type OrderCaptureTurnParams } from '@/lib/commerce/order-service'
import type { CatalogProduct } from '@/lib/ai/rag'

const checkout = { integrationId: 'int1', storeUrl: 'https://shop.example', webhookSecret: 's', flow: 'AUTO', ttlHours: 24 }

function row(id: string, name: string, fullTermMatch = false): CatalogProduct {
  return { id, name, description: null, price: null, stock: null, category: null, image: null, url: null, attributes: null, tags: [], fullTermMatch }
}

function params(message: string, overrides: Partial<OrderCaptureTurnParams> = {}): OrderCaptureTurnParams {
  return {
    enabled: true, workspaceId: 'w', agentId: 'a', conversationId: 'c1', contactId: null, channel: 'CHAT_LINK', message, lang: 'fa',
    catalogProducts: [], recentCardIds: [], activeEntityId: null, variantHint: null, lastAssistantText: null,
    prefill: { name: null, phone: null, city: null, address: null }, restockEnabled: true, checkout, cartModel: null,
    ...overrides,
  }
}

const quote = {
  quote: { ok: true, items: [] },
  shipping: { label: 'پیک تهران', cost: 80_000 },
  discount: 0,
  total: 8_230_000,
  unavailable: [],
  gateways: ['زرین‌پال', 'زیبال'],
  couponErrors: [],
}

beforeEach(() => {
  drafts.length = 0
  vi.clearAllMocks()
  svc.quoteDraft.mockResolvedValue(quote)
  svc.issueCheckoutLink.mockImplementation(async (_ctx: unknown, draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId)!
    Object.assign(draft, { status: 'LINK_SENT', linkSlug: 'abcdefghijklmnopqrstuvwx', linkExpiresAt: new Date(Date.now() + 3_600_000), linkSentAt: new Date() })
    return { text: 'لینک پرداخت آماده‌ست ✅\n[[checkout:{"code":"X","url":"https://shop.example/?vigent_checkout=abcdefghijklmnopqrstuvwx","lang":"fa"}]]', card: {} }
  })
})

describe('in-chat checkout conversation', () => {
  it('builds a multi-item cart, quotes it live and sends a payment link on confirmation', async () => {
    const open = await resolveOrderCaptureTurn(params('آرتا رو گردویی میخوام بخرم', { recentCardIds: ['arta'] }))
    expect(open.kind === 'reply' && open.text).toContain('«میز تلویزیون آرتا — گردویی»')

    const added = await resolveOrderCaptureTurn(params('یه پاف طوسی هم اضافه کن', { catalogProducts: [row('puff', 'پاف مخمل', true)] }))
    expect(added.kind === 'reply' && added.text).toContain('«پاف مخمل — طوسی» × ۱ به سبد اضافه شد')
    // The cart-edit sentence is never taken as an address.
    expect(drafts[0].address ?? null).toBeNull()

    const summary = await resolveOrderCaptureTurn(params('رضا محمدی ۰۹۱۲۱۱۱۲۲۳۳\nتهران، سعادت‌آباد، خیابان سرو، پلاک ۱۲'))
    expect(summary.kind).toBe('reply')
    const text = summary.kind === 'reply' ? summary.text : ''
    expect(text).toContain('🚚 ارسال (پیک تهران): ۸۰٬۰۰۰ تومان')
    expect(text).toContain('💳 قابل پرداخت: ۸٬۲۳۰٬۰۰۰ تومان')
    expect(text).toContain('پرداخت روی سایت فروشگاه: زرین‌پال، زیبال')
    expect(text).toContain('تا لینک پرداخت رو بفرستم')
    expect(svc.quoteDraft).toHaveBeenCalledTimes(1)

    const coupon = await resolveOrderCaptureTurn(params('کد تخفیف VIGENT10 دارم'))
    expect(coupon.kind === 'reply' && coupon.text).toContain('اصلاح شد')
    expect(drafts[0].coupons).toEqual(['VIGENT10'])

    const link = await resolveOrderCaptureTurn(params('تأیید'))
    expect(link.kind).toBe('reply')
    expect(link.kind === 'reply' && link.text).toContain('[[checkout:')
    expect(svc.issueCheckoutLink).toHaveBeenCalledTimes(1)
    expect(drafts[0].status).toBe('LINK_SENT')
  })

  it('never believes «پرداخت کردم»: it checks the store and resends the link', async () => {
    drafts.push({ id: 'd1', code: 'OLD111', status: 'LINK_SENT', conversationId: 'c1', updatedAt: new Date(), items: [], checkoutMode: 'PAY_LINK', linkSentAt: new Date(), linkExpiresAt: new Date(Date.now() + 3_600_000) })
    svc.refreshCheckoutStatus.mockResolvedValueOnce({ status: 'PAYMENT_PENDING', orderNumber: null, total: null, paymentTitle: null })
    const pending = await resolveOrderCaptureTurn(params('پرداخت کردم'))
    expect(pending.kind === 'reply' && pending.text).toContain('هنوز تأیید پرداخت')
    expect(pending.kind === 'reply' && pending.text).toContain('[[checkout:')

    svc.refreshCheckoutStatus.mockResolvedValueOnce({ status: 'PAID', orderNumber: '40', total: 1, paymentTitle: 'زرین‌پال' })
    const paid = await resolveOrderCaptureTurn(params('پرداخت کردم'))
    expect(paid.kind === 'reply' && paid.text).toContain('پرداخت با موفقیت')
  })

  it('re-opens the cart as a new draft when it is edited after the link', async () => {
    const lamp = { productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 890_000, url: null, maxQuantity: null }
    drafts.push({
      id: 'd1', code: 'OLD111', status: 'LINK_SENT', conversationId: 'c1', updatedAt: new Date(), items: [lamp], checkoutMode: 'PAY_LINK',
      customerName: 'علی رضایی', customerPhone: '09121234567', city: 'تهران', address: 'تهران، خیابان آزادی، پلاک ۲۰', postalCode: null, note: null,
      linkSentAt: new Date(), linkExpiresAt: new Date(Date.now() + 3_600_000), coupons: [],
    })
    const edited = await resolveOrderCaptureTurn(params('دو تا کوسن هم اضافه کن', { catalogProducts: [row('table', 'میز جلو مبلی سنگی', true)] }))
    expect(drafts[0].status).toBe('SUPERSEDED')
    expect(svc.cancelCheckoutOnStore).toHaveBeenCalledWith('d1')
    expect(drafts).toHaveLength(2)
    expect(drafts[1].code).not.toBe('OLD111')
    expect(edited.kind === 'reply' && edited.text).toContain('میز جلو مبلی سنگی')
    expect(edited.kind === 'reply' && edited.text).toContain('خلاصهٔ سفارشتون')
  })

  it('an expired link asked for again becomes a fresh summary, never an invented URL', async () => {
    drafts.push({
      id: 'd1', code: 'OLD111', status: 'EXPIRED', conversationId: 'c1', updatedAt: new Date(), checkoutMode: 'PAY_LINK', linkSentAt: new Date(),
      items: [{ productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 890_000, url: null, maxQuantity: null }],
      customerName: 'حسن نوری', customerPhone: '09125556677', city: 'قم', address: 'قم، خیابان صفاییه، پلاک ۴', postalCode: null, note: null, coupons: [],
    })
    const reply = await resolveOrderCaptureTurn(params('لینک پرداخت رو دوباره بفرست'))
    expect(reply.kind === 'reply' && reply.text).toContain('خلاصهٔ سفارشتون')
    expect(drafts[1].status).toBe('AWAITING_CONFIRM')
  })

  it('a closed link does not hijack ordinary questions', async () => {
    drafts.push({ id: 'd1', code: 'OLD111', status: 'CANCELLED', conversationId: 'c1', updatedAt: new Date(), checkoutMode: 'PAY_LINK', linkSentAt: new Date(), items: [] })
    expect((await resolveOrderCaptureTurn(params('ساعت کاری فروشگاه چنده؟'))).kind).toBe('none')
  })

  it('removes one named line in a multi-item cart but cancels a single-item cart', async () => {
    const lines = [
      { productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 890_000, url: null, maxQuantity: null },
      { productId: 'table', variationId: null, name: 'میز جلو مبلی سنگی', variant: null, quantity: 1, unitPrice: 3_200_000, url: null, maxQuantity: 1 },
    ]
    drafts.push({ id: 'd1', code: 'CART01', status: 'COLLECTING', conversationId: 'c1', updatedAt: new Date(), items: lines, expecting: 'name', coupons: [] })
    const removed = await resolveOrderCaptureTurn(params('آباژور رو نمیخوام'))
    expect(removed.kind === 'reply' && removed.text).toContain('«آباژور چوبی» از سبد حذف شد')
    expect(drafts[0].status).toBe('COLLECTING')

    const cancelled = await resolveOrderCaptureTurn(params('نمیخوام'))
    expect(cancelled.kind === 'reply' && cancelled.text).toContain('لغو کردم')
  })

  it('picks the product named in the message and keeps the intent sentence out of the address', async () => {
    const reply = await resolveOrderCaptureTurn(params('سلام، میز جلو مبلی سنگی میخوام بخرم'))
    expect(reply.kind === 'reply' && reply.text).toContain('«میز جلو مبلی سنگی»')
    expect(drafts[0].address ?? null).toBeNull()
  })

  it('refuses an out-of-stock variant during a cart edit and keeps the cart', async () => {
    const lamp = { productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 890_000, url: null, maxQuantity: null }
    drafts.push({ id: 'd1', code: 'CART02', status: 'COLLECTING', conversationId: 'c1', updatedAt: new Date(), items: [lamp], expecting: 'name', coupons: [] })
    const reply = await resolveOrderCaptureTurn(params('یه آرتا مشکی هم اضافه کن', { catalogProducts: [row('arta', 'میز تلویزیون آرتا', true)] }))
    expect(reply.kind === 'reply' && reply.text).toContain('ناموجوده')
    expect((drafts[0].items as unknown[]).length).toBe(1)
  })

  it('falls back to an operator pre-order when the cart cannot be paid on the store', async () => {
    svc.issueCheckoutLink.mockResolvedValueOnce(null)
    drafts.push({
      id: 'd1', code: 'CART03', status: 'AWAITING_CONFIRM', conversationId: 'c1', updatedAt: new Date(), expecting: 'confirm', coupons: [],
      items: [{ productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 890_000, url: null, maxQuantity: null }],
      customerName: 'علی رضایی', customerPhone: '09121234567', city: 'تهران', address: 'تهران، خیابان آزادی، پلاک ۲۰', postalCode: null, note: null,
    })
    const outcome = await resolveOrderCaptureTurn(params('تایید'))
    expect(outcome.kind).toBe('submit')
  })

  it('files a pre-order, never a dead link, when the store owner switched checkout off', async () => {
    svc.quoteDraft.mockImplementationOnce(async (ctx: { storeDisabled?: boolean }) => {
      ctx.storeDisabled = true
      return null
    })
    drafts.push({
      id: 'd1', code: 'CART04', status: 'AWAITING_CONFIRM', conversationId: 'c1', updatedAt: new Date(), expecting: 'confirm', coupons: [], quotedAt: null,
      items: [{ productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 890_000, url: null, maxQuantity: null }],
      customerName: 'علی رضایی', customerPhone: '09121234567', city: 'تهران', address: 'تهران، خیابان آزادی، پلاک ۲۰', postalCode: null, note: null,
    })
    const outcome = await resolveOrderCaptureTurn(params('تایید', { checkout: { ...checkout } }))
    expect(outcome.kind).toBe('submit')
    expect(svc.issueCheckoutLink).not.toHaveBeenCalled()
  })
})

describe('several products in the first message', () => {
  it('puts every product named in full into the cart', async () => {
    const reply = await resolveOrderCaptureTurn(params('سلام، میز جلو مبلی سنگی و یه آباژور چوبی میخوام بخرم'))
    expect(reply.kind === 'reply' && reply.text).toContain('«میز جلو مبلی سنگی» و «آباژور چوبی» رو همین‌جا براتون ثبت می‌کنم')
    expect((drafts[0].items as Array<{ productId: string }>).map((item) => item.productId)).toEqual(['table', 'lamp'])
  })
})

describe('shipping method on a payment-link cart', () => {
  const rates = [
    { id: 'flat_rate:1', label: 'پست پیشتاز', cost: 65_000 },
    { id: 'flat_rate:2', label: 'تیپاکس', cost: 90_000 },
  ]

  beforeEach(() => {
    // Mirrors quoteDraft: the pick survives while offered; several methods
    // and no pick leave the choice to the customer.
    svc.quoteDraft.mockImplementation(async (_ctx: unknown, draftId: string, state: { shippingRateId?: string | null }) => {
      const chosen = rates.find((rate) => rate.id === state.shippingRateId) ?? null
      state.shippingRateId = chosen?.id ?? null
      const draft = drafts.find((item) => item.id === draftId)!
      Object.assign(draft, { quote: { ok: true, rates }, quotedAt: new Date(), shippingRateId: state.shippingRateId })
      return {
        ...quote,
        shipping: chosen ? { label: chosen.label, cost: chosen.cost } : null,
        total: chosen ? 1_000_000 + chosen.cost : null,
        shippingRateId: chosen?.id ?? null,
        rates,
        needsShipping: !chosen,
      }
    })
  })

  it('asks which method before the summary, prices the pick and lets the customer switch', async () => {
    drafts.push({
      id: 'd1', code: 'SHIP01', status: 'COLLECTING', conversationId: 'c1', updatedAt: new Date(), expecting: 'address', coupons: [],
      items: [{ productId: 'lamp', variationId: null, name: 'آباژور چوبی', variant: null, quantity: 1, unitPrice: 1_000_000, url: null, maxQuantity: null }],
      customerName: 'علی رضایی', customerPhone: '09121234567', city: null, address: null, postalCode: null, note: null,
    })
    const ask = await resolveOrderCaptureTurn(params('تهران، خیابان آزادی، پلاک ۲۰'))
    expect(ask.kind === 'reply' && ask.text).toContain('روش ارسال رو انتخاب کنید')
    expect(ask.kind === 'reply' && ask.text).toContain('۲. تیپاکس — ۹۰٬۰۰۰ تومان')
    expect(drafts[0].expecting).toBe('shipping')

    // «بله» is not a pick and never confirms an order without a method.
    const again = await resolveOrderCaptureTurn(params('بله'))
    expect(again.kind === 'reply' && again.text).toContain('لطفاً یکی از این روش‌های ارسال')
    expect(svc.issueCheckoutLink).not.toHaveBeenCalled()

    const summary = await resolveOrderCaptureTurn(params('۲'))
    expect(summary.kind === 'reply' && summary.text).toContain('🚚 ارسال (تیپاکس): ۹۰٬۰۰۰ تومان')
    expect(summary.kind === 'reply' && summary.text).toContain('روش ارسال')
    expect(drafts[0].shippingRateId).toBe('flat_rate:2')
    expect(drafts[0].status).toBe('AWAITING_CONFIRM')

    const switched = await resolveOrderCaptureTurn(params('با پیشتاز بفرستید'))
    expect(switched.kind === 'reply' && switched.text).toContain('اصلاح شد')
    expect(switched.kind === 'reply' && switched.text).toContain('🚚 ارسال (پست پیشتاز): ۶۵٬۰۰۰ تومان')
    expect(drafts[0].shippingRateId).toBe('flat_rate:1')

    const relist = await resolveOrderCaptureTurn(params('روش ارسال رو عوض کنم'))
    expect(relist.kind === 'reply' && relist.text).toContain('روش ارسال رو انتخاب کنید')

    await resolveOrderCaptureTurn(params('اولی'))
    const link = await resolveOrderCaptureTurn(params('تأیید'))
    expect(link.kind === 'reply' && link.text).toContain('[[checkout:')
    expect(drafts[0].shippingRateId).toBe('flat_rate:1')
  })
})
