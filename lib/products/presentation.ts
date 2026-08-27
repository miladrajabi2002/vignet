import { prisma } from '@/lib/prisma'
import type { ProductShowcase } from '@/lib/instagram/media'
import { extractListItems, normalizeAttributes, stripListBlocks } from '@/lib/products/description'

const PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g
const MAX_PRODUCTS_PER_REPLY = 10

export interface ProductDirective {
  id: string | null
  name: string
}

export type TrustedProductShowcase = ProductShowcase & { specs: string[] }

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

function normalizedProductMention(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d]/g, ' ')
    .toLocaleLowerCase('fa')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Exact catalog-name mentions are a safe fallback when the model forgets the marker. */
function replyMentionsProduct(reply: string, productName: string): boolean {
  const name = normalizedProductMention(productName)
  if (name.length < 2) return false
  return ` ${normalizedProductMention(reply)} `.includes(` ${name} `)
}

/** Resolve model markers against products that are active and assigned to the agent. */
export async function resolveProductShowcases(params: {
  workspaceId: string
  agentId: string
  directives: ProductDirective[]
}): Promise<TrustedProductShowcase[]> {
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
        AND: [
          // null means unlimited/untracked in our Product schema, so it is a
          // valid available product. Only an explicit zero is sold out.
          { OR: [{ stock: null }, { stock: { gt: 0 } }] },
          {
            OR: [
              ...(ids.length ? [{ id: { in: ids } }] : []),
              ...names.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })),
            ],
          },
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
          attributes: true,
        },
      },
    },
  })

  const byId = new Map(candidates.map(({ product }) => [product.id, product]))
  const byName = new Map(candidates.map(({ product }) => [product.name.toLocaleLowerCase(), product]))
  const seen = new Set<string>()
  const output: TrustedProductShowcase[] = []

  for (const directive of directives) {
    const product =
      (directive.id ? byId.get(directive.id) : undefined) ??
      (directive.name ? byName.get(directive.name.toLocaleLowerCase()) : undefined)
    if (!product || seen.has(product.id)) continue
    seen.add(product.id)
    const attributeRows = [
      ...normalizeAttributes(product.attributes),
      ...extractListItems(product.description ?? ''),
    ]
    const specs = [...new Set(attributeRows.map((item) => {
      const label = cleanSpecPart(item.label, 28)
      const value = cleanSpecPart(item.value, 38)
      return label && value ? `${label}: ${value}` : label
    }).filter(Boolean))].slice(0, 4)
    output.push({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      // Woo fields are tenant-controlled. Only pass web URLs to renderers or
      // channel APIs; everything else is silently omitted.
      imageUrl: safeProductUrl(product.images[0]) ?? null,
      productUrl: safeProductUrl(product.externalUrl),
      specs,
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
export function formatProductFallback(products: TrustedProductShowcase[], isFa: boolean): string {
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
      const description = cleanProductDescription(product.description, 160)
      const specs = product.specs.length ? product.specs.join(' | ') : ''
      return [line, description, specs, url].filter(Boolean).join('\n')
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
  /** Deterministic DB selection made by the hybrid product search. */
  preferredProductIds?: string[]
  /** Ignore model product prose/markers and render exactly preferredProductIds. */
  forceShowcase?: boolean
}): Promise<string> {
  const parsed = parseProductDirectives(params.raw)
  const preferredDirectives = [...new Set(params.preferredProductIds ?? [])]
    .slice(0, MAX_PRODUCTS_PER_REPLY)
    .map((id) => ({ id, name: '' }))
  const directives = params.forceShowcase
    ? preferredDirectives
    : [...parsed.directives, ...preferredDirectives]

  if (!directives.length) {
    if (params.forceShowcase) {
      return params.isFa
        ? 'محصول موجود و منطبقی برای این درخواست در کاتالوگ پیدا نشد.'
        : 'No available matching product was found in the catalog.'
    }
    return parsed.text === params.raw.trim() ? params.raw : parsed.text
  }

  const products = await resolveProductShowcases({
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    directives,
  })
  // Models occasionally introduce the right catalog rows in prose but omit
  // the internal [[product:...]] directives. Recover only exact names from
  // this turn's deterministic catalog result; never trust a model-authored
  // price, id or URL. This keeps rich cards reliable without turning generic
  // replies into product dumps.
  const explicitlyResolved = new Set(products
    .filter((product) => parsed.directives.some((directive) =>
      directive.id === product.id || (
        directive.name &&
        normalizedProductMention(directive.name) === normalizedProductMention(product.name)
      ),
    ))
    .map((product) => product.id))
  const preferredIds = new Set(preferredDirectives.map((directive) => directive.id))
  const selectedProducts = params.forceShowcase
    ? products
    : products.filter((product) =>
      explicitlyResolved.has(product.id) ||
      (preferredIds.has(product.id) && replyMentionsProduct(parsed.text, product.name)),
    )

  if (!selectedProducts.length) {
    return params.forceShowcase
      ? params.isFa
        ? 'محصول موجود و منطبقی برای این درخواست در کاتالوگ پیدا نشد.'
        : 'No available matching product was found in the catalog.'
      : parsed.text
  }

  const markers = selectedProducts.map((product) => {
    const price = product.price == null
      ? ''
      : params.isFa
        ? `${product.price.toLocaleString('fa-IR')} تومان`
        : product.price.toLocaleString('en-US')
    return `[[product:${JSON.stringify({
      id: product.id,
      name: product.name,
      price,
      desc: cleanProductDescription(product.description, 240),
      badge: params.isFa ? 'موجود' : 'Available',
      image: safeProductUrl(product.imageUrl) ?? '',
      url: safeProductUrl(product.productUrl) ?? '',
      specs: product.specs,
    })}]]`
  })

  const visibleText = params.forceShowcase
    ? params.isFa
      ? `${selectedProducts.length.toLocaleString('fa-IR')} محصول موجود و مرتبط پیدا کردم:`
      : `I found ${selectedProducts.length} available matching product${selectedProducts.length === 1 ? '' : 's'}:`
    : parsed.text

  return [visibleText, markers.join('\n')].filter(Boolean).join('\n\n')
}

function cleanProductDescription(value: string | null | undefined, maxLength: number): string {
  if (!value) return ''
  // List items are emitted separately as structured specs; remove their HTML
  // block here so cards do not repeat the same details in both places.
  const withoutExecutableBlocks = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  return stripListBlocks(withoutExecutableBlocks)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function cleanSpecPart(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}
