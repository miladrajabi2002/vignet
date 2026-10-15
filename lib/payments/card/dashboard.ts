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

export async function loadGatewayOverview(workspaceId: string): Promise<GatewayOverview> {
  const [workspace, platform, cards, devices, agents, received, review, unmatched, pending, realPayment] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { plan: true, payGatewayEnabled: true, payGatewaySettings: true, payGatewaySuspendedAt: true, payGatewaySuspendReason: true, payGatewayCapOverride: true } }),
    getPlatformGatewaySettings(),
    prisma.payCard.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.payDevice.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
    prisma.agent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, orderCaptureEnabled: true, payLinkEnabled: true, cardPayEnabled: true } }),
    receivedTodayByCard(workspaceId),
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED' } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
    prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING' } }),
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
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED' } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
  ])
  const attention = review + unmatched
  if (!platform.enabled) return { state: 'off', attention }
  if (workspace?.payGatewaySuspendedAt) return { state: 'suspended', attention }
  if (workspace?.payGatewayEnabled && cards > 0 && devices > 0) return { state: 'live', attention }
  return { state: cards > 0 || devices > 0 ? 'setup' : 'off', attention }
}
