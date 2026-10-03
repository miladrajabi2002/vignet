/**
 * «درصد مشتری بودن» for one contact: how likely this person is to buy, read
 * across ALL their conversations and the real outcomes of those chats.
 *
 *   • a paid cart, a booked appointment or a course place = a customer (100);
 *   • a filed pre-order / unpaid payment link = 92+, an active cart = 85+;
 *   • otherwise the strongest recent conversation reading, faded with age
 *     (a hot lead from three months ago is no longer hot).
 * Conversations whose reading is still UNCLEAR contribute nothing, so a
 * contact with no evidence shows no percentage instead of a made-up one.
 */
import type { SalesIntentStage, SalesLeadType } from '@prisma/client'

export interface ContactInsightInput {
  buyerProbability: number
  leadType: SalesLeadType
  stage: SalesIntentStage
  analyzedAt: Date
}

export interface ContactOutcomeInput {
  paidOrders: number
  filedOrders: number
  openCheckouts: number
  activeCarts: number
  bookings: number
  enrollments: number
}

export type BuyerLevel = 'customer' | 'hot' | 'warm' | 'exploring' | 'cold'

export interface ContactBuyerScore {
  score: number | null
  level: BuyerLevel | null
  /** The strongest evidence behind the score. */
  reason: 'paid_order' | 'booking' | 'enrollment' | 'filed_order' | 'checkout' | 'cart' | 'conversation' | null
}

export const EMPTY_OUTCOMES: ContactOutcomeInput = {
  paidOrders: 0, filedOrders: 0, openCheckouts: 0, activeCarts: 0, bookings: 0, enrollments: 0,
}

const DAY_MS = 86_400_000

/** 1.0 for two weeks, fading to 0.5 at 120 days. */
export function recencyFactor(analyzedAt: Date, now: Date): number {
  const days = Math.max(0, (now.getTime() - analyzedAt.getTime()) / DAY_MS)
  if (days <= 14) return 1
  if (days >= 120) return 0.5
  return 1 - ((days - 14) / (120 - 14)) * 0.5
}

export function levelFor(score: number): BuyerLevel {
  if (score >= 100) return 'customer'
  if (score >= 70) return 'hot'
  if (score >= 50) return 'warm'
  if (score >= 25) return 'exploring'
  return 'cold'
}

export function contactBuyerScore(
  insights: ContactInsightInput[],
  outcomes: ContactOutcomeInput = EMPTY_OUTCOMES,
  now: Date = new Date(),
): ContactBuyerScore {
  if (outcomes.paidOrders > 0) return { score: 100, level: 'customer', reason: 'paid_order' }
  if (outcomes.bookings > 0) return { score: 100, level: 'customer', reason: 'booking' }
  if (outcomes.enrollments > 0) return { score: 100, level: 'customer', reason: 'enrollment' }
  const known = insights.filter((insight) => insight.leadType !== 'UNCLEAR')
  const existingCustomer = known.some((insight) => insight.leadType === 'EXISTING_CUSTOMER' || insight.stage === 'POST_PURCHASE')
  let score: number | null = existingCustomer ? 100 : null
  let reason: ContactBuyerScore['reason'] = existingCustomer ? 'conversation' : null
  if (score == null && known.length) {
    score = Math.round(Math.max(...known.map((insight) => insight.buyerProbability * recencyFactor(insight.analyzedAt, now))))
    reason = 'conversation'
  }
  if (score !== 100) {
    if (outcomes.filedOrders > 0 || outcomes.openCheckouts > 0) {
      score = Math.max(score ?? 0, 92)
      reason = outcomes.filedOrders > 0 ? 'filed_order' : 'checkout'
    } else if (outcomes.activeCarts > 0) {
      score = Math.max(score ?? 0, 85)
      reason = 'cart'
    }
  }
  if (score == null) return { score: null, level: null, reason: null }
  const clamped = Math.min(100, Math.max(0, score))
  return { score: clamped, level: levelFor(clamped), reason }
}

const PAID = ['PAID', 'CONFIRMED', 'ON_HOLD']
const FILED = ['SUBMITTED']
const OPEN = ['LINK_SENT', 'PAYMENT_PENDING', 'PAYMENT_FAILED']
const ACTIVE = ['COLLECTING', 'AWAITING_CONFIRM']

/** Fold order-draft rows into per-contact outcome counts. */
export function outcomesFromDrafts(rows: Array<{ contactId: string | null; status: string }>): Map<string, ContactOutcomeInput> {
  const out = new Map<string, ContactOutcomeInput>()
  for (const row of rows) {
    if (!row.contactId) continue
    const entry = out.get(row.contactId) ?? { ...EMPTY_OUTCOMES }
    if (PAID.includes(row.status)) entry.paidOrders += 1
    else if (FILED.includes(row.status)) entry.filedOrders += 1
    else if (OPEN.includes(row.status)) entry.openCheckouts += 1
    else if (ACTIVE.includes(row.status)) entry.activeCarts += 1
    out.set(row.contactId, entry)
  }
  return out
}
