/**
 * The real provider cost of one customer turn, as stored on the assistant
 * message (metadata.turnCost, written by TurnLedger): every model call of the
 * turn — understanding, planners, the reply — not what the customer's
 * credit was charged. Admin-only.
 */
import type { TurnCostSummary } from '@/lib/ai/llm/aux'

export const TURN_PURPOSE_LABEL: Record<string, string> = {
  reply: 'پاسخ',
  understand: 'فهم پیام',
  cart_plan: 'برنامهٔ سبد',
  catalog_plan: 'جست‌وجوی کاتالوگ',
  turn_analyzer: 'تحلیل نوبت',
  summary: 'خلاصه‌سازی',
  memory: 'حافظه',
  eval: 'ارزیابی',
  identity: 'شناسایی مشتری',
  link_repair: 'اصلاح لینک',
}

export interface TurnCostRow {
  purpose: string
  model: string
  ok: boolean
  tokensIn: number
  tokensOut: number
  usd: number | null
}

export interface TurnCostView {
  totalUSD: number
  requests: number
  rows: TurnCostRow[]
}

export function readTurnCost(metadata: unknown): TurnCostView | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = (metadata as Record<string, unknown>).turnCost as Partial<TurnCostSummary> | undefined
  if (!raw || typeof raw !== 'object' || typeof raw.totalUSD !== 'number') return null
  const rows: TurnCostRow[] = []
  if (raw.replyModel) {
    rows.push({ purpose: 'reply', model: raw.replyModel, ok: true, tokensIn: raw.replyTokens?.in ?? 0, tokensOut: raw.replyTokens?.out ?? 0, usd: typeof raw.replyUSD === 'number' ? raw.replyUSD : null })
  }
  for (const call of Array.isArray(raw.calls) ? raw.calls : []) {
    rows.push({ purpose: String(call.purpose), model: String(call.model), ok: call.ok !== false, tokensIn: Number(call.in) || 0, tokensOut: Number(call.out) || 0, usd: typeof call.usd === 'number' ? call.usd : null })
  }
  return { totalUSD: raw.totalUSD, requests: rows.length, rows }
}

/** Whole rials at the admin's own USD rate; null when no rate is set. */
export function usdToRial(usd: number, rate: number | null): number | null {
  return rate ? Math.round(usd * rate) : null
}
