import { prisma } from '@/lib/prisma'
import type { ProductShowcase } from '@/lib/instagram/media'

const PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g
const MAX_PRODUCTS_PER_REPLY = 5

export interface ProductDirective {
  id: string | null
  name: string
}

/**
 * Remove model-only product markers from visible text and retain only the
 * minimal identifiers required to resolve trusted product data from our DB.
 */
export function parseProductDirectives(raw: string): {
  text: string
  directives: ProductDirective[]
} {
  const directives: ProductDirective[] = []
  const text = raw.replace(PRODUCT_TOKEN, (_token, json: string) => {
    if (directives.length >= MAX_PRODUCTS_PER_REPLY) return ''
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      const name = typeof value.name === 'string' ? value.name.trim().slice(0, 120) : ''
      const id = typeof value.id === 'string' ? value.id.trim().slice(0, 80) : ''
      if (id || name) directives.push({ id: id || null, name })
    } catch {
      // A malformed marker is never sent to the customer.
    }
    return ''
  })

  return {
    text: text.replace(/\n{3,}/g, '\n\n').trim(),
    directives,
  }
}

/** Resolve model markers against products that are active and assigned to the agent. */
export async function resolveProductShowcases(params: {
  workspaceId: string
  agentId: string
  directives: ProductDirective[]
}): Promise<ProductShowcase[]> {
  const directives = params.directives.slice(0, MAX_PRODUCTS_PER_REPLY)
  if (!directives.length) return []

  const ids = [...new Set(directives.map((item) => item.id).filter((id): id is string => !!id))]
  const names = [...new Set(directives.map((item) => item.name).filter(Boolean))]
  const candidates = await prisma.agentCatalog.findMany({
    where: {
      agentId: params.agentId,
      product: {
        workspaceId: params.workspaceId,
        active: true,
        OR: [
          ...(ids.length ? [{ id: { in: ids } }] : []),
          ...names.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })),
        ],
      },
    },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          images: true,
          externalUrl: true,
        },
      },
    },
  })

  const byId = new Map(candidates.map(({ product }) => [product.id, product]))
  const byName = new Map(candidates.map(({ product }) => [product.name.toLocaleLowerCase(), product]))
  const seen = new Set<string>()
  const output: ProductShowcase[] = []

  for (const directive of directives) {
    const product =
      (directive.id ? byId.get(directive.id) : undefined) ??
      (directive.name ? byName.get(directive.name.toLocaleLowerCase()) : undefined)
    if (!product || seen.has(product.id)) continue
    seen.add(product.id)
    output.push({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      // Woo fields are tenant-controlled. Only pass web URLs to renderers or
      // channel APIs; everything else is silently omitted.
      imageUrl: safeProductUrl(product.images[0]) ?? null,
      productUrl: safeProductUrl(product.externalUrl),
    })
  }

  return output
}

function safeProductUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Compact cross-channel fallback for messengers without generic templates. */
export function formatProductFallback(products: ProductShowcase[], isFa: boolean): string {
  return products
    .slice(0, MAX_PRODUCTS_PER_REPLY)
    .map((product, index) => {
      const details: string[] = []
      if (product.price != null) {
        details.push(
          isFa
            ? `${product.price.toLocaleString('fa-IR')} تومان`
            : `${product.price.toLocaleString('en-US')}`,
        )
      }
      const url = safeProductUrl(product.productUrl)
      const line = `${index + 1}. ${product.name}${details.length ? ` — ${details.join(' | ')}` : ''}`
      return url ? `${line}\n${url}` : line
    })
    .join('\n\n')
}

/**
 * Replace model-authored markers with canonical DB snapshots before a public
 * web reply is persisted. Text may be model-authored; identity, price, image
 * and destination URL are always sourced from the product row.
 */
export async function buildTrustedProductReply(params: {
  raw: string
  workspaceId: string
  agentId: string
  isFa: boolean
}): Promise<string> {
  const parsed = parseProductDirectives(params.raw)
  if (!parsed.directives.length) return parsed.text === params.raw.trim() ? params.raw : parsed.text

  const products = await resolveProductShowcases({
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    directives: parsed.directives,
  })
  if (!products.length) return parsed.text

  const markers = products.map((product) => {
    const price = product.price == null
      ? ''
      : params.isFa
        ? `${product.price.toLocaleString('fa-IR')} تومان`
        : product.price.toLocaleString('en-US')
    return `[[product:${JSON.stringify({
      id: product.id,
      name: product.name,
      price,
      desc: (product.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
      badge: params.isFa ? 'پیشنهاد' : 'Recommended',
      image: safeProductUrl(product.imageUrl) ?? '',
      url: safeProductUrl(product.productUrl) ?? '',
    })}]]`
  })

  return [parsed.text, markers.join('\n')].filter(Boolean).join('\n\n')
}
