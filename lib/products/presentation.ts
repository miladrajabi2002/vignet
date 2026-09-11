import { prisma } from '@/lib/prisma'
import {
  pickTemplateImageUrl,
  type ProductShowcase,
} from '@/lib/instagram/media'
import { extractListItems, extractTypedVariations, normalizeAttributes, stripListBlocks, type VariationRow } from '@/lib/products/description'

const PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g
const MAX_PRODUCTS_PER_REPLY = 10

export interface ProductDirective {
  id: string | null
  name: string
  /**
   * Variant label the model picked from the catalog's variation list
   * («طرح 05», «رنگ کرم»). The trusted resolver maps it back to the exact
   * variation row so the card carries that variation's own photo and price
   * instead of the parent product's cover image (which usually belongs to a
   * DIFFERENT variant — the parent image of tonik 0788 is actually طرح 08).
   */
  variant?: string | null
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

export type TrustedProductShowcase = ProductShowcase & {
  specs: string[]
  /** Stock badge derived from the variation when a specific variant was asked for. */
  badge?: string
  /** The exact variation this card represents (null = the product as a whole). */
  variation?: VariationRow | null
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
      const variant = typeof value.variant === 'string' ? value.variant.trim().slice(0, 80) : ''
      if (id || name) directives.push({ id: id || null, name, variant: variant || null })
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

// ─── Variation helpers ─────────────────────────────────────────────────────────
/** True when this variation can actually be bought right now. */
export function isVariationAvailable(variation: VariationRow): boolean {
  if (variation.manageStock) return (variation.stockQuantity ?? 0) > 0
  return variation.inStock !== false
}

/** Human label of a variation: its attribute values («طرح 05», «رنگ کرم»). */
export function variationLabel(variation: VariationRow): string {
  return Object.values(variation.attributes)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('، ')
}

function trailingNumber(value: string): number | null {
  const match = value.match(/(\d+)\s*$/)
  return match ? Number(match[1]) : null
}

/**
 * Find the variation a directive pointed at. Matching order:
 *   1. explicit variation id (from an id like «productId#v77651»);
 *   2. exact normalized label equality ("طرح 05" === "طرح 05");
 *   3. the hint's words appear in the value ("05" matches "طرح 05");
 *   4. the hint's trailing number equals the value's trailing number
 *      ("طرح 5" matches "طرح 05" — Persian users drop the leading zero).
 */
export function matchVariationRow(
  variations: VariationRow[],
  hint: { variationId?: number | null; label?: string | null },
): VariationRow | null {
  if (hint.variationId != null) {
    const byId = variations.find((variation) => variation.id === hint.variationId)
    if (byId) return byId
  }
  const label = (hint.label ?? '').trim()
  if (!label) return null
  const normalizedLabel = normalizedProductMention(label)
  if (!normalizedLabel) return null
  for (const variation of variations) {
    for (const value of Object.values(variation.attributes)) {
      const normalizedValue = normalizedProductMention(String(value))
      if (normalizedValue === normalizedLabel) return variation
      if (normalizedValue.split(' ').includes(normalizedLabel)) return variation
    }
  }
  const labelNumber = trailingNumber(normalizedLabel)
  if (labelNumber != null) {
    for (const variation of variations) {
      for (const value of Object.values(variation.attributes)) {
        const valueNumber = trailingNumber(normalizedProductMention(String(value)))
        if (valueNumber === labelNumber) return variation
      }
    }
  }
  return null
}

/** Specs of a variation card: its own attributes first, then the parent's. */
function variationSpecs(variation: VariationRow, parentAttributes: unknown): string[] {
  const rows: string[] = []
  const ownKeys = new Set(Object.keys(variation.attributes))
  for (const [label, value] of Object.entries(variation.attributes)) {
    const cleanLabel = cleanSpecPart(label, 28)
    const cleanValue = cleanSpecPart(String(value), 38)
    if (cleanLabel && cleanValue) rows.push(`${cleanLabel}: ${cleanValue}`)
  }
  for (const row of normalizeAttributes(parentAttributes)) {
    if (ownKeys.has(row.label)) continue
    const cleanLabel = cleanSpecPart(row.label, 28)
    const cleanValue = cleanSpecPart(row.value, 38)
    if (cleanLabel && cleanValue) rows.push(`${cleanLabel}: ${cleanValue}`)
  }
  return [...new Set(rows)].slice(0, 4)
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

  // Directive ids may carry a variation suffix («productId#v77651») emitted by
  // the deterministic variant showcase; the DB query must use the parent id.
  const directiveProductId = (directiveId: string): string => directiveId.split('#')[0]
  const directiveVariationId = (directiveId: string): number | null => {
    const suffix = directiveId.split('#')[1]
    if (!suffix) return null
    const numeric = /^v?(\d+)$/i.exec(suffix)
    return numeric ? Number(numeric[1]) : null
  }
  const parentIds = [...new Set(ids.map(directiveProductId))]
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
              ...(parentIds.length ? [{ id: { in: parentIds } }] : []),
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
      (directive.id ? byId.get(directiveProductId(directive.id)) : undefined) ??
      (directive.name ? byName.get(normalizedProductMention(directive.name)) : undefined)
    if (!product) continue

    // A variation-suffixed id or an explicit variant label means this card is
    // for ONE specific variant: use that variation's own image/price/name so
    // «0788 طرح 05» shows طرح 05's photo, not the parent cover (طرح 08's).
    const variations = extractTypedVariations(product.attributes)
    const variation = matchVariationRow(variations, {
      variationId: directive.id ? directiveVariationId(directive.id) : null,
      label: directive.variant ?? null,
    })
    const cardId = variation ? `${product.id}#v${variation.id}` : product.id
    if (seen.has(cardId)) continue
    seen.add(cardId)

    if (!variation) {
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
        variation: null,
      })
      continue
    }

    output.push({
      id: cardId,
      name: `${product.name} — ${variationLabel(variation)}`,
      description: product.description,
      price: variation.price ?? product.price,
      imageUrl: safeProductUrl(variation.image ?? null) ?? pickTemplateImageUrl(product.images),
      productUrl: safeProductUrl(product.externalUrl),
      specs: variationSpecs(variation, product.attributes),
      badge: isVariationAvailable(variation) ? 'موجود' : 'ناموجود',
      variation,
    })
  }

  // A generic card and a variation card of the SAME product never coexist in
  // one reply: when the customer picked a specific variant («0788 طرح 05»),
  // the model's plain marker for the product and the hint-driven identified
  // directive both resolve — keep the specific one, drop the parent cover.
  const variationParentIds = new Set(
    output
      .filter((card) => card.variation)
      .map((card) => card.id.split('#')[0]),
  )
  return output.filter((card) => card.variation || !variationParentIds.has(card.id))
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
  /**
   * The singular variant the customer named in THIS message («0788 طرح 05» →
   * «05»). Applied to the identified directives so their card shows that
   * variation's own photo, price and stock — deterministically, even when
   * the model omitted the "variant" field from its marker.
   */
  identifiedVariantHint?: string | null
}): Promise<string> {
  const subject = (params.subjectPhrase ?? '').trim()
  const parsed = parseProductDirectives(params.raw)
  const preferredDirectives = [...new Set(params.preferredProductIds ?? [])]
    .slice(0, MAX_PRODUCTS_PER_REPLY)
    .map((id) => ({ id, name: '' }))
  const identifiedDirectives = [...new Set(params.identifiedProductIds ?? [])]
    .slice(0, MAX_PRODUCTS_PER_REPLY)
    .map((id) => ({ id, name: '', variant: params.identifiedVariantHint ?? null }))
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
  // replies into product dumps. Variation cards carry a «#v<id>»-suffixed id —
  // compare against the parent id so they keep matching their directive.
  const parentId = (id: string) => id.split('#')[0]
  const explicitlyResolved = new Set(products
    .filter((product) => parsed.directives.some((directive) =>
      directive.id === parentId(product.id) || (
        directive.name && (
          normalizedProductMention(directive.name) === normalizedProductMention(product.name) ||
          normalizedProductMention(product.name).startsWith(`${normalizedProductMention(directive.name)} —`)
        )
      ),
    ))
    .map((product) => product.id))
  const preferredIds = new Set(preferredDirectives.map((directive) => directive.id))
  const identifiedIds = new Set(identifiedDirectives.map((directive) => directive.id))
  const selectedProducts = params.forceShowcase
    ? products
    : products.filter((product) =>
      explicitlyResolved.has(product.id) ||
      (preferredIds.has(parentId(product.id)) && replyMentionsProduct(parsed.text, product.name)) ||
      identifiedIds.has(parentId(product.id)) ||
      // A directive that explicitly named a variant («0788 طرح 05») resolves
      // to a variation card even though its plain product id was preferred.
      (parsed.directives.some((directive) => directive.variant && directive.id === parentId(product.id)) &&
        product.variation != null),
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
      badge: product.badge ?? (params.isFa ? 'موجود' : 'Available'),
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

// ─── Variant vitrine ──────────────────────────────────────────────────────────
/** Dominant attribute key of a variation list («طرح», «رنگ», …). */
function variationNoun(variations: VariationRow[], isFa: boolean): string {
  const counts = new Map<string, number>()
  for (const variation of variations) {
    for (const key of Object.keys(variation.attributes)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const dominant = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ''
  if (!isFa) return 'variant'
  if (/طرح/.test(dominant)) return 'طرح'
  if (/رنگ/.test(dominant)) return 'رنگ'
  return 'تنوع'
}

/** Natural (numeric-aware) order so «طرح 02» sorts before «طرح 10». */
function sortVariationsByLabel(variations: VariationRow[]): VariationRow[] {
  return [...variations].sort((left, right) =>
    variationLabel(left).localeCompare(variationLabel(right), 'fa', { numeric: true }),
  )
}

/**
 * Deterministic reply for «کاتالوگ طرح‌های دیگشو میفرستی» — a vitrine of the
 * in-stock variations of the product under discussion. Every card carries the
 * variation's OWN photo, price and stock, so the customer finally sees the
 * variety instead of a vector search's random products.
 *
 * candidateRefs are most-recent-first: product ids (possibly «id#v123» from
 * earlier variation cards) and bare product codes («0788»). The first ref
 * that resolves to an assigned, active product WITH variations is the target.
 *
 * Returns null when no ref resolves or the target has no variations at all —
 * the caller then falls back to the ordinary showcase/consultation flow.
 */
export async function buildVariantShowcaseReply(params: {
  workspaceId: string
  agentId: string
  isFa: boolean
  candidateRefs: string[]
}): Promise<string | null> {
  const refs = params.candidateRefs
    .map((ref) => ref.trim())
    .filter(Boolean)
    .slice(0, 12)
  if (!refs.length) return null

  const productIds = [...new Set(
    refs
      .filter((ref) => !/^\d+$/.test(ref.split('#')[0]))
      .map((ref) => ref.split('#')[0]),
  )]
  const codes = [...new Set(refs.filter((ref) => /^\d{3,8}$/.test(ref)))]
  if (!productIds.length && !codes.length) return null

  const rows = await prisma.agentCatalog.findMany({
    where: {
      agentId: params.agentId,
      product: {
        workspaceId: params.workspaceId,
        active: true,
        OR: [
          ...(productIds.length ? [{ id: { in: productIds } }] : []),
          ...codes.flatMap((code) => [
            { sku: { contains: code } },
            { name: { contains: code } },
          ]),
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
          sku: true,
          attributes: true,
        },
      },
    },
    take: 40,
  })
  const rowByProductId = new Map(rows.map(({ product }) => [product.id, product]))
  const rowByCode = new Map<string, typeof rows[number]['product']>()
  for (const code of codes) {
    for (const { product } of rows) {
      if (product.sku?.includes(code) || product.name.includes(code)) {
        if (!rowByCode.has(code)) rowByCode.set(code, product)
      }
    }
  }

  // First resolvable ref (most recent reference wins) that has variations.
  let target: typeof rows[number]['product'] | null = null
  for (const ref of refs) {
    const row = rowByProductId.get(ref.split('#')[0]) ?? rowByCode.get(ref) ?? null
    if (row && extractTypedVariations(row.attributes).length > 0) {
      target = row
      break
    }
    // Remember the first resolvable row so an «all out of stock» variant list
    // can still produce an honest text reply below.
    if (row && !target) target = row
  }
  if (!target) return null

  const variations = extractTypedVariations(target.attributes)
  if (!variations.length) return null
  const available = sortVariationsByLabel(variations.filter(isVariationAvailable))
  const noun = variationNoun(variations, params.isFa)
  const name = target.name

  if (!available.length) {
    return params.isFa
      ? `فعلاً همهٔ ${noun}های «${name}» ناموجود شده‌اند. مدل مشابه دیگری معرفی کنم؟`
      : `All ${noun}s of “${name}” are currently out of stock. Would you like me to suggest a similar model?`
  }

  const shown = available.slice(0, MAX_PRODUCTS_PER_REPLY)
  const count = shown.length
  const markers = shown.map((variation) => `[[product:${JSON.stringify({
    id: `${target.id}#v${variation.id}`,
    name: `${name} — ${variationLabel(variation)}`,
    price: (variation.price ?? target.price) == null
      ? ''
      : params.isFa
        ? `${(variation.price ?? target.price)!.toLocaleString('fa-IR')} تومان`
        : (variation.price ?? target.price)!.toLocaleString('en-US'),
    desc: cleanProductDescription(target.description, 240),
    badge: params.isFa ? 'موجود' : 'Available',
    image: safeProductUrl(variation.image ?? null) ?? safeProductUrl(pickTemplateImageUrl(target.images)) ?? '',
    url: safeProductUrl(target.externalUrl) ?? '',
    specs: variationSpecs(variation, target.attributes),
  })}]]`)

  const intro = params.isFa
    ? count === 1
      ? [
          `فعلاً فقط یک ${noun} از «${name}» موجود است؛ عکس و قیمتش را در کارت زیر می‌بینید.`,
          'اگر مدل دیگری هم خواستید، بگویید.',
        ].join('\n')
      : [
          `${count.toLocaleString('fa-IR')} ${noun} موجودِ «${name}» را برایتان فرستادم؛ عکس، قیمت و موجودی هر ${noun} روی کارت خودش هست.`,
          available.length > shown.length
            ? `${available.length.toLocaleString('fa-IR')} ${noun} موجود بود و ${count.toLocaleString('fa-IR')} تای اول را فرستادم — بگویید تا بقیه را هم بفرستم.`
            : `کدام ${noun} را می‌خواهید؟`,
        ].join('\n')
    : count === 1
      ? [
          `Only one ${noun} of “${name}” is currently available; its photo and price are on the card below.`,
          'Tell me if you would like another model.',
        ].join('\n')
      : [
          `I sent you the ${count} available ${noun}s of “${name}”; each card shows that ${noun}'s own photo, price and stock.`,
          available.length > shown.length
            ? `There are ${available.length} available ${noun}s in total — say the word and I will send the rest too.`
            : `Which ${noun} would you like?`,
        ].join('\n')

  return [intro, markers.join('\n')].filter(Boolean).join('\n\n')
}
