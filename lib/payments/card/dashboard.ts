/**
 * What the «درگاه پرداخت» dashboard pages read: one loader, so every tab
 * agrees on whether the gateway is ready and why not.
 */
import { prisma } from '@/lib/prisma'
import { deviceUrl } from '@/lib/payments/card/ingest'
import { getGatewayUsage, getPlatformGatewaySettings, type GatewayUsage } from '@/lib/payments/card/platform'
import { readPayGatewaySettings, type PayGatewaySettings } from '@/lib/payments/card/settings'
import { receivedTodayByCard } from '@/lib/payments/card/service'

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
}

export async function loadGatewayOverview(workspaceId: string): Promise<GatewayOverview> {
  const [workspace, platform, cards, devices, agents, received, review, unmatched, pending] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { plan: true, payGatewayEnabled: true, payGatewaySettings: true } }),
    getPlatformGatewaySettings(),
    prisma.payCard.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.payDevice.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
    prisma.agent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, orderCaptureEnabled: true, payLinkEnabled: true, cardPayEnabled: true } }),
    receivedTodayByCard(workspaceId),
    prisma.cardPayment.count({ where: { workspaceId, status: 'CLAIMED' } }),
    prisma.bankSms.count({ where: { workspaceId, status: 'UNMATCHED' } }),
    prisma.cardPayment.count({ where: { workspaceId, status: 'PENDING' } }),
  ])
  const usage = await getGatewayUsage(workspaceId, workspace.plan)
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
  return {
    enabled: workspace.payGatewayEnabled,
    platformEnabled: platform.enabled,
    settings: readPayGatewaySettings(workspace.payGatewaySettings),
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
