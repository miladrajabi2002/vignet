/**
 * Admin «درگاه پرداخت»: every business that uses the card-to-card gateway,
 * its health and its money, read for /admin/payment-gateway.
 */
import type { Plan, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NOT_TEST } from '@/lib/payments/card/dashboard'
import { effectiveMonthlyCap, getPlatformGatewaySettings, monthStart } from '@/lib/payments/card/platform'

const DAY_MS = 24 * 60 * 60 * 1000
/** A connected phone silent this long while payments wait is worth a look. */
export const SILENT_DEVICE_MS = 24 * 60 * 60 * 1000

export type GatewayBusinessState = 'live' | 'setup' | 'off' | 'suspended'

export interface GatewayBusinessRow {
  workspaceId: string
  name: string
  ownerPhone: string | null
  plan: Plan
  state: GatewayBusinessState
  suspendReason: string | null
  cards: number
  activeCards: number
  /** Cards the owner removed; their payments stay in the history. */
  deletedCards: number
  devices: number
  lastSmsAt: Date | null
  silentDevice: boolean
  monthPaid: number
  monthVolume: number
  cap: number | null
  capOverride: number | null
  autoRate: number | null
  review: number
  unmatched: number
  pending: number
  lastPaidAt: Date | null
}

export type GatewayBusinessFilter = 'all' | 'live' | 'attention' | 'setup' | 'suspended'

function stateOf(row: { enabled: boolean; suspended: boolean; activeCards: number; connected: boolean }): GatewayBusinessState {
  if (row.suspended) return 'suspended'
  if (!row.enabled) return 'off'
  return row.activeCards > 0 && row.connected ? 'live' : 'setup'
}

/**
 * Every business that switched the gateway on, added a card or took a payment
 * — a business that later deleted its cards still has money in the history —
 * with its numbers. The setup's test transfers never count as payments, the
 * same rule the monthly cap itself follows (lib/payments/card/platform.ts).
 */
export async function loadGatewayBusinesses(): Promise<GatewayBusinessRow[]> {
  const since = monthStart()
  const [platform, withCards, enabled, withPayments] = await Promise.all([
    getPlatformGatewaySettings(true),
    prisma.payCard.groupBy({ by: ['workspaceId'] }),
    prisma.workspace.findMany({ where: { OR: [{ payGatewayEnabled: true }, { payGatewaySuspendedAt: { not: null } }] }, select: { id: true } }),
    prisma.cardPayment.groupBy({ by: ['workspaceId'], where: NOT_TEST }),
  ])
  const ids = [...new Set([...withCards.map((row) => row.workspaceId), ...enabled.map((row) => row.id), ...withPayments.map((row) => row.workspaceId)])]
  if (!ids.length) return []
  const scope = { workspaceId: { in: ids } }
  const [workspaces, cards, devices, paid, auto, review, unmatched, pending, lastPaid] = await Promise.all([
    prisma.workspace.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        plan: true,
        payGatewayEnabled: true,
        payGatewaySuspendedAt: true,
        payGatewaySuspendReason: true,
        payGatewayCapOverride: true,
        owner: { select: { phone: true } },
      },
    }),
    prisma.payCard.groupBy({ by: ['workspaceId', 'active', 'deletedAt'], where: scope, _count: { _all: true } }),
    prisma.payDevice.groupBy({ by: ['workspaceId'], where: { ...scope, active: true }, _count: { _all: true }, _max: { lastSmsAt: true, connectedAt: true } }),
    prisma.cardPayment.groupBy({ by: ['workspaceId'], where: { ...scope, ...NOT_TEST, status: 'PAID', paidAt: { gte: since } }, _count: { _all: true }, _sum: { baseAmount: true } }),
    prisma.cardPayment.groupBy({ by: ['workspaceId'], where: { ...scope, ...NOT_TEST, status: 'PAID', paidAt: { gte: since }, confirmedBy: 'AUTO' }, _count: { _all: true } }),
    prisma.cardPayment.groupBy({ by: ['workspaceId'], where: { ...scope, ...NOT_TEST, status: 'CLAIMED' }, _count: { _all: true } }),
    prisma.bankSms.groupBy({ by: ['workspaceId'], where: { ...scope, status: 'UNMATCHED' }, _count: { _all: true } }),
    prisma.cardPayment.groupBy({ by: ['workspaceId'], where: { ...scope, ...NOT_TEST, status: 'PENDING' }, _count: { _all: true } }),
    prisma.cardPayment.groupBy({ by: ['workspaceId'], where: { ...scope, ...NOT_TEST, status: 'PAID' }, _max: { paidAt: true } }),
  ])
  const count = <T extends { workspaceId: string; _count: { _all: number } }>(rows: T[]) => new Map(rows.map((row) => [row.workspaceId, row._count._all]))
  const autoBy = count(auto)
  const reviewBy = count(review)
  const unmatchedBy = count(unmatched)
  const pendingBy = count(pending)
  const paidBy = new Map(paid.map((row) => [row.workspaceId, { count: row._count._all, sum: row._sum.baseAmount ?? 0 }]))
  const deviceBy = new Map(devices.map((row) => [row.workspaceId, row]))
  const lastPaidBy = new Map(lastPaid.map((row) => [row.workspaceId, row._max.paidAt]))
  const now = Date.now()

  return workspaces.map((workspace) => {
    const cardRows = cards.filter((row) => row.workspaceId === workspace.id)
    const liveCards = cardRows.filter((row) => !row.deletedAt)
    const activeCards = liveCards.filter((row) => row.active).reduce((sum, row) => sum + row._count._all, 0)
    const allCards = liveCards.reduce((sum, row) => sum + row._count._all, 0)
    const deletedCards = cardRows.filter((row) => row.deletedAt).reduce((sum, row) => sum + row._count._all, 0)
    const device = deviceBy.get(workspace.id)
    const month = paidBy.get(workspace.id) ?? { count: 0, sum: 0 }
    const lastSmsAt = device?._max.lastSmsAt ?? null
    const pendingCount = pendingBy.get(workspace.id) ?? 0
    return {
      workspaceId: workspace.id,
      name: workspace.name,
      ownerPhone: workspace.owner?.phone ?? null,
      plan: workspace.plan,
      state: stateOf({ enabled: workspace.payGatewayEnabled, suspended: Boolean(workspace.payGatewaySuspendedAt), activeCards, connected: Boolean(device?._max.connectedAt) }),
      suspendReason: workspace.payGatewaySuspendReason,
      cards: allCards,
      activeCards,
      deletedCards,
      devices: device?._count._all ?? 0,
      lastSmsAt,
      // Payments wait, yet the phone has said nothing for a day.
      silentDevice: Boolean(device && workspace.payGatewayEnabled && pendingCount + (reviewBy.get(workspace.id) ?? 0) > 0 && (!lastSmsAt || now - lastSmsAt.getTime() > SILENT_DEVICE_MS)),
      monthPaid: month.count,
      monthVolume: month.sum,
      cap: effectiveMonthlyCap(platform.planMonthlyCaps, workspace.plan, workspace.payGatewayCapOverride),
      capOverride: workspace.payGatewayCapOverride,
      autoRate: month.count ? Math.round(((autoBy.get(workspace.id) ?? 0) / month.count) * 100) : null,
      review: reviewBy.get(workspace.id) ?? 0,
      unmatched: unmatchedBy.get(workspace.id) ?? 0,
      pending: pendingCount,
      lastPaidAt: lastPaidBy.get(workspace.id) ?? null,
    }
  })
}

export function filterGatewayBusinesses(rows: GatewayBusinessRow[], filter: GatewayBusinessFilter, query: string): GatewayBusinessRow[] {
  const q = query.trim().toLowerCase()
  return rows
    .filter((row) => {
      if (filter === 'live') return row.state === 'live'
      if (filter === 'setup') return row.state === 'setup' || row.state === 'off'
      if (filter === 'suspended') return row.state === 'suspended'
      if (filter === 'attention') return row.review > 0 || row.unmatched > 0 || row.silentDevice || (row.cap != null && row.monthPaid >= row.cap * 0.9)
      return true
    })
    .filter((row) => !q || row.name.toLowerCase().includes(q) || (row.ownerPhone ?? '').includes(q) || row.workspaceId === q)
    .sort((a, b) => b.review + b.unmatched - (a.review + a.unmatched) || b.monthVolume - a.monthVolume || a.name.localeCompare(b.name, 'fa'))
}

/** Platform-wide numbers and the paid volume of the last 30 days. */
export async function loadGatewaySummary() {
  const since = monthStart()
  const from = new Date(Date.now() - 29 * DAY_MS)
  from.setUTCHours(0, 0, 0, 0)
  const [paid, auto, claimed, unmatched, expired, created, daily] = await Promise.all([
    prisma.cardPayment.aggregate({ where: { ...NOT_TEST, status: 'PAID', paidAt: { gte: since } }, _count: { _all: true }, _sum: { baseAmount: true } }),
    prisma.cardPayment.count({ where: { ...NOT_TEST, status: 'PAID', paidAt: { gte: since }, confirmedBy: 'AUTO' } }),
    prisma.cardPayment.count({ where: { ...NOT_TEST, status: 'CLAIMED' } }),
    prisma.bankSms.count({ where: { status: 'UNMATCHED' } }),
    prisma.cardPayment.count({ where: { ...NOT_TEST, status: 'EXPIRED', createdAt: { gte: since } } }),
    prisma.cardPayment.count({ where: { ...NOT_TEST, createdAt: { gte: since } } }),
    prisma.$queryRaw<Array<{ day: Date; volume: bigint | number | null; count: bigint | number }>>`
      SELECT date_trunc('day', ("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran') AS day, SUM("baseAmount") AS volume, COUNT(*) AS count
      FROM "CardPayment" WHERE status = 'PAID' AND "paidAt" >= ${from} AND reference NOT LIKE 'TEST-%'
      GROUP BY 1 ORDER BY 1`,
  ])
  const byDay = new Map(daily.map((row) => [row.day.toISOString().slice(0, 10), { volume: Number(row.volume ?? 0), count: Number(row.count) }]))
  const series = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(from.getTime() + index * DAY_MS).toISOString().slice(0, 10)
    return { day, volume: byDay.get(day)?.volume ?? 0, count: byDay.get(day)?.count ?? 0 }
  })
  return {
    monthPaid: paid._count._all,
    monthVolume: paid._sum.baseAmount ?? 0,
    autoRate: paid._count._all ? Math.round((auto / paid._count._all) * 100) : null,
    claimed,
    unmatched,
    // Of the payments issued this month, the share that was paid.
    conversion: created ? Math.round((paid._count._all / created) * 100) : null,
    expired,
    series,
  }
}

export type AdminPaymentFilter = 'all' | 'open' | 'review' | 'paid' | 'failed'

export function adminPaymentWhere(filter: AdminPaymentFilter, query: string, workspaceId?: string): Prisma.CardPaymentWhereInput {
  const where: Prisma.CardPaymentWhereInput = workspaceId ? { workspaceId } : {}
  if (filter === 'open') where.status = 'PENDING'
  if (filter === 'review') where.status = 'CLAIMED'
  if (filter === 'paid') where.status = 'PAID'
  if (filter === 'failed') where.status = { in: ['EXPIRED', 'FAILED', 'CANCELLED'] }
  const q = query.trim()
  if (q) {
    const digits = q.replace(/\D/g, '')
    where.OR = [
      { reference: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q } },
      { workspace: { name: { contains: q, mode: 'insensitive' } } },
      ...(digits.length >= 4 && Number.isSafeInteger(Number(digits)) ? [{ payAmount: Number(digits) }, { baseAmount: Number(digits) }] : []),
    ]
  }
  return where
}
