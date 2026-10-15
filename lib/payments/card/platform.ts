/**
 * Platform-wide gateway settings (PaymentGatewaySettings, edited in
 * /admin/payment-gateway): the global switch, the monthly cap of confirmed
 * payments per plan, the SMS lines owners forward to and the largest amount
 * offered by card-to-card.
 */
import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type PlanMonthlyCaps = Record<Plan, number | null>

/** Confirmed payments per calendar month; null = unlimited. */
export const DEFAULT_PLAN_MONTHLY_CAPS: PlanMonthlyCaps = {
  TRIAL: 30,
  STARTER: 300,
  PRO: 1500,
  BUSINESS: null,
}

export interface PlatformGatewaySettings {
  enabled: boolean
  planMonthlyCaps: PlanMonthlyCaps
  inboundLines: string[]
  inboundSecret: string | null
  /** Whole tomans. */
  maxAmount: number
}

export const DEFAULT_MAX_AMOUNT = 10_000_000

export function readPlanMonthlyCaps(value: unknown): PlanMonthlyCaps {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const caps = { ...DEFAULT_PLAN_MONTHLY_CAPS }
  for (const plan of Object.keys(caps) as Plan[]) {
    const raw = row[plan]
    if (raw === null) caps[plan] = null
    else if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) caps[plan] = Math.round(raw)
  }
  return caps
}

let cached: { at: number; value: PlatformGatewaySettings } | null = null
const CACHE_MS = 30_000

export async function getPlatformGatewaySettings(fresh = false): Promise<PlatformGatewaySettings> {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value
  const row = await prisma.paymentGatewaySettings.findUnique({ where: { id: 'primary' } })
  const value: PlatformGatewaySettings = {
    enabled: row?.enabled ?? true,
    planMonthlyCaps: readPlanMonthlyCaps(row?.planMonthlyCaps),
    inboundLines: row?.inboundLines ?? [],
    inboundSecret: row?.inboundSecret ?? null,
    maxAmount: row?.maxAmount && row.maxAmount > 0 ? row.maxAmount : DEFAULT_MAX_AMOUNT,
  }
  cached = { at: Date.now(), value }
  return value
}

export function clearPlatformGatewayCache(): void {
  cached = null
}

/** First instant of the current calendar month (UTC is close enough for a monthly cap). */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export interface GatewayUsage {
  used: number
  /** null = unlimited */
  cap: number | null
  reached: boolean
}

export async function getGatewayUsage(workspaceId: string, plan: Plan): Promise<GatewayUsage> {
  const [settings, used] = await Promise.all([
    getPlatformGatewaySettings(),
    prisma.cardPayment.count({ where: { workspaceId, status: 'PAID', paidAt: { gte: monthStart() } } }),
  ])
  const cap = settings.planMonthlyCaps[plan]
  return { used, cap, reached: cap != null && used >= cap }
}
