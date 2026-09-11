import { prisma } from '@/lib/prisma'
import {
  pickTemplateImageUrl,
  type ProductShowcase,
} from '@/lib/instagram/media'
import { extractListItems, normalizeAttributes, stripListBlocks } from '@/lib/products/description'

const PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g
const MAX_PRODUCTS_PER_REPLY = 10

export interface ProductDirective {
  id: string | null
  name: string
}

/**
 * Customer-facing introduction for a deterministic showcase reply.
 *
 * The previous one-liner («X محصول موجود و مرتبط پیدا کردم:») told the
 * customer how many products had been found, but not what they were about
 * to receive or how to continue. A salesperson opening a vitrine does all
 * three: names the category, sets expectations about what each card shows,
 * and offers one narrowing question. Only catalog-noun terms are named so the
 * sentence stays true even when the ranking includes loosely related matches;
 * adjectives such as «مجلسی» are intentionally dropped because not every
 * returned product necessarily carries them, and the caller additionally
 * drops the subject entirely when the shown products do not carry it.
 */
export function showcaseIntroText(params: {
  count: number
  subject?: string
  isFa: boolean
}): string {
  const subject = (params.subject ?? '').trim().slice(0, 40)
  const hasSubject = subject.length >= 2
  if (params.isFa) {
    const count = params.count.toLocaleString('fa-IR')
    if (params.count === 0) {
      return [
        hasSubject
          ? `فعلاً هیچ ${subject} موجودی مطابق این درخواست در کاتالوگ پیدا نکردم.`
          : 'فعلاً محصول موجود و منطبقی برای این درخواست در کاتالوگ پیدا نشد.',
        'مدل یا رنگ خاصی مدنظرتان است؟ بگویید تا دوباره دقیق‌تر جست‌وجو کنم.',
      ].join('\n')
    }
    if (params.count === 1) {
      return [
        hasSubject
          ? `یک مدل ${subject} موجود و مرتبط پیدا کردم؛ عکس، قیمت و مشخصاتش را در ادامه می‌بینید.`
          : 'یک محصول موجود و مرتبط پیدا کردم؛ عکس، قیمت و مشخصاتش را در ادامه می‌بینید.',
        'اگر سایز یا رنگ خاصی لازم دارید، بگویید تا موجودیش را چک کنم.',
      ].join('\n')
    }
    return [
      hasSubject
        ? `${count} مدل ${subject} موجود و مرتبط پیدا کردم؛ عکس، قیمت و مشخصات هر کدام را در ادامه می‌بینید.`
        : `${count} محصول موجود و مرتبط پیدا کردم؛ عکس، قیمت و مشخصات هر کدام را در ادامه می‌بینید.`,
      'رنگ یا سایز خاصی مدنظرتان است؟ بگویید تا از بین همین‌ها دقیق‌تر نشانتان بدهم.',
    ].join('\n')
  }
  if (params.count === 0) {
    return [
      hasSubject
        ? `I could not find an available ${subject} matching that request in the catalog right now.`
        : 'No available matching product was found in the catalog right now.',
      'Got a specific model or color in mind? Tell me and I will search again more precisely.',
    ].join('\n')
  }
  if (params.count === 1) {
    return [
      hasSubject
        ? `I found one available ${subject} that matches what you asked for; its photo, price and specs follow.`
        : 'I found one available matching product; its photo, price and specs follow.',
      'Need a specific size or color? Tell me and I will check its availability.',
    ].join('\n')
  }
  const count = params.count.toLocaleString('en-US')
  return [
    hasSubject
      ? `I found ${count} available ${subject} options that match what you asked for; the photo, price and specs of each follow.`
      : `I found ${count} available matching options; the photo, price and specs of each follow.`,
    'Looking for a specific color or size? Tell me and I will narrow these down for you.',
  ].join('\n')
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
    // Catalog names usually carry ASCII digits («تونیک روناز 0788») while the
    // model echoes the customer's script («تونیک روناز ۰۷۸۸»). Folding digit
    // scripts keeps exact-name recovery working across both conventions.
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
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
  const byName = new Map(candidates.map(({ product }) => [normalizedProductMention(product.name), product]))
  const seen = new Set<string>()
  const output: TrustedProductShowcase[] = []

  for (const directive of directives) {
    const product =
      (directive.id ? byId.get(directive.id) : undefined) ??
      (directive.name ? byName.get(normalizedProductMention(directive.name)) : undefined)
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
      // v3.1: prefer JPG/PNG/GIF over webp and percent-encode Persian paths —
      // Instagram's Generic Template silently drops webp images, which showed
      // up as product cards without photos. Web renderers handle the picked
      // jpg/png equally well, so one selection rule serves every surface.
      imageUrl: pickTemplateImageUrl(product.images),
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
 * The subject is only named when the shown products actually carry it.
 * Vector search has no similarity floor, so a query such as «دوچرخه» on a
 * fashion catalog still returns loosely related rows; calling those
 * «مدل دوچرخه» would turn a weak ranking into a false customer-facing claim.
 * At least half of the selected products must mention a subject term.
 */
function subjectIsCoveredByProducts(products: TrustedProductShowcase[], subject: string): boolean {
  if (!subject) return false
  const terms = subject.split(/\s+/).map((term) => normalizedProductMention(term)).filter(Boolean)
  if (!terms.length) return false
  const matches = products.filter((product) => {
    const name = normalizedProductMention(product.name)
    return terms.some((term) => name.includes(term))
  }).length
  return matches >= Math.ceil(products.length / 2)
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
  /** Catalog subject noun(s) from the customer's own request, for the intro. */
  subjectPhrase?: string
  /**
   * Rows the deterministic search proved the customer named (every search
   * term of a code-carrying query is covered by the row). Their cards are
   * attached even to consultation replies the model paraphrased, and a
   * forced showcase narrows to exactly these products.
   */
  identifiedProductIds?: string[]
}): Promise<string> {
  const subject = (params.subjectPhrase ?? '').trim()
  const parsed = parseProductDirectives(params.raw)
  const preferredDirectives = [...new Set(params.preferredProductIds ?? [])]
    .slice(0, MAX_PRODUCTS_PER_REPLY)
    .map((id) => ({ id, name: '' }))
  const identifiedDirectives = [...new Set(params.identifiedProductIds ?? [])]
    .slice(0, MAX_PRODUCTS_PER_REPLY)
    .map((id) => ({ id, name: '' }))
  const directives = params.forceShowcase
    ? (identifiedDirectives.length ? identifiedDirectives : preferredDirectives)
    : [...parsed.directives, ...preferredDirectives, ...identifiedDirectives]

  if (!directives.length) {
    if (params.forceShowcase) {
      return showcaseIntroText({ count: 0, subject, isFa: params.isFa })
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
  const identifiedIds = new Set(identifiedDirectives.map((directive) => directive.id))
  const selectedProducts = params.forceShowcase
    ? products
    : products.filter((product) =>
      explicitlyResolved.has(product.id) ||
      (preferredIds.has(product.id) && replyMentionsProduct(parsed.text, product.name)) ||
      identifiedIds.has(product.id),
    )

  if (!selectedProducts.length) {
    return params.forceShowcase
      ? showcaseIntroText({ count: 0, subject, isFa: params.isFa })
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
    ? showcaseIntroText({
        count: selectedProducts.length,
        subject: subjectIsCoveredByProducts(selectedProducts, subject) ? subject : '',
        isFa: params.isFa,
      })
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
