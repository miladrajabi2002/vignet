import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = {
  metadata: null as unknown,
  alerts: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  products: [
    { id: 'pouf', name: 'پاف مراکشی', active: true, stock: 0, attributes: null, deletedAt: null },
    { id: 'tv', name: 'میز تلویزیون', active: true, stock: 3, attributes: null, deletedAt: null },
  ],
  sent: [] as string[],
  notifications: [] as Array<Record<string, unknown>>,
  failWith: null as Error | null,
}

vi.mock('@/lib/prisma', () => {
  const restockAlert = {
    upsert: vi.fn(async ({ where, create, update }: { where: { dedupeKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const existing = state.alerts.find((alert) => alert.dedupeKey === where.dedupeKey)
      if (existing) Object.assign(existing, update)
      else state.alerts.push({ id: `r${state.alerts.length + 1}`, status: 'ACTIVE', createdAt: new Date(), ...create })
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id?: { in: string[] }; status?: unknown; createdAt?: { lt: Date }; updatedAt?: { lt: Date } }; data: Record<string, unknown> }) => {
      const matches = state.alerts.filter((alert) => (!where.id || where.id.in.includes(alert.id as string))
        && (typeof where.status !== 'string' || alert.status === where.status)
        && (!where.createdAt || (alert.createdAt as Date) < where.createdAt.lt)
        && (!where.updatedAt || false))
      for (const alert of matches) Object.assign(alert, data)
      return { count: matches.length }
    }),
    findMany: vi.fn(async () => state.alerts.filter((alert) => alert.status === 'ACTIVE').map((alert) => ({
      ...alert,
      product: state.products.find((product) => product.id === alert.productId),
      conversation: { id: alert.conversationId, externalId: 'chat-1', agentId: 'a', contact: { name: 'سارا کریمی', phone: '09120000000' } },
      agent: { orderCaptureEnabled: true, language: 'fa' },
    }))),
  }
  return {
    prisma: {
      conversation: {
        findUnique: vi.fn(async () => ({ metadata: state.metadata })),
        update: vi.fn(async () => ({})),
      },
      product: {
        findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => state.products.filter((product) => where.id.in.includes(product.id))),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => state.products.find((product) => product.id === where.id) ?? null),
      },
      restockAlert,
      message: {
        findFirst: vi.fn(async () => ({ content: 'پاف مراکشی دارید؟' })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.messages.push(data); return data }),
      },
      agentChannel: { findFirst: vi.fn(async () => ({ config: {} })) },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings.join('').includes("'restockOffer'") && strings.join('').includes('jsonb_build_object')) {
          state.metadata = { restockOffer: JSON.parse(values[0] as string) }
        } else {
          state.metadata = null
        }
        return 1
      }),
    },
  }
})
vi.mock('@/lib/channels/config', () => ({ readBotToken: () => 'token' }))
vi.mock('@/lib/instagram/config', () => ({ readPageToken: () => 'token' }))
vi.mock('@/lib/instagram/media', () => ({ sendProductCarousel: vi.fn(async () => {}) }))
vi.mock('@/lib/channels/registry', () => ({
  isMessengerType: (type: string) => ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'].includes(type),
  getAdapter: () => ({
    sendText: vi.fn(async (_chat: string, text: string) => {
      if (state.failWith) throw state.failWith
      state.sent.push(text)
    }),
    sendProductCard: vi.fn(async (_chat: string, card: { name: string }) => { state.sent.push(`card:${card.name}`) }),
  }),
}))
vi.mock('@/lib/products/presentation', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  resolveProductShowcases: vi.fn(async () => [{ id: 'pouf', name: 'پاف مراکشی', price: 1_590_000, specs: [], imageUrl: null, productUrl: null }]),
}))
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: vi.fn(async (params: Record<string, unknown>) => { state.notifications.push(params) }) }))

import { rememberRestockOffer, resolveRestockTurn, sweepRestockAlerts } from '@/lib/commerce/restock-service'

const base = {
  enabled: true, workspaceId: 'w', agentId: 'a', conversationId: 'c1', contactId: 'k', contactPhone: null,
  channel: 'TELEGRAM' as const, lang: 'fa' as const, catalogProducts: [], activeEntityId: null,
}

beforeEach(() => {
  state.metadata = null
  state.alerts = []
  state.messages = []
  state.sent = []
  state.notifications = []
  state.failWith = null
  state.products[0].stock = 0
})

describe('back-in-stock, end to end', () => {
  it('offer → «آره» → alert → restock → one message with card → owner summary', async () => {
    await rememberRestockOffer('c1', [{ productId: 'pouf', variationId: null, name: 'پاف مراکشی', variant: null }])
    const accepted = await resolveRestockTurn({ ...base, message: 'آره لطفا', lastAssistantText: 'فعلاً ناموجوده؛ اگه بخواید، موجود که شد همین‌جا خبرتون می‌کنم' })
    expect(accepted.kind === 'reply' && accepted.text).toContain('«پاف مراکشی» که موجود شد، همین‌جا بهتون پیام می‌دم')
    expect(state.alerts).toHaveLength(1)

    // Still sold out: nothing is sent.
    expect((await sweepRestockAlerts()).notified).toBe(0)

    state.products[0].stock = 4
    const stats = await sweepRestockAlerts()
    expect(stats.notified).toBe(1)
    expect(state.sent[0]).toContain('سلام سارا!')
    expect(state.sent[0]).toContain('دوباره موجود شد')
    expect(state.sent).toContain('card:پاف مراکشی')
    expect(state.alerts[0].status).toBe('NOTIFIED')
    expect(state.messages).toHaveLength(1)
    expect(state.notifications[0].title).toContain('دوباره موجود شد')

    // Idempotent: a second sweep never re-sends.
    await sweepRestockAlerts()
    expect(state.sent.filter((text) => text.includes('دوباره موجود شد'))).toHaveLength(1)
  })

  it('never registers an alert for something already available', async () => {
    const reply = await resolveRestockTurn({ ...base, message: 'موجود شد خبرم کنید', lastAssistantText: null, activeEntityId: 'tv' })
    expect(reply.kind === 'reply' && reply.text).toContain('همین الان موجوده')
    expect(state.alerts).toHaveLength(0)
  })

  it('web visitor without a phone is asked for one, then registered', async () => {
    await rememberRestockOffer('c1', [{ productId: 'pouf', variationId: null, name: 'پاف مراکشی', variant: null }])
    const ask = await resolveRestockTurn({ ...base, channel: 'WEB_WIDGET', message: 'خبرم کنید', lastAssistantText: null })
    expect(ask.kind === 'reply' && ask.text).toContain('شماره موبایل')
    const done = await resolveRestockTurn({ ...base, channel: 'WEB_WIDGET', contactPhone: '09121112233', message: '09121112233', lastAssistantText: null })
    expect(done.kind === 'reply' && done.text).toContain('خبرتون می‌کنیم')
    expect(state.alerts).toHaveLength(1)
  })

  it('a closed Instagram window becomes a follow-up task, not a silent failure', async () => {
    await resolveRestockTurn({ ...base, channel: 'INSTAGRAM', message: 'موجود شد خبرم کن', lastAssistantText: null, activeEntityId: 'pouf' })
    state.products[0].stock = 2
    state.failWith = Object.assign(new Error('outside of allowed window'), { name: 'Instagram24hWindowError' })
    const stats = await sweepRestockAlerts()
    expect(stats.followUp).toBe(1)
    expect(state.alerts[0].status).toBe('NEEDS_FOLLOW_UP')
    expect(String(state.notifications[0].body)).toContain('پیگیری دستی')
  })

  it('a transient provider error keeps the alert active for the next sweep', async () => {
    await resolveRestockTurn({ ...base, message: 'موجود شد خبرم کن', lastAssistantText: null, activeEntityId: 'pouf' })
    state.products[0].stock = 2
    state.failWith = new Error('ECONNRESET')
    expect((await sweepRestockAlerts()).failed).toBe(1)
    expect(state.alerts[0].status).toBe('ACTIVE')
  })
})
