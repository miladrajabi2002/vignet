/**
 * The legacy regex router's decision for a message, expressed in the same
 * act vocabulary as the understanding layer. Used for:
 *   • shadow mode — agreement between the two readings, per turn;
 *   • the evaluation baseline — the same yardstick for both systems.
 * Pure (no DB): it calls only the regex planners the engine already runs.
 */
import type { ChatMessage } from '@/lib/ai/openrouter'
import { planProductRequest, type ProductRequestPlan } from '@/lib/ai/conversation'
import { closingReplyText } from '@/lib/ai/response-policy'
import { legacyOrderSignals } from '@/lib/commerce/order-signals'
import { detectRestockRequest } from '@/lib/commerce/restock'
import { hasBookingIntent } from '@/lib/bookings/intent'
import { hasCourseIntent } from '@/lib/courses/intent'
import { detectsOrderTracking } from '@/lib/ai/order-context'
import type { ActType, TurnUnderstanding, VerifiedUnderstanding } from '@/lib/agent/understand/types'

export interface LegacyReading {
  acts: ActType[]
  /** The product plan's key flags, for diffing product routing. */
  product: { isProductTurn: boolean; explicitShowcase: boolean; searchTerms: string[] } | null
}

export interface LegacyReadingInput {
  message: string
  history: ChatMessage[]
  /** Already computed by the engine; recomputed when omitted. */
  plan?: ProductRequestPlan
  corpusTokens?: ReadonlySet<string>
  hasDraft: boolean
  capabilities: { orderCapture: boolean; bookings: boolean; courses: boolean; restock: boolean; tracking: boolean }
}

export function legacyReading(input: LegacyReadingInput): LegacyReading {
  const plan = input.plan ?? planProductRequest(input.message, input.history, input.corpusTokens)
  const lastAssistant = [...input.history].reverse().find((item) => item.role === 'assistant')?.content ?? null
  const acts: ActType[] = []
  const closing = closingReplyText(input.message, input.history, 'fa')
  if (closing) {
    const deferred = ['تصمیم', 'take your time'].some((word) => closing.includes(word))
    const farewell = ['خدانگهدار', 'Goodbye'].some((word) => closing.includes(word))
    acts.push(deferred ? 'defer' : farewell ? 'goodbye' : 'thanks')
    return { acts, product: null }
  }
  if (plan.requestNewTopic) acts.push('reset_topic')
  if (plan.isProductTurn) {
    if (plan.variantBrowse || plan.variantPick) acts.push('variants')
    else if (plan.comparisonConsult) acts.push('compare')
    else if (plan.cheaperAlternative) acts.push('cheaper_alternative')
    else if (!plan.includeProductCards || plan.detailField) acts.push('product_question')
    else acts.push('product_search')
  }
  if (input.capabilities.orderCapture) {
    const signals = legacyOrderSignals(input.message, lastAssistant)
    if (signals.orderIntent && !input.hasDraft) acts.push('order_start')
    if (input.hasDraft) {
      if (signals.cartCue) acts.push('cart_edit')
      else if (signals.cancel) acts.push('order_cancel')
      else if (signals.confirm) acts.push('order_confirm')
      else if (signals.decline) acts.push('order_decline')
    }
  }
  if (input.capabilities.restock && detectRestockRequest(input.message, lastAssistant)) acts.push('restock_subscribe')
  const window: ChatMessage[] = [...input.history, { role: 'user', content: input.message }]
  if (input.capabilities.bookings && hasBookingIntent(window)) acts.push('booking')
  if (input.capabilities.courses && hasCourseIntent(window)) acts.push('course')
  if (input.capabilities.tracking && detectsOrderTracking(input.message) && !acts.includes('order_start')) acts.push('order_status')
  if (!acts.length) acts.push('other')
  return {
    acts: [...new Set(acts)],
    product: plan.isProductTurn ? { isProductTurn: true, explicitShowcase: plan.explicitShowcase, searchTerms: plan.searchTerms } : null,
  }
}

/** Domain bucket of an act, for agreement and diffs. */
export function actDomain(act: ActType): string {
  if (['product_search', 'product_question', 'variants', 'compare', 'cheaper_alternative'].includes(act)) return 'product'
  if (['order_start', 'cart_edit', 'order_details', 'order_confirm', 'order_decline', 'order_cancel', 'payment_claim', 'payment_link_request', 'shipping_change'].includes(act)) return 'order'
  if (['thanks', 'goodbye', 'defer'].includes(act)) return 'closing'
  if (['policy_question', 'knowledge_question', 'other', 'smalltalk', 'greeting'].includes(act)) return 'general'
  return act
}

/** Where the two readings route differently (e.g. «booking≠general»). */
export function readingDiff(model: Pick<TurnUnderstanding, 'acts'> | VerifiedUnderstanding, legacy: LegacyReading): { diffKinds: string[]; agreed: boolean } {
  const modelDomains = new Set(model.acts.map((act) => actDomain(act.type)))
  const legacyDomains = new Set(legacy.acts.map(actDomain))
  const diffKinds: string[] = []
  for (const domain of modelDomains) if (!legacyDomains.has(domain)) diffKinds.push(`+${domain}`)
  for (const domain of legacyDomains) if (!modelDomains.has(domain)) diffKinds.push(`-${domain}`)
  return { diffKinds, agreed: diffKinds.length === 0 }
}
