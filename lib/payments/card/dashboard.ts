/**
 * What the «درگاه پرداخت» dashboard pages read: one loader, so every tab
 * agrees on whether the gateway is ready and why not.
 */
import { prisma } from '@/lib/prisma'
import { deviceUrl } from '@/lib/payments/card/ingest'
import { getGatewayUsage, getPlatformGatewaySettings, type GatewayUsage } from '@/lib/payments/card/platform'
import { readPayGatewaySettings, type PayGatewaySettings } from '@/lib/payments/card/settings'
import { receivedTodayByCard } from '@/lib/payments/card/service'
import { gatewaySetupState } from '@/lib/payments/card/setup'

export interface GatewayCardRow {
  id: string
  bankKey: string
  bin: string
  last4: string
  holderName: string
  active: boolean
  dailyCap: number | null
  verified: boolean
  receivedToday: number
}

export interface GatewayDeviceRow {
  id: string
  name: string
  platform: 'ANDROID' | 'IOS'
  method: 'SMS' | 'URL'
  phone: string | null
  /** The forwarding rule's filter text, as the bank prints it. */
  keyword: string | null
  url: string
  active: boolean
  connectedAt: string | null
  verifiedAt: string | null
  lastSmsAt: string | null
}

export interface GatewayAgentRow {
  id: string
  name: string
  orderCaptureEnabled: boolean
  payLinkEnabled: boolean
  cardPayEnabled: boolean
}

export interface GatewayOverview {
  /** The owner's master switch. */
  enabled: boolean
  /** Switched off for the whole platform by the admin. */
  platformEnabled: boolean
  settings: PayGatewaySettings
  cards: GatewayCardRow[]
  devices: GatewayDeviceRow[]
  agents: GatewayAgentRow[]
  usage: GatewayUsage
  /** SMS lines the owner's phone forwards to; empty until the admin sets one. */
  inboundLines: string[]
  maxAmount: number
  /** Card + connected phone: the gateway can confirm a payment by itself. */
  ready: boolean
  counts: { review: number; unmatched: number; pending: number }
  /** Paused by the platform admin; the owner sees why. */
  suspended: { reason: string | null } | null
  /** The four setup steps were finished once: the dashboard shows its tabs. */
  activated: boolean
  /** When that happened (ISO), for the one-time «it's live» note. */
  activatedAt: string | null
}

/** The setup's own test transfers («TEST-…») are never a customer's payment. */
export const NOT_TEST = { NOT: { reference: { startsWith: 'TEST-' } } }

/**
 * Once the gateway goes live, what the setup left behind is not the owner's
 * business: deposits that matched nothing while they were testing, and test
 * transfers still open or waiting for review.
 */
async function clearSetupLeftovers(workspaceId: string) {
  await prisma.$transaction([
    prisma.bankSms.updateMany({ where: { workspaceId, status: 'UNMATCHED' }, data: { status: 'RESOLVED' } }),
    prisma.cardPayment.updateMany({ where: { workspaceId, reference: { startsWith: 'TEST-' }, status: { in: ['PENDING', 'CLAIMED'] } }, data: { status: 'CANCELLED' } }),
  ])
}

export async function loadGatewayOverview(workspaceId: string): Promise<GatewayOverview> {
  const [workspace, platform, cards, devices, agents, received, review, unmatched, pending, realPayment] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { plan: true, payGatewayEnabled: true, payGatewaySettings: true, payGatewaySuspendedAt: true, payGatewaySuspendReason: true, payGatewayCapOverride: true } }),
    getPlatformGatewaySettings(),
    prisma.payCard.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.payDevice.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
    prisma.agent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, orderCaptureEnabled: true, payLinkEnabled: true, cardPayEnabled: true } }),
    receivedTodayByCard(workspaceId),
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED', ...NOT_TEST } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
    prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING', ...NOT_TEST } }),
    prisma.cardPayment.findFirst({ where: { workspaceId, NOT: { reference: { startsWith: 'TEST-' } } }, select: { id: true } }),
  ])
  const usage = await getGatewayUsage(workspaceId, workspace.plan, workspace.payGatewayCapOverride)
  const cardRows: GatewayCardRow[] = cards.map((card) => ({
    id: card.id,
    bankKey: card.bankKey,
    bin: card.bin,
    last4: card.last4,
    holderName: card.holderName,
    active: card.active,
    dailyCap: card.dailyCap,
    verified: Boolean(card.verifiedAt),
    receivedToday: received.get(card.id) ?? 0,
  }))
  const deviceRows: GatewayDeviceRow[] = devices.map((device) => ({
    id: device.id,
    name: device.name,
    platform: device.platform === 'IOS' ? 'IOS' : 'ANDROID',
    method: device.method === 'URL' ? 'URL' : 'SMS',
    phone: device.phone,
    keyword: device.keyword,
    url: deviceUrl(device),
    active: device.active,
    connectedAt: device.connectedAt?.toISOString() ?? null,
    verifiedAt: device.verifiedAt?.toISOString() ?? null,
    lastSmsAt: device.lastSmsAt?.toISOString() ?? null,
  }))
  const settings = readPayGatewaySettings(workspace.payGatewaySettings)
  // Activation is remembered the first time all four steps are done (or,
  // for a business that set up before the steps were required, once it has
  // a real payment), so a card or phone removed later never hides the tabs.
  let activatedAt = settings.activatedAt
  if (!activatedAt) {
    const setup = gatewaySetupState({ cards: cardRows, devices: deviceRows, enabled: workspace.payGatewayEnabled, platformEnabled: platform.enabled })
    if (setup.complete || realPayment) {
      activatedAt = new Date().toISOString()
      await prisma.workspace.update({ where: { id: workspaceId }, data: { payGatewaySettings: { ...settings, activatedAt } } }).catch(() => null)
      await clearSetupLeftovers(workspaceId).catch(() => null)
    }
  }
  return {
    enabled: workspace.payGatewayEnabled,
    platformEnabled: platform.enabled,
    suspended: workspace.payGatewaySuspendedAt ? { reason: workspace.payGatewaySuspendReason } : null,
    activated: Boolean(activatedAt),
    activatedAt,
    settings: { ...settings, activatedAt },
    cards: cardRows,
    devices: deviceRows,
    agents,
    usage,
    inboundLines: platform.inboundLines,
    maxAmount: platform.maxAmount,
    ready: cardRows.some((card) => card.active) && deviceRows.some((device) => device.active && device.connectedAt),
    counts: { review, unmatched, pending },
  }
}

export type GatewayNavState = 'off' | 'setup' | 'live' | 'suspended'

/**
 * The gateway's state for the main menu, in four cheap queries: live once
 * it is on with a card and a connected phone, «setup» once the owner has
 * started, and how many payments wait for the owner's decision.
 */
export async function loadGatewayNavState(workspaceId: string): Promise<{ state: GatewayNavState; attention: number }> {
  const [workspace, platform, cards, devices, review, unmatched] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true, payGatewaySuspendedAt: true } }),
    getPlatformGatewaySettings(),
    prisma.payCard.count({ where: { workspaceId, active: true, deletedAt: null } }),
    prisma.payDevice.count({ where: { workspaceId, active: true, connectedAt: { not: null } } }),
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED', ...NOT_TEST } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
  ])
  const attention = review + unmatched
  if (!platform.enabled) return { state: 'off', attention }
  if (workspace?.payGatewaySuspendedAt) return { state: 'suspended', attention }
  if (workspace?.payGatewayEnabled && cards > 0 && devices > 0) return { state: 'live', attention }
  return { state: cards > 0 || devices > 0 ? 'setup' : 'off', attention }
}

export interface GatewayWeekCard {
  id: string
  bankKey: string
  /** Masked for display: «6104 33•• •••• 4218». */
  pan: string
  holder: string
  /** Paid into this card in the last seven days / today (tomans). */
  week: number
  today: number
  dailyCap: number | null
}

export interface GatewayWeek {
  paid: number
  amount: number
  /** Payments and deposits waiting for the owner's decision. */
  review: number
  /** Tomans paid per Tehran day, oldest first; the last one is today. */
  daily: number[]
  /** The latest paid payments, newest first. */
  recent: { amount: number; reference: string; purpose: string; cardId: string; paidAt: string }[]
  /** Active cards, in the owner's order. */
  cards: GatewayWeekCard[]
}

const TEHRAN_OFFSET_MS = 3.5 * 3_600_000
const DAY_MS = 86_400_000

/**
 * The gateway's last seven days for the overview's flow: what was paid, day
 * by day and card by card, and the latest payments the flow replays. Null
 * until the gateway is live (set up once, on, not paused), so the flow shows
 * it only then and the setup tile shows before.
 */
export async function loadGatewayWeek(workspaceId: string, now = new Date()): Promise<GatewayWeek | null> {
  const [workspace, platform] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewayEnabled: true, payGatewaySuspendedAt: true, payGatewaySettings: true } }),
    getPlatformGatewaySettings(),
  ])
  if (!workspace?.payGatewayEnabled || workspace.payGatewaySuspendedAt || !platform.enabled) return null
  if (!readPayGatewaySettings(workspace.payGatewaySettings).activatedAt) return null

  // Tehran calendar days, so «today» matches the cards' daily caps.
  const local = new Date(now.getTime() + TEHRAN_OFFSET_MS)
  const todayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TEHRAN_OFFSET_MS
  const weekStart = new Date(todayStart - 6 * DAY_MS)
  const [cards, payments, review, unmatched] = await Promise.all([
    prisma.payCard.findMany({ where: { workspaceId, active: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.cardPayment.findMany({
      where: { workspaceId, status: 'PAID', paidAt: { gte: weekStart }, ...NOT_TEST },
      orderBy: { paidAt: 'desc' },
      select: { baseAmount: true, reference: true, purpose: true, cardId: true, paidAt: true },
    }),
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED', ...NOT_TEST } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
  ])

  const daily = Array.from({ length: 7 }, () => 0)
  const week = new Map<string, number>()
  const today = new Map<string, number>()
  for (const payment of payments) {
    const at = payment.paidAt?.getTime() ?? 0
    const day = Math.min(6, Math.max(0, Math.floor((at - weekStart.getTime()) / DAY_MS)))
    daily[day] += payment.baseAmount
    week.set(payment.cardId, (week.get(payment.cardId) ?? 0) + payment.baseAmount)
    if (at >= todayStart) today.set(payment.cardId, (today.get(payment.cardId) ?? 0) + payment.baseAmount)
  }
  const activeIds = new Set(cards.map((card) => card.id))
  return {
    paid: payments.length,
    amount: daily.reduce((sum, value) => sum + value, 0),
    review: review + unmatched,
    daily,
    recent: payments
      .filter((payment) => activeIds.has(payment.cardId) && payment.paidAt)
      .slice(0, 5)
      .map((payment) => ({ amount: payment.baseAmount, reference: payment.reference, purpose: payment.purpose, cardId: payment.cardId, paidAt: payment.paidAt!.toISOString() })),
    cards: cards.map((card) => ({
      id: card.id,
      bankKey: card.bankKey,
      pan: `${card.bin.slice(0, 4)} ${card.bin.slice(4)}•• •••• ${card.last4}`,
      holder: card.holderName,
      week: week.get(card.id) ?? 0,
      today: today.get(card.id) ?? 0,
      dailyCap: card.dailyCap,
    })),
  }
}
