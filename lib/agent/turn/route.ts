/**
 * Decide: turn a verified understanding into concrete per-domain decisions
 * for the deterministic executors that already exist (catalog search and
 * presentation, the order state machine, restock alerts, order tracking,
 * booking/course tool loops, handoff policy, conversation state).
 *
 * Pure function: no I/O, fully unit-tested. The engine applies each domain
 * only when that domain routes from understanding (mode.ts); otherwise the
 * legacy decision for that domain stands.
 */
import { extractProductTerms, type ProductRequestPlan } from '@/lib/ai/conversation'
import type { ConversationIntent, ConversationTurnRelation, ConversationWorkingState, UnderstoodTurnState } from '@/lib/ai/conversation-state'
import type { CatalogToolReason } from '@/lib/ai/catalog-tools'
import type { CartEditCue, CartEditOp } from '@/lib/commerce/cart-edit'
import { emptyOrderSignals, type OrderStartItem, type OrderTurnSignals } from '@/lib/commerce/order-signals'
import { describeResolvedDateTime, resolvePersianDateTime } from '@/lib/agent/parsers/persian-datetime'
import type {
  Act,
  ActType,
  Capability,
  ResolvedRef,
  TurnCandidates,
  VerifiedUnderstanding,
} from '@/lib/agent/understand/types'

export const MAX_SHOWCASE = 10

export interface BriefItem {
  act: ActType
  /** Short description of what the customer asked, in the reply language. */
  ask: string
}

export interface UnderstoodRoute {
  /** Product plan for the existing catalog/presentation machinery; null = no product work. */
  productPlan: ProductRequestPlan | null
  /** Exact catalog rows to load by id (references to cards / active / seen / cart). */
  productIds: string[]
  /** Rows loaded by id are the identified item(s) of this turn. */
  productsIdentified: boolean
  /** Budget / sort / superlative searches run server-side (no planner call). */
  catalogSearch: {
    calls: Array<Record<string, unknown>>
    budget: { maxPrice: number | null; minPrice: number | null }
    sort: 'price_asc' | 'price_desc' | 'popular' | null
    reason: CatalogToolReason
  } | null
  /** The item cheaper alternatives are measured against. */
  cheaperReferenceId: string | null
  orderSignals: OrderTurnSignals
  /** The turn means something for the order flow. */
  orderTouch: boolean
  restock: { request: 'explicit' | 'accept'; targetId: string | null } | null
  booking: { action: string; hint: string } | null
  course: { action: string; hint: string } | null
  orderTracking: { orderRef: string | null } | null
  handoff: { human: boolean; complaintHigh: boolean }
  /** Thanks / goodbye / «I'll think about it» with nothing else to do. */
  closing: 'thanks' | 'goodbye' | 'defer' | null
  resetTopic: boolean
  /** The model could not resolve a reference; ask instead of guessing. */
  clarify: VerifiedUnderstanding['clarify'] | null
  stateTurn: UnderstoodTurnState
  brief: BriefItem[]
  unavailable: Capability[]
  /** Acts that touch more than one domain (multi-intent message). */
  multiIntent: boolean
}

const parentOf = (id: string) => id.split('#')[0]

function variationIdOf(id: string): number | null {
  const suffix = id.split('#')[1]
  const match = suffix ? /^v?(\d+)$/i.exec(suffix) : null
  return match ? Number(match[1]) : null
}

export function emptyProductPlan(): ProductRequestPlan {
  return {
    isProductTurn: false,
    explicitShowcase: false,
    discoveryBrowse: false,
    resetProductContext: false,
    requestNewTopic: false,
    requestedCount: 5,
    searchTerms: [],
    subjectSwitchTerms: [],
    inventoryMode: 'ANY',
    includeProductCards: true,
    detailField: null,
    codeIdentified: false,
    variantBrowse: false,
    variantHint: null,
    variantTargetRefs: [],
    variantPick: false,
    codeVariantVitrine: false,
  }
}

const RELATION_MAP: Record<VerifiedUnderstanding['relation'], ConversationTurnRelation> = {
  new_goal: 'NEW_GOAL',
  refinement: 'REFINEMENT',
  answer: 'ANSWER',
  reference: 'REFERENCE',
  correction: 'CORRECTION',
  side_question: 'SIDE_QUESTION',
  reset: 'RESET',
  greeting: 'GREETING',
  closing: 'CLOSING',
  other: 'OTHER',
}

const PRODUCT_ACTS: ReadonlySet<ActType> = new Set(['product_search', 'product_question', 'variants', 'compare', 'cheaper_alternative'])
const ORDER_ACTS: ReadonlySet<ActType> = new Set(['order_start', 'cart_edit', 'order_details', 'order_confirm', 'order_decline', 'order_cancel', 'payment_claim', 'payment_link_request', 'shipping_change'])
const QUESTION_ACTS: ReadonlySet<ActType> = new Set(['product_question', 'variants', 'compare', 'cheaper_alternative', 'policy_question', 'knowledge_question', 'order_status', 'product_search'])
const CLOSING_ACTS: ReadonlySet<ActType> = new Set(['thanks', 'goodbye', 'defer'])

function intentFor(acts: Act[]): ConversationIntent {
  const first = acts.find((act) => !CLOSING_ACTS.has(act.type) && act.type !== 'greeting' && act.type !== 'smalltalk') ?? acts[0]
  if (!first) return 'GENERAL'
  if (PRODUCT_ACTS.has(first.type) || first.type === 'restock_subscribe') return 'PRODUCT'
  if (ORDER_ACTS.has(first.type) || first.type === 'order_status') return 'ORDER'
  if (first.type === 'booking') return 'BOOKING'
  if (first.type === 'course') return 'SERVICE'
  if (first.type === 'policy_question') return 'BUSINESS_INFO'
  if (first.type === 'complaint' || first.type === 'human_request') return 'SUPPORT'
  return 'GENERAL'
}

function productTarget(ref: string | undefined, refs: Record<string, ResolvedRef>): { id: string; name: string } | null {
  if (!ref) return null
  const hit = refs[ref === 'entity' ? 'active' : ref]
  if (!hit) return null
  if (hit.kind === 'product') return { id: hit.id, name: hit.name }
  if (hit.kind === 'cart') return { id: hit.productId, name: hit.name }
  return null
}

function familyTerms(name: string): string[] {
  return extractProductTerms(name).filter((term) => !/^\d+$/.test(term)).slice(0, 2)
}

function domainsOf(acts: Act[]): Set<string> {
  return new Set(acts.flatMap((act) => {
    if (PRODUCT_ACTS.has(act.type)) return ['product']
    if (ORDER_ACTS.has(act.type)) return ['order']
    if (act.type === 'policy_question' || act.type === 'knowledge_question') return ['knowledge']
    if (CLOSING_ACTS.has(act.type) || act.type === 'greeting' || act.type === 'smalltalk' || act.type === 'other') return []
    return [act.type]
  }))
}

export interface RouteInput {
  verified: VerifiedUnderstanding
  candidates: TurnCandidates
  message: string
  state: ConversationWorkingState
  corpusTokens?: ReadonlySet<string> | null
  lang: 'fa' | 'en' | 'ar'
  /** Clock for relative booking dates («پس‌فردا»); defaults to now. */
  now?: Date
}

export function routeFromUnderstanding(input: RouteInput): UnderstoodRoute {
  const { verified, candidates } = input
  const acts = verified.acts
  const refs = verified.refs
  const fa = input.lang !== 'en'
  const brief: BriefItem[] = []
  const signals = emptyOrderSignals('understanding')
  let productPlan: ProductRequestPlan | null = null
  let productIds: string[] = []
  let productsIdentified = false
  let catalogSearch: UnderstoodRoute['catalogSearch'] = null
  let cheaperReferenceId: string | null = null
  let restock: UnderstoodRoute['restock'] = null
  let booking: UnderstoodRoute['booking'] = null
  let course: UnderstoodRoute['course'] = null
  let orderTracking: UnderstoodRoute['orderTracking'] = null
  const handoff = { human: false, complaintHigh: false }
  const slots: Record<string, string> = {}
  const searchTerms: string[] = []
  const pendingKind = verified.answersPending ? candidates.pending?.kind ?? null : null

  const plan = () => (productPlan ??= { ...emptyProductPlan(), isProductTurn: true })

  for (const act of acts) {
    switch (act.type) {
      case 'product_search': {
        const attributeValues = Object.values(act.attributes ?? {}).filter(Boolean) as string[]
        const terms = extractProductTerms([...act.terms, ...attributeValues, act.code ?? ''].join(' '))
        const identity = extractProductTerms([...act.terms, act.code ?? ''].join(' '))
        const p = plan()
        p.searchTerms = [...new Set([...p.searchTerms, ...terms])].slice(0, 6)
        p.explicitShowcase = act.display === 'showcase'
        p.discoveryBrowse = act.display === 'browse' && terms.length === 0
        p.requestedCount = act.count ?? (act.display === 'showcase' ? MAX_SHOWCASE : act.display === 'browse' ? 6 : 5)
        p.inventoryMode = act.display === 'showcase' ? 'AVAILABLE' : 'ANY'
        p.codeIdentified = Boolean(act.code)
        p.variantHint = act.attributes?.design ?? act.attributes?.color ?? null
        p.codeVariantVitrine = Boolean(act.code) && !p.variantHint
        p.corpusSubjectTerms = input.corpusTokens ? p.searchTerms.filter((term) => input.corpusTokens!.has(term)) : []
        if (verified.relation === 'new_goal') {
          p.subjectSwitchTerms = identity.filter((term) => !/^\d+$/.test(term))
          p.resetProductContext = Boolean(input.state.activeGoal && input.state.activeGoal.intent === 'PRODUCT')
        }
        searchTerms.push(...terms)
        for (const [key, value] of Object.entries(act.attributes ?? {})) if (value) slots[key] = value
        if (act.maxPrice != null || act.minPrice != null || act.sort) {
          if (act.maxPrice != null) slots.budget = String(act.maxPrice)
          catalogSearch = {
            calls: [{
              query: [...act.terms, ...attributeValues].join(' '),
              ...(act.maxPrice != null ? { max_price: act.maxPrice } : {}),
              ...(act.minPrice != null ? { min_price: act.minPrice } : {}),
              ...(act.sort ? { sort: act.sort } : {}),
              in_stock_only: true,
              limit: Math.min(MAX_SHOWCASE, act.count ?? 6),
            }],
            budget: { maxPrice: act.maxPrice ?? null, minPrice: act.minPrice ?? null },
            sort: act.sort ?? null,
            reason: act.maxPrice != null || act.minPrice != null ? 'PRICE_CONSTRAINT' : 'SUPERLATIVE',
          }
        }
        brief.push({ act: act.type, ask: fa
          ? `دنبال محصول${terms.length ? `: ${terms.join(' ')}` : ''}${act.maxPrice ? ` (بودجه تا ${act.maxPrice.toLocaleString('fa-IR')} تومان)` : ''}`
          : `Looking for products${terms.length ? `: ${terms.join(' ')}` : ''}` })
        break
      }
      case 'product_question': {
        const target = productTarget(act.target, refs)
        if (!target) break
        const p = plan()
        productIds = [...new Set([...productIds, target.id])]
        productsIdentified = true
        p.includeProductCards = act.field === 'link' || act.field === 'photo'
        p.detailField = act.field === 'material' && productIds.length === 1 ? 'MATERIAL' : null
        p.requestedCount = Math.max(1, productIds.length)
        p.searchTerms = p.searchTerms.length ? p.searchTerms : extractProductTerms(target.name).slice(0, 6)
        brief.push({ act: act.type, ask: fa ? `${FIELD_FA[act.field]} «${target.name}»` : `${act.field} of “${target.name}”` })
        break
      }
      case 'variants': {
        const target = productTarget(act.target, refs)
        if (!target) break
        const p = plan()
        productIds = [...new Set([...productIds, target.id])]
        productsIdentified = true
        p.variantTargetRefs = [target.id]
        p.searchTerms = p.searchTerms.length ? p.searchTerms : extractProductTerms(target.name).slice(0, 6)
        if (act.variant) {
          p.variantPick = true
          p.variantHint = act.variant
          slots.variant = act.variant
        } else {
          p.variantBrowse = true
          p.inventoryMode = 'AVAILABLE'
          p.requestedCount = MAX_SHOWCASE
        }
        brief.push({ act: act.type, ask: fa ? `${act.variant ? `تنوع «${act.variant}» از` : 'تنوع‌های'} «${target.name}»` : `variants of “${target.name}”` })
        break
      }
      case 'compare': {
        const targets = act.targets.map((ref) => productTarget(ref, refs)).filter((item): item is { id: string; name: string } => item !== null)
        if (targets.length < 2) break
        const p = plan()
        productIds = [...new Set([...productIds, ...targets.map((item) => item.id)])]
        p.comparisonConsult = true
        p.requestedCount = Math.min(4, productIds.length)
        p.includeProductCards = false
        p.searchTerms = p.searchTerms.length ? p.searchTerms : familyTerms(targets[0].name)
        brief.push({ act: act.type, ask: fa
          ? `مقایسهٔ ${targets.map((item) => `«${item.name}»`).join(' و ')}${act.criterion ? ` از نظر ${act.criterion}` : ''}`
          : `compare ${targets.map((item) => `“${item.name}”`).join(' and ')}` })
        break
      }
      case 'cheaper_alternative': {
        const target = productTarget(act.target, refs)
        if (!target) break
        const p = plan()
        p.cheaperAlternative = true
        p.explicitShowcase = false
        p.requestedCount = MAX_SHOWCASE
        p.searchTerms = familyTerms(target.name)
        cheaperReferenceId = target.id
        brief.push({ act: act.type, ask: fa ? `گزینهٔ ارزان‌تر از «${target.name}»` : `cheaper than “${target.name}”` })
        break
      }
      case 'order_start': {
        signals.orderIntent = true
        const items: OrderStartItem[] = act.items.flatMap((item) => {
          const target = productTarget(item.target, refs)
          return target ? [{ productId: parentOf(target.id), variationId: variationIdOf(target.id), variant: item.variant ?? null, quantity: item.quantity ?? null }] : []
        })
        signals.startItems = items
        brief.push({ act: act.type, ask: fa ? 'می‌خواهد سفارش بدهد' : 'wants to order' })
        break
      }
      case 'cart_edit': {
        const ops: CartEditOp[] = []
        for (const op of act.ops) {
          if (op.op === 'add') {
            const target = productTarget(op.target, refs)
            if (target) ops.push({ op: 'add', productId: parentOf(target.id), variationId: variationIdOf(target.id), variant: op.variant ?? null, quantity: op.quantity ?? 1 })
            continue
          }
          const hit = refs[op.line]
          if (hit?.kind !== 'cart') continue
          if (op.op === 'remove') ops.push({ op: 'remove', line: hit.line })
          else if (op.op === 'set_quantity') ops.push({ op: 'set_quantity', line: hit.line, quantity: op.quantity })
          else ops.push({ op: 'set_variant', line: hit.line, variant: op.variant })
        }
        if (ops.length) {
          signals.cartOps = [...(signals.cartOps ?? []), ...ops]
          const cue: CartEditCue = ops.some((op) => op.op === 'remove') ? 'remove' : ops.some((op) => op.op === 'add') ? 'add' : 'change'
          signals.cartCue = cue
          brief.push({ act: act.type, ask: fa ? 'تغییر سبد خرید' : 'cart change' })
        }
        break
      }
      case 'order_details': {
        signals.slots = {
          ...(signals.slots ?? {}),
          ...(act.name ? { name: act.name } : {}),
          ...(act.phone ? { phone: act.phone } : {}),
          ...(act.city ? { city: act.city } : {}),
          ...(act.address ? { address: act.address } : {}),
          ...(act.postalCode ? { postalCode: act.postalCode } : {}),
        }
        if (act.coupon) signals.coupon = act.coupon
        if (act.shipping) signals.shippingText = act.shipping
        if (act.city) slots.location = act.city
        break
      }
      case 'order_confirm':
        signals.confirm = true
        if (pendingKind === 'order_offer') signals.orderIntent = true
        break
      case 'order_decline':
        signals.decline = true
        break
      case 'order_cancel':
        signals.cancel = true
        break
      case 'payment_claim':
        signals.paymentClaim = true
        break
      case 'payment_link_request':
        signals.linkRequest = true
        break
      case 'shipping_change':
        signals.shippingChange = true
        break
      case 'order_status':
        orderTracking = { orderRef: act.orderRef ?? null }
        brief.push({ act: act.type, ask: fa ? `پیگیری سفارش${act.orderRef ? ` ${act.orderRef}` : ''}` : 'order tracking' })
        break
      case 'restock_subscribe': {
        const target = productTarget(act.target, refs)
        restock = { request: pendingKind === 'restock_offer' ? 'accept' : 'explicit', targetId: target?.id ?? null }
        brief.push({ act: act.type, ask: fa ? 'اطلاع از موجود شدن' : 'back-in-stock alert' })
        break
      }
      case 'booking': {
        const service = act.service ? refs[act.service] : undefined
        // «پس‌فردا عصر» → a real calendar day and time window, resolved
        // deterministically (the model wrote the day in normalized form; the
        // customer's own message is the fallback).
        const said = [act.date, act.time].filter(Boolean).join(' ')
        const fromAct = said ? resolvePersianDateTime(said, { now: input.now }) : null
        const resolved = fromAct && (fromAct.dateKey || fromAct.minute != null || fromAct.window)
          ? fromAct
          : resolvePersianDateTime(input.message, { now: input.now })
        const when = describeResolvedDateTime(resolved, fa)
        const parts = [service?.name, when || said].filter(Boolean) as string[]
        booking = { action: act.action, hint: parts.join(' — ') }
        if (resolved.dateKey) slots.date = resolved.dateKey
        else if (act.date) slots.date = act.date
        if (resolved.minute != null) slots.time = `${String(Math.floor(resolved.minute / 60)).padStart(2, '0')}:${String(resolved.minute % 60).padStart(2, '0')}`
        else if (resolved.window) slots.time = resolved.window.label
        else if (act.time) slots.time = act.time
        brief.push({ act: act.type, ask: fa ? `نوبت (${act.action})${parts.length ? `: ${parts.join('، ')}` : ''}` : `booking (${act.action})` })
        break
      }
      case 'course': {
        const target = act.course ? refs[act.course] : undefined
        course = { action: act.action, hint: target?.name ?? '' }
        brief.push({ act: act.type, ask: fa ? `دوره (${act.action})${target ? `: ${target.name}` : ''}` : `course (${act.action})` })
        break
      }
      case 'policy_question':
        brief.push({ act: act.type, ask: fa ? `${TOPIC_FA[act.topic]}${act.detail ? ` (${act.detail})` : ''}` : `${act.topic}${act.detail ? ` (${act.detail})` : ''}` })
        break
      case 'knowledge_question':
        brief.push({ act: act.type, ask: act.query || (fa ? 'سؤال دربارهٔ کسب‌وکار' : 'business question') })
        break
      case 'complaint':
        if (act.severity === 'high') handoff.complaintHigh = true
        brief.push({ act: act.type, ask: fa ? 'شکایت/نارضایتی' : 'complaint' })
        break
      case 'human_request':
        handoff.human = true
        break
      default:
        break
    }
  }

  signals.question = acts.some((act) => QUESTION_ACTS.has(act.type))
  const orderTouch = acts.some((act) => ORDER_ACTS.has(act.type))
  const nonClosing = acts.filter((act) => !CLOSING_ACTS.has(act.type) && act.type !== 'smalltalk' && act.type !== 'greeting' && act.type !== 'other')
  const closing = nonClosing.length === 0 && acts.some((act) => CLOSING_ACTS.has(act.type)) && !verified.answersPending
    ? acts.some((act) => act.type === 'defer') ? 'defer' : acts.some((act) => act.type === 'goodbye') ? 'goodbye' : 'thanks'
    : null
  const resetTopic = acts.some((act) => act.type === 'reset_topic')
  if (resetTopic && !productPlan && nonClosing.every((act) => act.type === 'reset_topic')) {
    productPlan = { ...emptyProductPlan(), requestNewTopic: true, resetProductContext: true }
  }

  return {
    productPlan,
    productIds,
    productsIdentified,
    catalogSearch,
    cheaperReferenceId,
    orderSignals: signals,
    orderTouch,
    restock,
    booking,
    course,
    orderTracking,
    handoff,
    closing,
    resetTopic,
    clarify: verified.clarify ?? null,
    stateTurn: {
      relation: RELATION_MAP[verified.relation],
      intent: intentFor(acts),
      searchTerms: [...new Set(searchTerms)].slice(0, 10),
      slots,
      goalLabel: input.message,
    },
    brief,
    unavailable: verified.unavailable,
    multiIntent: domainsOf(acts).size > 1,
  }
}

const FIELD_FA: Record<string, string> = {
  price: 'قیمت',
  stock: 'موجودی',
  material: 'جنس',
  size: 'سایز',
  dimensions: 'ابعاد',
  colors: 'رنگ‌ها',
  link: 'لینک خرید',
  photo: 'عکس',
  details: 'جزئیات',
}

const TOPIC_FA: Record<string, string> = {
  shipping_cost: 'هزینهٔ ارسال',
  delivery_time: 'زمان ارسال/تحویل',
  shipping_method: 'روش ارسال',
  payment: 'روش پرداخت',
  installment: 'خرید اقساطی',
  warranty: 'گارانتی',
  return: 'مرجوعی',
  hours: 'ساعت کاری',
  address: 'آدرس',
  contact: 'راه تماس',
  other: 'سؤال سیاستی',
}
