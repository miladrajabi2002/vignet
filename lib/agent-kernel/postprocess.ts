import { stripTrailingPersianPeriod } from '@/lib/ai/response-postprocess'
import { hasAgentSkill, type AgentSkillPlan } from '@/lib/agent-kernel/contracts'
import { enforceActionCapabilities, enforceNoFalseFollowUp, livePreviewRisk, safeOrderUrl, stripAgentDiscountOffers, stripFabricatedPaymentLinks } from '@/lib/agent-kernel/skills/action-capabilities'
import { enforceVisualReferenceGrounding } from '@/lib/agent-kernel/skills/visual-reference'
import { enforceConversationContinuity } from '@/lib/agent-kernel/skills/conversation-state'
import { enforceHumanizerPolish } from '@/lib/agent-kernel/skills/humanizer-polish'
import type { ConversationWorkingState } from '@/lib/ai/conversation-state'

export interface AgentSkillPostprocessContext {
  /** Trusted rows selected by the scoped catalog repository for this turn. */
  catalogProducts?: Array<{ id?: string; name: string; url?: string | null }>
  /** Products whose card the customer received in the last replies. */
  establishedProductIds?: string[]
  /** Current customer text is required for deterministic capability guards. */
  userMessage?: string
  isFa?: boolean
  /** Verified channel media on this turn, when the platform payload proves one. */
  inboundMediaKind?: string
  /** True when this turn's context carries a <verified_order> block (real
   *  order-number-scoped store data). Keeps grounded order-status replies
   *  alive while fabricated «سفارش ثبت شد» claims are replaced. */
  hasGroundedOrder?: boolean
  /** The presentation layer will append a trusted product card whose native
   *  CTA opens the same catalog URL. */
  preferStructuredProductLink?: boolean
  /** Structured current-session state used only by conservative continuity guards. */
  conversationState?: ConversationWorkingState | null
  /** Mutable per-turn trace sink owned by the caller. */
  continuityGuardCodes?: string[]
  /** In-chat pre-orders are enabled for this agent. */
  orderCaptureEnabled?: boolean
}

function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa')
}

/** Price, stock or spec claims — the only replies that need a named product. */
const PRODUCT_FACT_RE = /[\d۰-۹]|تومان|تومن|ریال|موجود|قیمت|ابعاد|سایز|جنس|پارچه|price|stock|size|material/iu

function ensureSingleProductIdentity(
  reply: string,
  context: AgentSkillPostprocessContext,
): string {
  if (context.catalogProducts?.length !== 1) return reply
  // The customer is already looking at this product's card: repeating its
  // long catalog name in front of every follow-up reads like a template.
  const productId = context.catalogProducts[0]?.id
  if (productId && context.establishedProductIds?.some((id) => id.split('#')[0] === productId)) return reply
  // «حتماً، با خیال راحت تصمیم بگیرید» carries no product claim; prefixing
  // it with «میز تلویزیون …:» reads like a template engine, not a person.
  if (!PRODUCT_FACT_RE.test(reply)) return reply
  const name = context.catalogProducts[0]?.name.trim()
  // Already named by its distinctive words («میز تلویزیون نقش … ۱۹۰»): a
  // «Full Catalog Name: …» prefix on top of that reads like a template.
  const nameTokens = normalizeIdentity(name ?? '').split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3)
  const replyText = ` ${normalizeIdentity(reply).replace(/[^\p{L}\p{N}]+/gu, ' ')} `
  if (nameTokens.filter((token) => replyText.includes(` ${token} `)).length >= 3) return reply
  if (!name || normalizeIdentity(reply).includes(normalizeIdentity(name))) return reply
  return `${name}: ${reply}`
}

/** First trusted catalog URL of this turn — used by the deterministic
 *  order-request fallback so the customer is routed to the store page
 *  instead of a dead end. */
function orderUrlFromCatalog(context: AgentSkillPostprocessContext): string | null {
  // Never pick an arbitrary URL from a recommendation list. A checkout CTA
  // is safe only when the turn has resolved exactly one product.
  if (context.catalogProducts?.length !== 1) return null
  return safeOrderUrl(context.catalogProducts[0]?.url)
}

export function runAgentSkillPostprocessors(
  reply: string,
  plan: AgentSkillPlan,
  context: AgentSkillPostprocessContext = {},
): string {
  // Unconditional: no skill plan may let the model author a payment link.
  let output = stripFabricatedPaymentLinks(reply, context.isFa ?? true)
  // An agent that sells in chat never grants discounts: the store prices the cart.
  if (context.orderCaptureEnabled) output = stripAgentDiscountOffers(output, context.isFa ?? true)
  if (hasAgentSkill(plan, 'action-capability-boundaries') && context.userMessage) {
    output = enforceActionCapabilities({
      reply: output,
      userMessage: context.userMessage,
      isFa: context.isFa ?? true,
      orderUrl: orderUrlFromCatalog(context),
      hasGroundedOrder: context.hasGroundedOrder ?? false,
      preferStructuredProductLink: context.preferStructuredProductLink ?? false,
      orderCaptureEnabled: context.orderCaptureEnabled ?? false,
    })
    output = enforceNoFalseFollowUp(output, context.isFa ?? true)
  }
  if (hasAgentSkill(plan, 'visual-reference-grounding') && context.userMessage) {
    output = enforceVisualReferenceGrounding({
      reply: output,
      userMessage: context.userMessage,
      inboundMediaKind: context.inboundMediaKind,
      isFa: context.isFa ?? true,
    })
  }
  if (hasAgentSkill(plan, 'conversation-state') && context.conversationState) {
    const guarded = enforceConversationContinuity({
      reply: output,
      state: context.conversationState,
      isFa: context.isFa ?? true,
    })
    output = guarded.reply
    context.continuityGuardCodes?.push(...guarded.codes)
  }
  if (hasAgentSkill(plan, 'product-consultation')) {
    output = ensureSingleProductIdentity(output, context)
  }
  if (hasAgentSkill(plan, 'humanizer-polish')) {
    output = enforceHumanizerPolish({ reply: output, isFa: context.isFa ?? true }).reply
  }
  if (hasAgentSkill(plan, 'persian-response-polish')) {
    output = stripTrailingPersianPeriod(output)
  }
  return output
}

/**
 * Sentence ends: punctuation followed by whitespace, or a line break. Only
 * finished sentences can be checked the way the final guards check them, and
 * the whitespace requirement keeps the dots inside a URL from cutting it.
 */
const SENTENCE_END_RE = /[.!؟?…](?=\s)|\n/gu

function lastSentenceEnd(text: string): number {
  let end = -1
  for (const match of text.matchAll(SENTENCE_END_RE)) end = match.index
  return end
}

/**
 * Filter for live drafts. Takes the visible text written so far and returns
 * what may be shown now: finished sentences only, and never past the point
 * where the final guards would intervene. Once a risk appears the draft stays
 * frozen; the post-processed final reply replaces it.
 */
export function createLivePreviewGuard(
  plan: AgentSkillPlan,
  context: Pick<AgentSkillPostprocessContext, 'userMessage' | 'orderCaptureEnabled' | 'hasGroundedOrder'>,
): (visibleSoFar: string) => string {
  let shown = ''
  let frozen = false
  const actionGuards = hasAgentSkill(plan, 'action-capability-boundaries') && Boolean(context.userMessage)
  return (visibleSoFar) => {
    if (frozen) return shown
    const boundary = lastSentenceEnd(visibleSoFar)
    if (boundary === -1) return shown
    const candidate = visibleSoFar.slice(0, boundary + 1).trimEnd()
    if (candidate.length <= shown.length) return shown
    const risk = livePreviewRisk({
      text: candidate,
      userMessage: context.userMessage ?? '',
      actionGuards,
      orderCaptureEnabled: context.orderCaptureEnabled ?? false,
      hasGroundedOrder: context.hasGroundedOrder ?? false,
    })
    if (risk) {
      frozen = true
      if (risk === 'withhold') shown = ''
      return shown
    }
    shown = candidate
    return shown
  }
}
