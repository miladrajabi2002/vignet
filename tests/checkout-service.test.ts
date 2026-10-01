import { beforeEach, describe, expect, it, vi } from 'vitest'

type Draft = Record<string, unknown> & { id: string; code: string; status: string }
const drafts: Draft[] = []
const messages: Array<{ conversationId: string; content: string; metadata: unknown }> = []
const notifications: Array<{ title: string }> = []
const integration = { id: 'int1', storeUrl: 'https://shop.example', webhookSecret: 'sekret', checkoutFlow: 'AUTO', active: true }
const products = [
  { id: 'p-arta', externalId: '12', sourceIntegrationId: 'int1' },
  { id: 'p-puff', externalId: '19', sourceIntegrationId: 'int1' },
  { id: 'p-manual', externalId: null, sourceIntegrationId: null },
]

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderDraft: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; code?: string; linkSlug?: string } }) => {
        const row = drafts.find((draft) => (where.id && draft.id === where.id) || (where.code && draft.code === where.code) || (where.linkSlug && draft.linkSlug === where.linkSlug))
        return row ? { ...row, conversation: { id: 'c1', agentId: 'a1', channel: 'CHAT_LINK', externalId: null }, agent: { name: 'فروشنده' } } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = drafts.find((draft) => draft.id === where.id)!
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as object)) row[key] = Number(row[key] ?? 0) + (value as { increment: number }).increment
          else row[key] = value
        }
        return row
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
        const row = drafts.find((draft) => draft.id === where.id && draft.status === where.status)
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      }),
    },
    storeIntegration: { findUnique: vi.fn(async () => integration) },
    product: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => products.filter((product) => where.id.in.includes(product.id))),
    },
    chatLink: { findUnique: vi.fn(async () => ({ slug: 'my-shop', enabled: true })) },
    agentChannel: { findFirst: vi.fn(async () => null) },
    message: {
      findFirst: vi.fn(async () => ({ content: 'سلام' })),
      create: vi.fn(async ({ data }: { data: { conversationId: string; content: string; metadata: unknown } }) => { messages.push(data); return data }),
    },
    conversation: { update: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}))
vi.mock('@/lib/notifications/create', () => ({
  notifyWorkspace: vi.fn(async (params: { title: string }) => { notifications.push(params) }),
}))

import {
  acceptsTransition,
  applyCheckoutEvent,
  buildCheckoutCard,
  composeStatusNotice,
  draftStatusForOrder,
  quoteView,
  resolveCheckoutSlug,
  storeLinesForItems,
} from '@/lib/commerce/checkout-service'
import { signPayload } from '@/lib/commerce/checkout-link'

const items = [
  { productId: 'p-arta', variationId: 13, name: 'میز تلویزیون آرتا', variant: 'رنگ: گردویی', quantity: 1, unitPrice: 6_900_000, url: null, maxQuantity: 5 },
  { productId: 'p-puff', variationId: 20, name: 'پاف مخمل', variant: 'رنگ: طوسی', quantity: 2, unitPrice: 1_250_000, url: null, maxQuantity: 8 },
]

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'd1', code: 'A7K2Q9', status: 'LINK_SENT', workspaceId: 'w1', conversationId: 'c1', agentId: 'a1', channel: 'CHAT_LINK',
    integrationId: 'int1', items, customerName: 'رضا محمدی', customerPhone: '09121112233', city: 'تهران', address: 'خیابان سرو، پلاک ۱۲',
    postalCode: null, note: null, province: null, coupons: ['vigent10'], shippingRateId: 'free_shipping:4', linkSlug: 'abcdefghijklmnopqrstuvwx',
    linkExpiresAt: new Date(Date.now() + 3_600_000), quote: null, shippingLabel: 'ارسال رایگان', shippingTotal: 0, discountTotal: 815_000,
    grandTotal: 8_785_000, externalOrderId: null, externalOrderNumber: null, paymentMethodTitle: null, notifiedStatus: null, clickCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  drafts.length = 0
  messages.length = 0
  notifications.length = 0
})

describe('WooCommerce status → draft status', () => {
  it('maps online payments, offline methods and closures', () => {
    expect(draftStatusForOrder('processing', true, false, 'WC_ZPal')).toBe('PAID')
    expect(draftStatusForOrder('completed', true, false, 'WC_Gateway_Zibal')).toBe('PAID')
    // Cash on delivery is «processing» without money: placed, not paid.
    expect(draftStatusForOrder('processing', false, false, 'cod')).toBe('ON_HOLD')
    expect(draftStatusForOrder('on-hold', false, false, 'bacs')).toBe('ON_HOLD')
    expect(draftStatusForOrder('failed', false, false, 'WC_ZPal')).toBe('PAYMENT_FAILED')
    expect(draftStatusForOrder('pending', false, false)).toBe('PAYMENT_PENDING')
    expect(draftStatusForOrder('cancelled', false, true)).toBe('EXPIRED')
    expect(draftStatusForOrder('cancelled', false, false)).toBe('CANCELLED')
    expect(draftStatusForOrder('refunded', false, false)).toBe('REFUNDED')
  })

  it('never lets a late or duplicate event undo a payment', () => {
    expect(acceptsTransition('LINK_SENT', 'PAYMENT_PENDING')).toBe(true)
    expect(acceptsTransition('PAYMENT_PENDING', 'PAID')).toBe(true)
    expect(acceptsTransition('PAYMENT_FAILED', 'PAID')).toBe(true)
    expect(acceptsTransition('PAID', 'PAYMENT_PENDING')).toBe(false)
    expect(acceptsTransition('PAID', 'CANCELLED')).toBe(false)
    expect(acceptsTransition('PAID', 'PAID')).toBe(false)
    expect(acceptsTransition('PAID', 'REFUNDED')).toBe(true)
    expect(acceptsTransition('PAYMENT_FAILED', 'PAYMENT_PENDING')).toBe(false)
  })

  it('says «paid» only for PAID and names the offline method otherwise', () => {
    expect(composeStatusNotice({ status: 'PAID', code: 'X', orderNumber: '40', total: 7_335_000, paymentTitle: 'زرین‌پال', lang: 'fa' })).toContain('پرداخت با موفقیت')
    const cod = composeStatusNotice({ status: 'ON_HOLD', code: 'X', orderNumber: '42', total: 1, paymentTitle: 'پرداخت در محل', lang: 'fa' })!
    expect(cod).toContain('پرداخت در محل')
    expect(cod).not.toContain('پرداخت با موفقیت')
  })
})

describe('store lines', () => {
  it('maps chat items to the store product and variation ids', async () => {
    expect(await storeLinesForItems('int1', items)).toEqual([
      { product_id: 12, variation_id: 13, quantity: 1, name: 'میز تلویزیون آرتا — رنگ: گردویی' },
      { product_id: 19, variation_id: 20, quantity: 2, name: 'پاف مخمل — رنگ: طوسی' },
    ])
  })

  it('refuses a cart with an item that is not from this store', async () => {
    expect(await storeLinesForItems('int1', [...items, { ...items[0], productId: 'p-manual' }])).toBeNull()
    expect(await storeLinesForItems('other-int', items)).toBeNull()
  })

  it('builds the card with the store link, line totals and the quoted total', () => {
    const card = buildCheckoutCard(draft() as never, 'https://shop.example', 'fa')!
    expect(card.url).toBe('https://shop.example/?vigent_checkout=abcdefghijklmnopqrstuvwx')
    expect(card.items[1].lineTotal).toBe(2_500_000)
    expect(card.total).toBe(8_785_000)
    expect(card.discount).toBe(815_000)
  })
})

describe('store redeems a link', () => {
  function signed(body: Record<string, unknown>, secret = 'sekret', timestamp = String(Math.floor(Date.now() / 1000))) {
    const rawBody = JSON.stringify(body)
    return { rawBody, timestamp, signature: signPayload(secret, timestamp, rawBody) }
  }

  it('returns the cart (ids, quantities, customer) but never prices', async () => {
    drafts.push(draft())
    const result = await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx', site_url: 'https://shop.example' }))
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, code: 'A7K2Q9', coupons: ['vigent10'], shipping_rate_id: 'free_shipping:4', return_url: 'https://vigent.ir/c/my-shop' })
    expect(result.body.items).toEqual([
      { product_id: 12, variation_id: 13, quantity: 1, name: 'میز تلویزیون آرتا — رنگ: گردویی' },
      { product_id: 19, variation_id: 20, quantity: 2, name: 'پاف مخمل — رنگ: طوسی' },
    ])
    expect(JSON.stringify(result.body)).not.toMatch(/6900000|price/)
    expect(result.body.customer).toMatchObject({ first_name: 'رضا', last_name: 'محمدی', phone: '09121112233', city: 'تهران' })
    expect(drafts[0].clickCount).toBe(1)
  })

  it('rejects another site, a wrong secret and a stale signature', async () => {
    drafts.push(draft())
    expect((await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx', site_url: 'https://evil.example' }))).status).toBe(403)
    expect((await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx' }, 'wrong'))).status).toBe(401)
    expect((await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx' }, 'sekret', String(Math.floor(Date.now() / 1000) - 3_600)))).status).toBe(401)
    expect((await resolveCheckoutSlug(signed({ slug: 'zzzzzzzzzzzzzzzzzzzzzzzz' }))).status).toBe(404)
  })

  it('refuses expired, paid and superseded carts', async () => {
    drafts.push(draft({ linkExpiresAt: new Date(Date.now() - 1_000) }))
    expect((await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx' }))).body.error).toBe('EXPIRED')
    expect(drafts[0].status).toBe('EXPIRED')
    drafts[0] = draft({ status: 'PAID' })
    expect((await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx' }))).body.error).toBe('PAID')
    drafts[0] = draft({ status: 'SUPERSEDED' })
    expect((await resolveCheckoutSlug(signed({ slug: 'abcdefghijklmnopqrstuvwx' }))).body.error).toBe('CANCELLED')
  })
})

describe('store status events', () => {
  it('marks the cart paid, tells the customer once and alerts the team', async () => {
    drafts.push(draft({ status: 'PAYMENT_PENDING' }))
    const event = { cart_code: 'A7K2Q9', order_id: 40, order_number: '40', status: 'processing', paid: true, total: 7_335_000, payment_method: 'WC_ZPal', payment_method_title: 'پرداخت امن زرین‌پال' }
    expect(await applyCheckoutEvent('int1', 'checkout.updated', event)).toBe(true)
    expect(drafts[0]).toMatchObject({ status: 'PAID', externalOrderNumber: '40', notifiedStatus: 'PAID' })
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toContain('پرداخت با موفقیت')
    expect(notifications).toHaveLength(1)
    // Duplicate delivery (batched order.updated after the instant event).
    expect(await applyCheckoutEvent('int1', 'checkout.updated', event)).toBe(false)
    expect(messages).toHaveLength(1)
  })

  it('ignores events for another store', async () => {
    drafts.push(draft({ status: 'PAYMENT_PENDING' }))
    expect(await applyCheckoutEvent('someone-else', 'checkout.updated', { cart_code: 'A7K2Q9', status: 'processing', paid: true })).toBe(false)
    expect(drafts[0].status).toBe('PAYMENT_PENDING')
  })

  it('re-opens the cart without a sold-out line and asks to re-confirm', async () => {
    drafts.push(draft({ status: 'LINK_SENT' }))
    await applyCheckoutEvent('int1', 'checkout.failed', { cart_code: 'A7K2Q9', reason: 'items_unavailable', items: ['پاف مخمل — رنگ: طوسی'] })
    expect(drafts[0].status).toBe('AWAITING_CONFIRM')
    expect(drafts[0].linkSlug).toBeNull()
    expect((drafts[0].items as unknown[]).length).toBe(1)
    expect(messages[0].content).toContain('ناموجود شد')
  })

  it('offers the same link again after a failed payment', async () => {
    drafts.push(draft({ status: 'PAYMENT_PENDING' }))
    await applyCheckoutEvent('int1', 'checkout.updated', { cart_code: 'A7K2Q9', status: 'failed', paid: false })
    expect(drafts[0].status).toBe('PAYMENT_FAILED')
    expect(messages[0].content).toContain('پرداخت انجام نشد')
    expect(messages[0].content).toContain('[[checkout:')
    expect(notifications).toHaveLength(0)
  })
})

describe('shipping in the live quote', () => {
  const rates = [
    { id: 'flat_rate:1', label: 'پست پیشتاز', cost: 65_000 },
    { id: 'flat_rate:2', label: 'تیپاکس', cost: 90_000 },
  ]
  const base = { ok: true, subtotal: 1_000_000, discount_total: 0, rates, chosen_rate: rates[0], total: 1_065_000 }

  it('asks instead of taking the store\'s cheapest when there are several methods', () => {
    const view = quoteView(base, null)
    expect(view.needsShipping).toBe(true)
    expect(view.shipping).toBeNull()
    expect(view.total).toBeNull()
    expect(view.rates).toHaveLength(2)
  })

  it('prices the customer\'s pick', () => {
    const view = quoteView({ ...base, chosen_rate: rates[1], total: 1_090_000 }, 'flat_rate:2')
    expect(view.needsShipping).toBe(false)
    expect(view.shippingRateId).toBe('flat_rate:2')
    expect(view.shipping).toEqual({ label: 'تیپاکس', cost: 90_000 })
    expect(view.total).toBe(1_090_000)
  })

  it('uses the only method without asking, and drops a pick the store no longer offers', () => {
    expect(quoteView({ ...base, rates: [rates[0]] }, null).shippingRateId).toBe('flat_rate:1')
    expect(quoteView(base, 'free_shipping:9').needsShipping).toBe(true)
  })
})
