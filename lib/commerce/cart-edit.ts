
import { normalizeOrderText, type OrderDraftItem } from '@/lib/commerce/order-capture'

export type CartEditCue = 'add' | 'remove' | 'change'

export type CartEditOp =
  | { op: 'add'; productId: string; variant: string | null; quantity: number; variationId?: number | null }
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
