/**
 * A tolerant parser for the understanding model's reading.
 *
 * The model writes the reading as one plain JSON object (the shapes are in
 * the prompt). It used to be a forced tool call with a flat JSON schema; the
 * evaluation on the live model showed that format depends on the provider
 * that happens to serve the request: one fills the fields in alphabetical
 * order and loses everything before «type», another writes search words into
 * `query` and cart edits into `action`, a third does not offer tools at all.
 * Plain JSON read 81–87% of the commerce cases right on five providers out of
 * six, in a third of the time (evals/results).
 *
 * parseUnderstanding() keeps, per act type, only the fields that type allows
 * and drops anything malformed. Unknown act types are dropped, never guessed;
 * the recoveries it makes (search words in `query`, one cart op written flat,
 * «act» for «type») lose nothing and are verified like any other reading.
 */
import { TURN_CUES, type TurnBuyLevel, type TurnCue, type TurnMood } from '@/lib/ai/turn-signal'
import {
  UNDERSTANDING_VERSION,
  type Act,
  type ActType,
  type CartOpInput,
  type PolicyTopic,
  type ProductAttributes,
  type ProductField,
  type Relation,
  type TurnUnderstanding,
} from '@/lib/agent/understand/types'

export const ACT_TYPES: readonly ActType[] = [
  'greeting', 'thanks', 'goodbye', 'defer', 'smalltalk', 'reset_topic',
  'product_search', 'product_question', 'variants', 'compare', 'cheaper_alternative',
  'order_start', 'cart_edit', 'order_details', 'order_confirm', 'order_decline', 'order_cancel',
  'payment_claim', 'payment_link_request', 'shipping_change', 'order_status', 'restock_subscribe',
  'booking', 'course', 'policy_question', 'knowledge_question', 'complaint', 'human_request', 'other',
]

const RELATIONS: readonly Relation[] = ['new_goal', 'refinement', 'answer', 'reference', 'correction', 'side_question', 'reset', 'greeting', 'closing', 'other']
const FIELDS: readonly ProductField[] = ['price', 'stock', 'material', 'size', 'dimensions', 'colors', 'link', 'photo', 'details']
const TOPICS: readonly PolicyTopic[] = ['shipping_cost', 'delivery_time', 'shipping_method', 'payment', 'installment', 'warranty', 'return', 'hours', 'address', 'contact', 'other']
const MOODS: readonly TurnMood[] = ['pos', 'neu', 'neg', 'ang']

// ─── Tolerant parsing ────────────────────────────────────────────────────────

type Rec = Record<string, unknown>

function rec(value: unknown): Rec | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : null
}

function str(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text && text.length <= max ? text : undefined
}

function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[,\u060C\u066C\s]/g, '')) : NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

function int(value: unknown, min: number, max: number): number | undefined {
  const parsed = num(value)
  if (parsed == null) return undefined
  const rounded = Math.round(parsed)
  return rounded >= min && rounded <= max ? rounded : undefined
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : undefined
}

function strings(value: unknown, maxItems: number, maxLen = 60): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => str(item, maxLen)).filter((item): item is string => Boolean(item)))].slice(0, maxItems)
}

function attributes(value: unknown): ProductAttributes | undefined {
  const raw = rec(value)
  if (!raw) return undefined
  const out: ProductAttributes = {}
  for (const key of ['color', 'size', 'material', 'style', 'design'] as const) {
    const item = str(raw[key], 40)
    if (item) out[key] = item
  }
  return Object.keys(out).length ? out : undefined
}

function cartOps(value: unknown): CartOpInput[] {
  if (!Array.isArray(value)) return []
  const ops: CartOpInput[] = []
  for (const raw of value.slice(0, 6)) {
    const item = rec(raw)
    if (!item) continue
    const op = oneOf(item.op, ['add', 'remove', 'set_quantity', 'set_variant'] as const)
    const target = str(item.target, 20)
    const line = str(item.line, 20) ?? (op !== 'add' ? target : undefined)
    if (op === 'add' && target) {
      ops.push({ op, target, ...(str(item.variant, 60) ? { variant: str(item.variant, 60) } : {}), ...(int(item.quantity, 1, 50) ? { quantity: int(item.quantity, 1, 50) } : {}) })
    } else if (op === 'remove' && line) {
      ops.push({ op, line })
    } else if (op === 'set_quantity' && line) {
      const quantity = int(item.quantity, 0, 50)
      if (quantity != null) ops.push(quantity === 0 ? { op: 'remove', line } : { op, line, quantity })
    } else if (op === 'set_variant' && line && str(item.variant, 60)) {
      ops.push({ op, line, variant: str(item.variant, 60)! })
    }
  }
  return ops
}

/**
 * One cart change written flat on the act («op» + «line»/«target») instead
 * of inside `ops`. Only an explicit op name is read: an `action` borrowed
 * from the booking enum says nothing about which change the customer meant.
 */
function flatCartOp(item: Rec): CartOpInput[] {
  if (!oneOf(item.op, ['add', 'remove', 'set_quantity', 'set_variant'] as const)) return []
  return cartOps([{ op: item.op, target: item.target, line: item.line, variant: item.variant, quantity: item.quantity }])
}

function parseAct(raw: unknown): Act | null {
  const item = rec(raw)
  if (!item) return null
  // «act» is how some providers' models name the discriminator.
  const type = oneOf(item.type ?? item.act, ACT_TYPES)
  if (!type) return null
  switch (type) {
    case 'greeting': case 'thanks': case 'goodbye': case 'defer': case 'smalltalk': case 'reset_topic':
    case 'order_confirm': case 'order_decline': case 'order_cancel': case 'payment_claim':
    case 'payment_link_request': case 'shipping_change': case 'human_request': case 'other':
      return { type }
    case 'product_search': {
      // The search words belong in `terms`; a model that wrote them in
      // `query` still named what the customer is looking for.
      const listed = strings(item.terms, 6, 40)
      const terms = listed.length ? listed : strings(typeof item.query === 'string' ? [item.query] : [], 1, 40)
      const attrs = attributes(item.attributes)
      const code = str(item.code, 24)
      const display = oneOf(item.display, ['showcase', 'consult', 'browse'] as const) ?? 'consult'
      const maxPrice = num(item.max_price)
      const minPrice = num(item.min_price)
      const sort = oneOf(item.sort, ['price_asc', 'price_desc', 'popular'] as const)
      const count = int(item.count, 1, 10)
      if (!terms.length && !attrs && !code && display !== 'browse' && maxPrice == null && minPrice == null && !sort) return null
      return {
        type, terms, display,
        ...(attrs ? { attributes: attrs } : {}),
        ...(code ? { code } : {}),
        ...(maxPrice != null && maxPrice > 0 ? { maxPrice } : {}),
        ...(minPrice != null && minPrice > 0 ? { minPrice } : {}),
        ...(sort ? { sort } : {}),
        ...(count ? { count } : {}),
      }
    }
    case 'product_question': {
      const target = str(item.target, 20)
      const field = oneOf(item.field, FIELDS) ?? 'details'
      if (!target) return null
      const question = str(item.question, 160)
      return { type, target, field, ...(question ? { question } : {}) }
    }
    case 'variants': {
      const target = str(item.target, 20)
      if (!target) return null
      const variant = str(item.variant, 60)
      return { type, target, ...(variant ? { variant } : {}) }
    }
    case 'compare': {
      const targets = strings(item.targets, 4, 20)
      if (targets.length < 2) return null
      const criterion = str(item.criterion, 80)
      return { type, targets, ...(criterion ? { criterion } : {}) }
    }
    case 'cheaper_alternative': {
      const target = str(item.target, 20)
      return target ? { type, target } : null
    }
    case 'order_start': {
      const items = (Array.isArray(item.items) ? item.items : item.target ? [{ target: item.target, variant: item.variant, quantity: item.quantity }] : [])
        .slice(0, 6)
        .map((entry) => rec(entry))
        .flatMap((entry) => {
          const target = entry ? str(entry.target, 20) : undefined
          if (!entry || !target) return []
          const variant = str(entry.variant, 60)
          const quantity = int(entry.quantity, 1, 50)
          return [{ target, ...(variant ? { variant } : {}), ...(quantity ? { quantity } : {}) }]
        })
      return { type, items }
    }
    case 'cart_edit': {
      const listed = cartOps(item.ops)
      const ops = listed.length ? listed : flatCartOp(item)
      return ops.length ? { type, ops } : null
    }
    case 'order_details': {
      const details = {
        name: str(item.name, 60),
        phone: str(item.phone, 24),
        city: str(item.city, 40),
        address: str(item.address, 300),
        postalCode: str(item.postal_code ?? item.postalCode, 16),
        coupon: str(item.coupon, 40),
        shipping: str(item.shipping, 60),
      }
      const kept = Object.fromEntries(Object.entries(details).filter(([, value]) => value != null))
      return Object.keys(kept).length ? { type, ...kept } : null
    }
    case 'order_status': {
      const orderRef = str(item.order_ref ?? item.orderRef, 32)
      return { type, ...(orderRef ? { orderRef } : {}) }
    }
    case 'restock_subscribe': {
      const target = str(item.target, 20)
      return { type, ...(target ? { target } : {}) }
    }
    case 'booking': {
      const action = oneOf(item.action, ['inquire', 'book', 'reschedule', 'cancel', 'list'] as const) ?? 'inquire'
      const service = str(item.service ?? item.target, 20)
      const date = str(item.date, 40)
      const time = str(item.time, 40)
      return { type, action, ...(service ? { service } : {}), ...(date ? { date } : {}), ...(time ? { time } : {}) }
    }
    case 'course': {
      const action = oneOf(item.action, ['inquire', 'enroll', 'cancel', 'list'] as const) ?? 'inquire'
      const course = str(item.course ?? item.target, 20)
      return { type, action, ...(course ? { course } : {}) }
    }
    case 'policy_question': {
      const topic = oneOf(item.topic, TOPICS) ?? 'other'
      const detail = str(item.detail, 120)
      return { type, topic, ...(detail ? { detail } : {}) }
    }
    case 'knowledge_question': {
      const query = str(item.query, 200)
      return query ? { type, query } : { type, query: '' }
    }
    case 'complaint':
      return { type, severity: oneOf(item.severity, ['low', 'high'] as const) ?? 'low' }
  }
}

/** Parse the forced tool call's arguments. Null = unusable (caller falls back). */
export function parseUnderstanding(raw: unknown): TurnUnderstanding | null {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown } catch { return null } })() : raw
  const root = rec(value)
  if (!root) return null
  if (!Array.isArray(root.acts)) return null
  const parsedActs = root.acts.slice(0, 4).map(parseAct).filter((act): act is Act => act !== null)
  // An empty list inside an otherwise complete reading is a reading too
  // («nothing to act on»: a prompt injection, a remark). Acts that were
  // written but unusable, or a bare `{"acts":[]}`, are not: the caller falls
  // back rather than treat a garbled answer as «nothing».
  const complete = oneOf(root.relation, RELATIONS) !== undefined && rec(root.customer) !== null
  if (!parsedActs.length && (root.acts.length > 0 || !complete)) return null
  const acts: Act[] = parsedActs.length ? parsedActs : [{ type: 'other' }]
  const customer = rec(root.customer) ?? {}
  const buy = int(customer.buy, 0, 3) ?? 0
  const cues = strings(customer.cues, 6, 20).filter((cue): cue is TurnCue => (TURN_CUES as readonly string[]).includes(cue))
  const clarifyRaw = rec(root.clarify)
  const clarifyReason = clarifyRaw ? oneOf(clarifyRaw.reason, ['ambiguous_reference', 'ambiguous_product', 'missing_info'] as const) : undefined
  const confidence = num(root.confidence)
  return {
    v: UNDERSTANDING_VERSION,
    language: oneOf(root.language, ['fa', 'en', 'ar'] as const) ?? 'fa',
    relation: oneOf(root.relation, RELATIONS) ?? 'other',
    acts: acts.slice(0, 3),
    answersPending: root.answers_pending === true || root.answersPending === true,
    ...(clarifyReason ? { clarify: { reason: clarifyReason, ...(str(clarifyRaw?.question, 200) ? { question: str(clarifyRaw?.question, 200) } : {}) } } : {}),
    customer: {
      mood: oneOf(customer.mood, MOODS) ?? 'neu',
      buy: buy as TurnBuyLevel,
      cues,
    },
    confidence: confidence == null ? 0.5 : Math.min(1, Math.max(0, confidence)),
  }
}
