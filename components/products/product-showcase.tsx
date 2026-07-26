/**
 * Trusted parsing for the `[[product:{…}]]` markers an agent reply carries.
 *
 * This module stays free of JSX and of any client directive so React Server
 * Components (the admin transcript) can call the parser directly, while the
 * interactive rail lives in `./product-showcase-rail`.
 */

const PRODUCT_PREFIX = '[[product:'
export const MAX_SHOWCASE_PRODUCTS = 10

export type ShowcaseProduct = {
  id: string
  name: string
  price: string
  description: string
  badge: string
  imageUrl: string
  productUrl: string
  specs: string[]
  /** Legacy local-history aliases; new canonical markers use fields above. */
  desc?: string
  image?: string
  url?: string
}

/** Only http(s) product links/images are ever rendered, never `javascript:`. */
export function safeHttpUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function shortText(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
}

function readSpecs(value: Record<string, unknown>): string[] {
  const raw = value.specs ?? value.attributes
  if (Array.isArray(raw)) {
    return raw
      .map((item) => shortText(item, 70))
      .filter(Boolean)
      .slice(0, 4)
  }
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw as Record<string, unknown>)
    .map(([key, item]) => {
      const label = shortText(key, 28)
      const detail = typeof item === 'string' || typeof item === 'number'
        ? shortText(String(item), 38)
        : ''
      return label && detail ? `${label}: ${detail}` : ''
    })
    .filter(Boolean)
    .slice(0, 4)
}

function readProduct(json: string): ShowcaseProduct | null {
  try {
    const value = JSON.parse(json) as Record<string, unknown>
    const name = shortText(value.name, 120)
    if (!name) return null
    const rawPrice = value.price
    return {
      id: shortText(value.id, 80),
      name,
      price:
        typeof rawPrice === 'number' && Number.isFinite(rawPrice)
          ? rawPrice.toLocaleString('fa-IR')
          : shortText(rawPrice, 60),
      description: shortText(value.desc ?? value.description, 240),
      badge: shortText(value.badge, 28),
      imageUrl: safeHttpUrl(value.image ?? value.imageUrl),
      productUrl: safeHttpUrl(value.url ?? value.productUrl),
      specs: readSpecs(value),
    }
  } catch {
    return null
  }
}

function productTokenBounds(
  raw: string,
  jsonStart: number,
): { jsonEnd: number; tokenEnd: number } | null {
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = jsonStart; index < raw.length; index += 1) {
    const char = raw[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0 && raw.slice(index + 1, index + 3) === ']]') {
        return { jsonEnd: index + 1, tokenEnd: index + 3 }
      }
    }
  }
  return null
}

/**
 * Split a persisted assistant reply into customer-facing text and trusted
 * product snapshots. An unfinished streaming marker is held back so machine
 * syntax never flashes on screen.
 */
export function parseProductShowcaseContent(
  raw: string,
  complete = true,
): { text: string; products: ShowcaseProduct[] } {
  const products: ShowcaseProduct[] = []
  const visible: string[] = []
  const seen = new Set<string>()
  let cursor = 0

  while (cursor < raw.length) {
    const start = raw.indexOf(PRODUCT_PREFIX, cursor)
    if (start < 0) {
      visible.push(raw.slice(cursor))
      break
    }
    visible.push(raw.slice(cursor, start))
    const jsonStart = start + PRODUCT_PREFIX.length
    const bounds = productTokenBounds(raw, jsonStart)
    // A malformed or partial marker is never user-facing, including after a
    // disrupted stream. This also prevents JSON fragments leaking into text.
    if (!bounds) break

    if (complete && products.length < MAX_SHOWCASE_PRODUCTS) {
      const product = readProduct(raw.slice(jsonStart, bounds.jsonEnd))
      if (product) {
        const identity = product.id || product.name.toLocaleLowerCase()
        if (!seen.has(identity)) {
          seen.add(identity)
          products.push(product)
        }
      }
    }
    cursor = bounds.tokenEnd
  }

  return {
    text: visible.join('').replace(/\n{3,}/g, '\n\n').trim(),
    products,
  }
}
