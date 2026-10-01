/**
 * Cart editing inside an in-chat order: «یه پاف هم اضافه کن»، «میز رو حذف
 * کن»، «دوتا کنش»، «رنگش رو سفید کن».
 *
 * A cheap regex gate decides whether the turn edits the cart at all; only
 * then one small function-calling round maps the customer's words to cart
 * operations. The server validates every operation against the agent's own
 * catalog and live stock before touching the draft, so the model can never
 * add an unknown product, a price or an unavailable variant. When the model
 * is unavailable a conservative deterministic fallback handles the common
 * phrasings.
 */
import { chatCompletion, type ChatTool } from '@/lib/ai/openrouter'
import { normalizeOrderText, type OrderDraftItem } from '@/lib/commerce/order-capture'

export type CartEditCue = 'add' | 'remove' | 'change'

const CART_ADD_RE =
  /(?:اضافه\s?(?:کن|کنید|کنین|بشه|می\s?کنی|میکنی|کنی)|(?:^|\s)هم\s(?:می\s?خوام|میخوام|میخام|بذار|بزار|بفرست|بده|اضافه|بخرم|می\s?خرم|میخرم)|(?:^|\s)(?:اینم|اونم|اینو\s?هم|اونو\s?هم|یکی\s?هم|یه\s?دونه\s?هم)(?:\s|$)|به\s?سبد|تو\s?سبد\s?(?:بذار|بزار)|(?:^|\s)add\s|(?:^|\s)also\s+(?:want|add|get)|as\s+well)/u
const CART_REMOVE_RE =
  /(?:حذف(?:ش)?\s?(?:کن|کنید|کنین|بشه)|برش\s?(?:دار|دارید)|بردار(?:ید|ین)?(?:\s|$)|(?:رو|را|و)\s(?:نمی\s?خوام|نمیخوام|نمیخام)|از\s?سبد\s?(?:دربیار|بردار|حذف|در\s?بیار)|(?:^|\s)remove\s|take\s+(?:out|off)|(?:^|\s)drop\s)/u
const CART_CHANGE_RE =
  /(?:(?:عوض|تغییر)\s?(?:کن|کنید|کنین|بده|بدید|بشه)|به\s?جا(?:ی|ش)|(?:^|\s)(?:تعداد(?:ش|شو|ش\s?رو)?)\s|(?:\d+|دو|سه|چهار|پنج|شش|یه|یک)\s?(?:تا|عدد|دونه)\s?(?:کن|بشه|باشه|بذار|بزار|کنید)|(?:^|\s)(?:یکی|یدونه)\s?(?:کن|بشه|باشه|کمش\s?کن)|(?:رنگ|سایز|طرح|مدل)(?:ش|شو|ش\s?رو)?\s.+\s(?:کن|باشه|بشه)|(?:^|\s)(?:change|instead|make\s+it)\s)/u

/** Does this message edit the cart (and how, roughly)? */
export function detectCartEditCue(message: string): CartEditCue | null {
  const text = normalizeOrderText(message)
  if (!text) return null
  if (CART_REMOVE_RE.test(text)) return 'remove'
  if (CART_ADD_RE.test(text)) return 'add'
  if (CART_CHANGE_RE.test(text)) return 'change'
  return null
}

export type CartEditOp =
  | { op: 'add'; productId: string; variant: string | null; quantity: number }
  | { op: 'remove'; line: number }
  | { op: 'set_quantity'; line: number; quantity: number }
  | { op: 'set_variant'; line: number; variant: string }

export interface CartCandidate {
  id: string
  name: string
  price: number | null
  /** Human variant labels available right now («رنگ: طوسی»). */
  variants: string[]
}

const CART_TOOLS: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_item',
      description: 'Add a product from the candidate list to the cart.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'Exact id from the candidate list.' },
          variant: { type: 'string', description: 'Exact variant label from that product\'s list, only if the customer named one.' },
          quantity: { type: 'number', description: 'How many. Default 1.' },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_item',
      description: 'Remove a cart line.',
      parameters: { type: 'object', properties: { line: { type: 'number', description: 'Cart line number (1-based).' } }, required: ['line'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_quantity',
      description: 'Change the quantity of a cart line. 0 removes it.',
      parameters: {
        type: 'object',
        properties: { line: { type: 'number' }, quantity: { type: 'number' } },
        required: ['line', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_variant',
      description: 'Change the variant (color/size/design) of a cart line.',
      parameters: {
        type: 'object',
        properties: { line: { type: 'number' }, variant: { type: 'string', description: 'Exact label from that line\'s available variants.' } },
        required: ['line', 'variant'],
      },
    },
  },
]

const PLANNER_SYSTEM = `You edit a shopping cart for a store's chat assistant. Read the customer's latest message and call the tools that apply the change they asked for, and nothing else.
Rules:
- Only use product ids from the candidate list and variant labels exactly as listed.
- Refer to existing items by their cart line number.
- "X هم" / "also X" / "add X" means add_item. "X رو حذف کن" / "X رو نمی‌خوام" means remove_item for the line of X.
- "دوتا کن" / "make it two" without a named item means set_quantity on the most recently added line.
- If the message does not ask to change the cart, call no tool.`

function cartTranscript(message: string, cart: Array<OrderDraftItem & { variants?: string[] }>, candidates: CartCandidate[]): string {
  const lines = cart.length
    ? cart.map((item, index) => `${index + 1}. ${item.name}${item.variant ? ` — ${item.variant}` : ''} × ${item.quantity}${item.variants?.length ? ` [available variants: ${item.variants.join(' | ')}]` : ''}`).join('\n')
    : '(empty)'
  const offers = candidates.length
    ? candidates.map((candidate) => `- id=${candidate.id} | ${candidate.name}${candidate.price != null ? ` | ${candidate.price}` : ''}${candidate.variants.length ? ` | variants: ${candidate.variants.join(' | ')}` : ''}`).join('\n')
    : '(none)'
  return `Cart:\n${lines}\n\nCandidate products:\n${offers}\n\nCustomer message: ${message}`
}

function toInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

/** One function-calling round. Returns null when the model is unavailable. */
export async function planCartEditWithModel(params: {
  model: string
  message: string
  cart: Array<OrderDraftItem & { variants?: string[] }>
  candidates: CartCandidate[]
}): Promise<CartEditOp[] | null> {
  let calls: Array<{ name: string; args: Record<string, unknown> }> = []
  try {
    const result = await chatCompletion({
      model: params.model,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        { role: 'user', content: cartTranscript(params.message, params.cart, params.candidates) },
      ],
      temperature: 0,
      maxTokens: 250,
      tools: CART_TOOLS,
      toolChoice: 'auto',
    })
    calls = result.toolCalls.slice(0, 6).flatMap((call) => {
      try { return [{ name: call.function.name, args: JSON.parse(call.function.arguments || '{}') as Record<string, unknown> }] } catch { return [] }
    })
  } catch {
    return null
  }
  const candidateIds = new Set(params.candidates.map((candidate) => candidate.id))
  const ops: CartEditOp[] = []
  for (const call of calls) {
    if (call.name === 'add_item' && typeof call.args.product_id === 'string' && candidateIds.has(call.args.product_id)) {
      ops.push({
        op: 'add',
        productId: call.args.product_id,
        variant: typeof call.args.variant === 'string' && call.args.variant.trim() ? call.args.variant.trim() : null,
        quantity: Math.min(50, Math.max(1, toInt(call.args.quantity, 1))),
      })
    } else if (call.name === 'remove_item') {
      const line = toInt(call.args.line, 0)
      if (line >= 1 && line <= params.cart.length) ops.push({ op: 'remove', line })
    } else if (call.name === 'set_quantity') {
      const line = toInt(call.args.line, 0)
      const quantity = toInt(call.args.quantity, -1)
      if (line >= 1 && line <= params.cart.length && quantity >= 0 && quantity <= 50) {
        ops.push(quantity === 0 ? { op: 'remove', line } : { op: 'set_quantity', line, quantity })
      }
    } else if (call.name === 'set_variant' && typeof call.args.variant === 'string') {
      const line = toInt(call.args.line, 0)
      if (line >= 1 && line <= params.cart.length) ops.push({ op: 'set_variant', line, variant: call.args.variant.trim() })
    }
  }
  return ops
}

/** Distinctive words of a cart line's name that appear in the message. */
export function mentionsLine(message: string, item: OrderDraftItem, cart: OrderDraftItem[]): boolean {
  const text = ` ${normalizeOrderText(message)} `
  const others = cart.filter((other) => other !== item).map((other) => normalizeOrderText(other.name).split(/\s+/u))
  return normalizeOrderText(item.name)
    .split(/\s+/u)
    .filter((token) => token.length >= 3 && !others.some((words) => words.includes(token)))
    .some((token) => [` ${token} `, ` ${token}رو `, ` ${token}و `, ` ${token}ه `].some((form) => text.includes(form)))
}

/**
 * Conservative fallback when no model answered: an add of the one product
 * the search identified, a remove of the one line the message names, a
 * quantity change of the named (or last) line.
 */
export function planCartEditDeterministic(params: {
  cue: CartEditCue
  message: string
  cart: OrderDraftItem[]
  identified: CartCandidate[]
  quantity: number | undefined
}): CartEditOp[] {
  const { cue, cart } = params
  const named = cart.map((item, index) => ({ item, line: index + 1 })).filter(({ item }) => mentionsLine(params.message, item, cart))
  if (cue === 'add') {
    const candidate = params.identified.find((row) => !cart.some((item) => item.productId === row.id)) ?? null
    return candidate ? [{ op: 'add', productId: candidate.id, variant: null, quantity: params.quantity ?? 1 }] : []
  }
  if (cue === 'remove') {
    return named.length === 1 ? [{ op: 'remove', line: named[0].line }] : []
  }
  if (params.quantity && cart.length) {
    const line = named.length === 1 ? named[0].line : cart.length
    return [{ op: 'set_quantity', line, quantity: params.quantity }]
  }
  return []
}
