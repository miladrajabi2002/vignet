/**
 * What the overview's live stage shows under the agent: one entry per
 * module the business turned on or connected (store / WooCommerce, digital
 * menu, bookings, courses, the payment gateway before it is live). Every
 * number is read here; the stage only draws it. Each loader is independent
 * and fails to nothing, so one broken table never hides the stage.
 */
import { prisma } from '@/lib/prisma'
import type { ChannelKey } from '@/components/ui/channel-mark'
import type { CapabilityKey } from '@/lib/verticals/registry'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'
import { gatewaySetupState, type GatewaySetupStep } from '@/lib/payments/card/setup'
import { publicSiteUrl } from '@/lib/menu/public-menu'
import { loadGatewayOrders } from '@/lib/payments/card/fulfilment'

export interface StageStore {
  /** A WooCommerce plugin connection, the catalog kept in Vigent, or nothing yet. */
  source: 'woo' | 'manual' | 'none'
  url: string | null
  plugin: string | null
  /** The last sync; null for a manual catalog. */
  sync: { ok: boolean; at: string | null; error: string | null } | null
  /** A plugin push was refused by the plan's product limit. */
  resync: boolean
  products: number
  orders7: { count: number; toman: number }
  /** Orders the agent collected in chat and submitted, last 7 days. */
  chat7: number
  /** Payment links sent in the last 7 days and how many were paid; null when none were sent. */
  links: { sent: number; paid: number } | null
  /** Manual catalog only: products at or under their low-stock level. */
  low: number
  /** The latest orders, newest first, replayed on the stage. */
  latest: { label: string; toman: number; chat: boolean }[]
}

export interface StageMenu {
  items: number
  linkLive: boolean
  publicUrl: string
  chat7: number
  latest: number
}

export interface StageBookingRow {
  /** ISO start. */
  start: string
  minutes: number
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW'
  service: string
  /** First name and initial: «مریم ک.». */
  who: string
  /** Booked by the agent in a chat. */
  agent: boolean
  channel: ChannelKey | null
}

export type StageBookings =
  | { state: 'setup'; table: boolean; steps: { service: boolean; hours: boolean } }
  | {
      state: 'live'
      table: boolean
      services: number
      /** Today's window in Tehran minutes from midnight. */
      open: number
      close: number
      today: StageBookingRow[]
      upcoming: number
      pending: number
      lost7: number
    }

export interface StageCourse {
  title: string
  format: 'IN_PERSON' | 'ONLINE' | 'HYBRID'
  /** ISO start of the next session. */
  next: string | null
  started: boolean
  capacity: number
  confirmed: number
  pending: number
  waitlisted: number
  price: number | null
}

export type StageCourses =
  | { state: 'setup'; steps: { published: boolean; sessions: boolean } }
  | { state: 'live'; list: StageCourse[]; /** Course index of each recent sign-up, newest first. */ recent: number[] }

export interface StageModules {
  store: StageStore | null
  menu: StageMenu | null
  bookings: StageBookings | null
  courses: StageCourses | null
  /** The gateway's setup steps while it is not live; null once live or when the platform has it off. */
  paySetup: Record<GatewaySetupStep, boolean> | null
}

const TEHRAN_OFFSET_MS = 3.5 * 3_600_000
const DAY_MS = 86_400_000

function tehranDay(now: Date) {
  const local = new Date(now.getTime() + TEHRAN_OFFSET_MS)
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TEHRAN_OFFSET_MS
  return { start: new Date(start), end: new Date(start + DAY_MS), weekday: local.getUTCDay() }
}
const tehranMinute = (at: Date, dayStart: Date) => Math.round((at.getTime() - dayStart.getTime()) / 60_000)

/** Store order totals arrive in the store's own currency. */
function toToman(total: number, currency: string) {
  const code = currency.toUpperCase()
  if (code === 'IRR') return total / 10
  if (code === 'IRT' || code === 'TMN' || code === 'TOMAN') return total
  return 0
}

/** «مریم کاظمی» → «مریم ک.»: enough to recognise a booking, no full name on the overview. */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`
}

async function loadStore(workspaceId: string, since: Date): Promise<StageStore> {
  const [integration, workspace] = await Promise.all([
    prisma.storeIntegration.findFirst({
      where: { workspaceId, active: true },
      orderBy: [{ connectedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, type: true, storeUrl: true, pluginVersion: true, lastSyncAt: true, lastWebhookAt: true, lastSyncStatus: true, lastSyncError: true, productResyncNeededAt: true },
    }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { lowStockThreshold: true } }),
  ])
  const level = workspace?.lowStockThreshold ?? 0
  const [products, low, orders, chat7, linksSent, linksPaid, drafts] = await Promise.all([
    prisma.product.count({ where: { workspaceId, active: true } }),
    integration
      ? Promise.resolve(0)
      : prisma.product.count({ where: { workspaceId, active: true, stock: { gt: 0 }, OR: [{ lowStockAlertedAt: { not: null } }, ...(level > 0 ? [{ lowStockThreshold: null, stock: { lte: level } }] : [])] } }),
    prisma.storeOrder.findMany({ where: { workspaceId, deletedAt: null, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, select: { externalOrderId: true, total: true, currency: true } }),
    prisma.orderDraft.count({ where: { workspaceId, submittedAt: { gte: since } } }),
    prisma.orderDraft.count({ where: { workspaceId, checkoutMode: 'PAY_LINK', linkSentAt: { gte: since } } }),
    prisma.orderDraft.count({ where: { workspaceId, checkoutMode: 'PAY_LINK', linkSentAt: { gte: since }, paidAt: { not: null } } }),
    prisma.orderDraft.findMany({ where: { workspaceId, submittedAt: { gte: since } }, orderBy: { submittedAt: 'desc' }, take: 5, select: { grandTotal: true, total: true } }),
  ])
  const woo = integration?.type === 'WOOCOMMERCE'
  // Card-to-card orders paid through the Vigent gateway are orders too; the
  // orders page lists them beside the store's, so the overview counts both.
  const gateway7 = (await loadGatewayOrders(workspaceId, { take: 200 })).filter((purchase) => purchase.paidAt >= since)
  const toman = orders.reduce((sum, order) => sum + toToman(order.total, order.currency), 0)
    + gateway7.reduce((sum, purchase) => sum + purchase.total, 0)
  const latest = integration && orders.length
    ? orders.slice(0, 5).map((order) => ({ label: `سفارش #${order.externalOrderId}`, toman: toToman(order.total, order.currency), chat: false }))
    : drafts.map((draft) => ({ label: 'سفارش از گفتگو', toman: draft.grandTotal ?? draft.total ?? 0, chat: true }))
  return {
    source: integration ? 'woo' : products ? 'manual' : 'none',
    url: integration ? integration.storeUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '') : null,
    plugin: woo ? integration?.pluginVersion ?? null : null,
    sync: integration
      ? {
          ok: integration.lastSyncStatus !== 'error',
          at: (integration.lastWebhookAt && integration.lastSyncAt ? (integration.lastWebhookAt > integration.lastSyncAt ? integration.lastWebhookAt : integration.lastSyncAt) : integration.lastWebhookAt ?? integration.lastSyncAt)?.toISOString() ?? null,
          error: integration.lastSyncStatus === 'error' ? integration.lastSyncError : null,
        }
      : null,
    resync: Boolean(integration?.productResyncNeededAt),
    products,
    orders7: { count: orders.length + gateway7.length, toman: Math.round(toman) },
    chat7,
    links: linksSent ? { sent: linksSent, paid: linksPaid } : null,
    low,
    latest,
  }
}

async function loadMenu(workspaceId: string, since: Date): Promise<StageMenu> {
  const [workspace, items, linkLive, chat7] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } }),
    prisma.product.count({ where: { workspaceId, active: true } }),
    prisma.chatLink.count({ where: { workspaceId, enabled: true, agent: { active: true } } }),
    prisma.orderDraft.count({ where: { workspaceId, submittedAt: { gte: since } } }),
  ])
  return { items, linkLive: linkLive > 0, publicUrl: `${publicSiteUrl()}/menu/${workspace?.slug ?? ''}`, chat7, latest: Math.min(chat7, 5) }
}

async function loadBookings(workspaceId: string, now: Date, table: boolean): Promise<StageBookings> {
  const day = tehranDay(now)
  const [services, bookable] = await Promise.all([
    prisma.service.count({ where: { workspaceId, active: true } }),
    prisma.service.count({ where: { workspaceId, active: true, weeklyRules: { some: { active: true } } } }),
  ])
  if (!services || !bookable) return { state: 'setup', table, steps: { service: services > 0, hours: bookable > 0 } }
  const [rows, rules, upcoming, pending, lost7] = await Promise.all([
    prisma.appointment.findMany({
      where: { workspaceId, startsAt: { gte: day.start, lt: day.end }, status: { not: 'CANCELLED' } },
      orderBy: { startsAt: 'asc' },
      take: 40,
      select: {
        startsAt: true, endsAt: true, status: true, source: true, customerName: true,
        service: { select: { name: true } },
        contact: { select: { conversations: { orderBy: { lastMessageAt: 'desc' }, take: 1, select: { channel: true } } } },
      },
    }),
    prisma.serviceAvailabilityRule.findMany({ where: { active: true, weekday: day.weekday, service: { workspaceId, active: true } }, select: { startMinute: true, endMinute: true } }),
    prisma.appointment.count({ where: { workspaceId, startsAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.appointment.count({ where: { workspaceId, startsAt: { gte: now }, status: 'PENDING' } }),
    prisma.appointment.count({ where: { workspaceId, startsAt: { gte: new Date(now.getTime() - 7 * DAY_MS), lt: now }, status: { in: ['CANCELLED', 'NO_SHOW'] } } }),
  ])
  const today = rows.map((row) => ({
    start: row.startsAt.toISOString(),
    minutes: Math.max(5, Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000)),
    status: row.status as StageBookingRow['status'],
    service: row.service.name,
    who: shortName(row.customerName),
    agent: row.source === 'agent',
    channel: (row.contact?.conversations[0]?.channel as ChannelKey | undefined) ?? null,
  }))
  // The day's window: the working hours, widened to every booking, whole hours.
  const mins = [...rules.map((rule) => rule.startMinute), ...rows.map((row) => tehranMinute(row.startsAt, day.start))]
  const maxs = [...rules.map((rule) => rule.endMinute), ...rows.map((row) => tehranMinute(row.endsAt, day.start))]
  const open = mins.length ? Math.max(0, Math.floor(Math.min(...mins) / 60) * 60) : 9 * 60
  const close = maxs.length ? Math.min(24 * 60, Math.ceil(Math.max(...maxs) / 60) * 60) : 21 * 60
  return { state: 'live', table, services, open, close: Math.max(close, open + 4 * 60), today, upcoming, pending, lost7 }
}

async function loadCourses(workspaceId: string, now: Date, since: Date): Promise<StageCourses> {
  const courses = await prisma.course.findMany({
    where: { workspaceId, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { id: true, title: true, format: true, capacity: true, price: true, sessions: { orderBy: { startsAt: 'asc' }, select: { startsAt: true } } },
  })
  const scheduled = courses.filter((course) => course.sessions.length)
  if (!courses.length || !scheduled.length) return { state: 'setup', steps: { published: courses.length > 0, sessions: scheduled.length > 0 } }
  // The three whose next session comes first; finished ones last.
  const withNext = scheduled
    .map((course) => ({ course, next: course.sessions.find((session) => session.startsAt >= now)?.startsAt ?? null }))
    .sort((a, b) => (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity))
    .slice(0, 3)
  const ids = withNext.map((entry) => entry.course.id)
  const [counts, recent] = await Promise.all([
    prisma.courseEnrollment.groupBy({ by: ['courseId', 'status'], where: { courseId: { in: ids } }, _count: { _all: true } }),
    prisma.courseEnrollment.findMany({ where: { courseId: { in: ids }, createdAt: { gte: since }, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' }, take: 5, select: { courseId: true } }),
  ])
  const count = (id: string, status: string) => counts.find((row) => row.courseId === id && row.status === status)?._count._all ?? 0
  return {
    state: 'live',
    list: withNext.map(({ course, next }) => ({
      title: course.title,
      format: course.format,
      next: next?.toISOString() ?? null,
      started: course.sessions[0].startsAt < now,
      capacity: course.capacity,
      confirmed: count(course.id, 'CONFIRMED'),
      pending: count(course.id, 'PENDING'),
      waitlisted: count(course.id, 'WAITLISTED'),
      price: course.price,
    })),
    recent: recent.map((row) => ids.indexOf(row.courseId)),
  }
}

/** The four setup steps while the gateway is not live (the live gateway comes from loadGatewayWeek). */
async function loadPaySetup(workspaceId: string): Promise<Record<GatewaySetupStep, boolean> | null> {
  const [workspace, platform, cards, devices] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true, payGatewaySuspendedAt: true } }),
    getPlatformGatewaySettings(),
    prisma.payCard.findMany({ where: { workspaceId, deletedAt: null }, select: { active: true } }),
    prisma.payDevice.findMany({ where: { workspaceId }, select: { active: true, verifiedAt: true } }),
  ])
  if (!platform.enabled || workspace?.payGatewaySuspendedAt) return null
  // gatewaySetupState reads only these fields of each card and phone.
  type SetupInput = Parameters<typeof gatewaySetupState>[0]
  const state = gatewaySetupState({
    cards: cards as SetupInput['cards'],
    devices: devices.map((device) => ({ active: device.active, verifiedAt: device.verifiedAt?.toISOString() ?? null })) as SetupInput['devices'],
    enabled: Boolean(workspace?.payGatewayEnabled),
    platformEnabled: platform.enabled,
  })
  return state.done
}

export async function loadStageModules(params: {
  workspaceId: string
  capabilities: readonly CapabilityKey[]
  businessType: string | null
  /** The live gateway week was found: no setup steps needed. */
  gatewayLive: boolean
  now?: Date
}): Promise<StageModules> {
  const { workspaceId, capabilities } = params
  const now = params.now ?? new Date()
  const since = new Date(now.getTime() - 7 * DAY_MS)
  const has = (key: CapabilityKey) => capabilities.includes(key)
  const storeConnected = has('products') ? true : (await prisma.storeIntegration.count({ where: { workspaceId, active: true } }).catch(() => 0)) > 0
  const quiet = <T>(promise: Promise<T>) => promise.catch((error) => { console.error('[stage-modules]', error); return null })
  const [store, menu, bookings, courses, paySetup] = await Promise.all([
    storeConnected ? quiet(loadStore(workspaceId, since)) : null,
    has('digital-menu') ? quiet(loadMenu(workspaceId, since)) : null,
    has('bookings') ? quiet(loadBookings(workspaceId, now, params.businessType === 'FOOD')) : null,
    has('courses') ? quiet(loadCourses(workspaceId, now, since)) : null,
    params.gatewayLive ? null : quiet(loadPaySetup(workspaceId)),
  ])
  return { store, menu, bookings, courses, paySetup }
}

