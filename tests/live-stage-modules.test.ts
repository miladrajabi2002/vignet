import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ArrowLeft } from 'lucide-react'
import { BookingsPanel, CoursesPanel, MenuPanel, moduleNodes, PayPanel, StorePanel } from '@/components/dashboard/stage-panels'
import { LiveStage } from '@/components/dashboard/live-stage'
import type { StageModules, StageStore } from '@/lib/dashboard/stage-modules'
import type { GatewayWeek } from '@/lib/payments/card/dashboard'

const NOW = Date.now()
const iso = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60_000).toISOString()

const woo: StageStore = {
  source: 'woo', url: 'shop.nila.ir', plugin: '4.2.4', sync: { ok: true, at: iso(-4), error: null }, resync: false,
  products: 248, orders7: { count: 67, toman: 98_400_000 }, chat7: 23, links: { sent: 31, paid: 23 }, low: 0,
  latest: [{ label: 'سفارش #1245', toman: 2_200_000, chat: false }, { label: 'سفارش #1244', toman: 3_250_000, chat: false }],
}
const gatewayLive: GatewayWeek = {
  paid: 2, amount: 5_450_000, review: 3, daily: [0, 0, 0, 0, 0, 3_250_000, 2_200_000],
  recent: [
    { amount: 2_200_000, reference: 'NL-2041', purpose: 'ORDER', cardId: 'c1', paidAt: iso(-6) },
    { amount: 3_250_000, reference: 'NL-2040', purpose: 'BOOKING', cardId: 'c2', paidAt: iso(-1440) },
  ],
  cards: [
    { id: 'c1', bankKey: 'mellat', pan: '6104 33•• •••• 5675', holder: 'نیلوفر احمدی', week: 2_200_000, today: 2_200_000, dailyCap: 50_000_000, verified: true },
    { id: 'c2', bankKey: 'saman', pan: '6219 86•• •••• 2210', holder: 'نیلوفر احمدی', week: 3_250_000, today: 0, dailyCap: null, verified: false },
  ],
}
const full: StageModules = {
  store: woo,
  menu: { items: 46, linkLive: true, publicUrl: 'https://vigent.ir/menu/sib', chat7: 34, latest: 2 },
  bookings: {
    state: 'live', table: false, services: 3, open: 9 * 60, close: 21 * 60, upcoming: 41, pending: 6, lost7: 3,
    today: [
      { start: iso(-120), minutes: 60, status: 'COMPLETED', service: 'پاکسازی پوست', who: 'الهام ر.', agent: false, channel: null },
      { start: iso(50), minutes: 60, status: 'CONFIRMED', service: 'پاکسازی پوست', who: 'مریم ک.', agent: true, channel: 'INSTAGRAM' },
      { start: iso(140), minutes: 45, status: 'PENDING', service: 'لیزر', who: 'نگار ا.', agent: true, channel: 'WHATSAPP' },
    ],
  },
  courses: {
    state: 'live',
    list: [
      { title: 'دورهٔ جامع IELTS', format: 'ONLINE', next: iso(3 * 1440), started: false, capacity: 20, confirmed: 14, pending: 3, waitlisted: 0, price: 6_800_000 },
      { title: 'مکالمهٔ متوسط', format: 'IN_PERSON', next: iso(2 * 1440), started: true, capacity: 12, confirmed: 12, pending: 0, waitlisted: 4, price: 3_900_000 },
      { title: 'کارگاه بزرگ', format: 'HYBRID', next: null, started: true, capacity: 120, confirmed: 70, pending: 5, waitlisted: 0, price: null },
    ],
    recent: [0, 0, 1],
  },
  paySetup: null,
}
// The panels' props differ; each call passes what that panel needs.
const render = (type: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(type as ComponentType<Record<string, unknown>>, { Arrow: ArrowLeft, locale: 'fa', ...props }))

describe('live stage modules', () => {
  it('lists one node per module, in order, with real states and replays', () => {
    const nodes = moduleNodes(full, gatewayLive, 'fa')
    expect(nodes.map((node) => node.key)).toEqual(['store', 'menu', 'bookings', 'courses', 'pay'])
    expect(nodes.find((node) => node.key === 'store')).toMatchObject({ state: 'live', events: 2, name: 'ووکامرس' })
    expect(nodes.find((node) => node.key === 'bookings')).toMatchObject({ state: 'live', events: 2 })
    expect(nodes.find((node) => node.key === 'courses')).toMatchObject({ state: 'live', events: 3 })
    expect(nodes.find((node) => node.key === 'pay')).toMatchObject({ state: 'live', events: 1 })
  })

  it('stops replays on a failed sync and marks it bad', () => {
    const broken = { ...full, store: { ...woo, sync: { ok: false, at: iso(-120), error: 'کلید دسترسی ووکامرس پذیرفته نشد (401).' } } }
    expect(moduleNodes(broken, null, 'fa').find((node) => node.key === 'store')).toMatchObject({ state: 'bad', events: 0 })
  })

  it('shows setup nodes when nothing is ready and no pay node when the platform has the gateway off', () => {
    const fresh: StageModules = { store: { ...woo, source: 'none', url: null, plugin: null, sync: null, products: 0, latest: [], links: null, orders7: { count: 0, toman: 0 }, chat7: 0 }, menu: null, bookings: { state: 'setup', table: true, steps: { service: true, hours: false } }, courses: null, paySetup: { card: true, phone: false, test: false, switch: false } }
    const nodes = moduleNodes(fresh, null, 'fa')
    expect(nodes.map((node) => [node.key, node.state])).toEqual([['store', 'setup'], ['bookings', 'setup'], ['pay', 'setup']])
    expect(nodes.find((node) => node.key === 'bookings')?.name).toBe('رزرو میز')
    expect(moduleNodes({ ...fresh, paySetup: null }, null, 'fa').some((node) => node.key === 'pay')).toBe(false)
  })

  it('renders every panel in every state', () => {
    const pay = render(PayPanel, { gateway: gatewayLive, payments: gatewayLive.recent, setup: null, narrow: false, width: 600 })
    expect(pay).toContain('سفارش NL-2041')
    expect(pay).toContain('۳ منتظر تأیید')
    expect(pay.match(/ls-bars/g)).toHaveLength(1)
    // The wallet stays minimal: no card footers, caps or bank captions.
    for (const gone of ['با واریز واقعی تأیید شده', 'سقف روزانه', 'کارت‌به‌کارت', 'همهٔ پرداخت‌ها', 'امروز ۲٬۲۰۰٬۰۰۰']) expect(pay).not.toContain(gone)
    expect(render(PayPanel, { gateway: { ...gatewayLive, cards: [], recent: [] }, payments: [], setup: null, narrow: true, width: 311 })).toContain('کارت فعالی نیست')
    const setup = render(PayPanel, { gateway: null, payments: [], setup: { card: true, phone: true, test: false, switch: false }, narrow: false, width: 600 })
    expect(setup).toContain('ادامهٔ راه‌اندازی')
    expect(setup).toContain('قدم بعد')
    expect(render(PayPanel, { gateway: { ...gatewayLive, recent: [] }, payments: [], setup: null, narrow: false, width: 600 })).not.toContain('ls-feed')

    const synced = render(StorePanel, { data: woo })
    expect(synced).toContain('shop.nila.ir')
    expect(synced).toContain('ls-src')
    expect(synced).toContain('is-feed')
    const broken = render(StorePanel, { data: { ...woo, sync: { ok: false, at: iso(-120), error: 'کلید دسترسی ووکامرس پذیرفته نشد (401).' }, resync: true } })
    expect(broken).toContain('همگام نیست')
    expect(broken).toContain('سقف محصول پلن پر است')
    // Without WooCommerce: just products and orders, no prompt to connect a site.
    const manual = render(StorePanel, { data: { ...woo, source: 'manual', url: null, plugin: null, sync: null, links: null, low: 2 } })
    for (const gone of ['ووکامرس', 'Woo', 'اتصال', 'محصول رو به اتمام', 'ثبت‌شده در گفتگو', 'سفارش · ۷ روز']) expect(manual).not.toContain(gone)
    expect(manual.match(/class="ls-stat"/g)).toHaveLength(2)
    expect(render(StorePanel, { data: { ...woo, source: 'none', products: 0, url: null, sync: null } })).toContain('افزودن اولین محصول')

    expect(render(MenuPanel, { data: full.menu, narrow: false })).toContain('href="/menu/orders"')
    expect(render(MenuPanel, { data: { ...full.menu, linkLive: false }, narrow: false })).toContain('لینک گفتگو خاموش است')
    expect(render(BookingsPanel, { data: full.bookings, narrow: false })).toContain('منتظر پیش‌پرداخت')
    expect(render(BookingsPanel, { data: { state: 'setup', table: false, steps: { service: true, hours: false } }, narrow: true })).toContain('تعیین ساعت کاری')
    const courses = render(CoursesPanel, { data: full.courses })
    expect(courses).toContain('در فهرست انتظار')
    expect(courses).toContain('ls-seat-bar')
    expect(render(CoursesPanel, { data: { state: 'setup', steps: { published: true, sessions: false } } })).toContain('زمان جلسات دوره')
  })

  it('renders the stage shell on the server without the browser', () => {
    const html = renderToStaticMarkup(createElement(LiveStage, {
      locale: 'fa', agentName: 'دستیار', automationRate: 80, gateway: gatewayLive, modules: full,
      inputs: [{ channel: 'INSTAGRAM', count: 12, connected: true }],
      outputs: [{ key: 'resolved', label: 'حل خودکار', value: 9, href: '/c', tone: 'ok' }],
    }))
    expect(html).toContain('جریان ۷ روز اخیر')
  })
})
