/**
 * Matching a customer's words to a product variation when variations combine
 * several options (رنگ + سایز, طرح + جنس …).
 *
 * The old matcher took the single best attribute hit, so «مشکی» on a product
 * sold in black S/M/L silently picked the first black one. Here every
 * variation is scored by how many of its options the text names:
 *   • one variation named completely          → 'full'
 *   • several share the named options         → 'partial' (ask the rest)
 *   • nothing named                           → 'none'
 * Single-letter sizes («M», «L») count as whole words only.
 */
import type { VariationRow } from '@/lib/products/description'
import { normalizeOrderText } from '@/lib/commerce/order-capture'

export type VariantMatch =
  | { kind: 'full'; variation: VariationRow }
  | { kind: 'partial'; fixed: Record<string, string>; candidates: VariationRow[] }
  | { kind: 'none' }

function norm(value: string): string {
  return normalizeOrderText(value).replace(/[،,؛;:()«»"'!?؟.]/g, ' ').replace(/\s+/g, ' ').trim()
}

function named(text: string, value: string): boolean {
  const needle = norm(value)
  if (!needle) return false
  // Latin one-letter sizes are only trusted as a standalone word.
  if (needle.length === 1 && !/[a-z0-9]/.test(needle)) return false
  return text.includes(` ${needle} `)
}

export function matchVariantInText(variations: VariationRow[], rawText: string): VariantMatch {
  if (!variations.length) return { kind: 'none' }
  const text = ` ${norm(rawText)} `
  const scored = variations.map((variation) => {
    const keys = Object.entries(variation.attributes)
      .filter(([, value]) => named(text, value))
      .map(([key]) => key)
    return { variation, keys, size: Object.keys(variation.attributes).length }
  })
  const best = Math.max(...scored.map((row) => row.keys.length))
  if (best === 0) return { kind: 'none' }
  const top = scored.filter((row) => row.keys.length === best)
  const complete = top.filter((row) => row.keys.length === row.size)
  if (complete.length === 1) return { kind: 'full', variation: complete[0].variation }

  // The options the text pinned down, kept only where every top match agrees.
  const fixed: Record<string, string> = {}
  for (const key of top[0].keys) {
    const value = top[0].variation.attributes[key]
    if (top.every((row) => row.variation.attributes[key] === value)) fixed[key] = value
  }
  if (!Object.keys(fixed).length) return { kind: 'none' }
  const candidates = variations.filter((variation) =>
    Object.entries(fixed).every(([key, value]) => variation.attributes[key] == null || variation.attributes[key] === value))
  if (candidates.length === 1) return { kind: 'full', variation: candidates[0] }
  return { kind: 'partial', fixed, candidates }
}

/**
 * The next option to ask about among the candidates: the first attribute
 * whose values still differ, with the values that remain.
 */
export function nextVariantQuestion(candidates: VariationRow[], fixed: Record<string, string> = {}): { attribute: string; values: string[] } | null {
  const keys: string[] = []
  for (const variation of candidates) {
    for (const key of Object.keys(variation.attributes)) if (!keys.includes(key)) keys.push(key)
  }
  for (const key of keys) {
    if (key in fixed) continue
    const values = [...new Set(candidates.map((variation) => variation.attributes[key]).filter((value): value is string => Boolean(value && value.trim())))]
    if (values.length > 1) return { attribute: key, values }
  }
  return null
}

/** «مشکی، M»-style label of what is fixed so far (kept on the cart line). */
export function fixedLabel(fixed: Record<string, string>): string {
  return Object.values(fixed).map((value) => value.trim()).filter(Boolean).join('، ')
}
