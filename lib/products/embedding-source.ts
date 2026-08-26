import crypto from 'node:crypto'
import { cleanDescriptionForChat } from '@/lib/products/description'

export interface ProductEmbeddingSource {
  active: boolean
  name: string
  description: string | null
  sku: string | null
  tags: string[]
  attributes: unknown
  categoryId: string | null
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

/**
 * Hash only fields that affect product discovery.
 *
 * Price, stock, images and URLs are deliberately absent: chat loads those
 * values from the live Product row after retrieval, so changing them must not
 * pay for a new vector. Variation price/stock fields are likewise stripped,
 * while their searchable attributes (colour, size, pattern, ...) remain.
 */
export function productEmbeddingSourceHash(product: ProductEmbeddingSource): string {
  const publicAttributes: Record<string, unknown> = {}
  const variationAttributes: unknown[] = []

  if (product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes)) {
    for (const [key, value] of Object.entries(product.attributes as Record<string, unknown>)) {
      if (key !== '_variations') {
        publicAttributes[key] = value
        continue
      }
      if (!Array.isArray(value)) continue
      for (const variation of value.slice(0, 60)) {
        if (!variation || typeof variation !== 'object' || Array.isArray(variation)) continue
        const attributes = (variation as Record<string, unknown>).attributes
        if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
          variationAttributes.push(attributes)
        }
      }
    }
  }

  // Variation order has no semantic meaning and can change between otherwise
  // identical WooCommerce payloads. Sort their canonical representations so
  // that reordering alone cannot trigger a paid embedding request.
  const sortedVariationAttributes = variationAttributes
    .map((attributes) => canonicalize(attributes))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  const semanticSource = canonicalize({
    active: product.active,
    name: product.name.trim(),
    description: cleanDescriptionForChat(product.description, 4_000),
    sku: product.sku?.trim() || null,
    tags: [...product.tags].sort((a, b) => a.localeCompare(b)),
    categoryId: product.categoryId,
    attributes: publicAttributes,
    variations: sortedVariationAttributes,
  })

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(semanticSource))
    .digest('hex')
}
