/**
 * Tool-calling catalog search — the model's own lookup, alongside (never
 * instead of) the deterministic regex planner.
 *
 * The planner handles the common turns deterministically and cheaply. Some
 * requests it cannot express: budgets («زیر ۱۵ میلیون»), superlatives
 * («ارزون‌ترین میز»), or phrasings whose lexical search came back empty. On
 * exactly those turns the reply model gets two read-only tools and decides
 * itself what to search. Grounding is unchanged: the tools only read the
 * agent's assigned, active catalog, and every row a tool returns is added to
 * the turn's trusted product set before card hydration and guards run.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { chatCompletion, type ChatMessage, type ChatTool, type ChatUsage } from '@/lib/ai/openrouter'
import type { CatalogProduct } from '@/lib/ai/rag'
import { extractProductTerms, normalizePersianText, PRODUCT_STOP_WORDS, tokenizeCatalogText, type ProductRequestPlan } from '@/lib/ai/conversation'
import { extractTypedVariations } from '@/lib/products/description'

const MAX_RESULTS = 10

// ─── Gate ───────────────────────────────────────────────────────────────────

/** «زیر ۲۰ میلیون»، «تا ۵۰۰ تومن»، «بودجه‌م ۱۰ میلیونه»، "under 200". */
export const PRICE_CONSTRAINT_RE =
  /(?:زیر|کمتر\s*از|ارزون\s*تر\s*از|ارزان\s*تر\s*از|تا|حداکثر|نهایتا|نهایتاً|بالای|بیشتر\s*از|حدود|بین|بودجه(?:[\s\u200c]*ا?م)?(?:\s*حدود)?)\s*[\d٫.,/]+\s*(?:میلیون|میلیون\s*تومن|هزار|تومن|تومان|تومنی|م(?:\s|$)|تا\s*[\d]+)|(?:under|below|less\s+than|up\s+to|max(?:imum)?|budget(?:\s+of)?)\s*\$?\s*\d/iu

/** «ارزون‌ترین»، «گرون‌ترین»، «پرفروش‌ترین»، "cheapest". */
export const SUPERLATIVE_RE =
  /(?:ارزون|ارزان|گرون|گران|بزرگ|کوچیک|کوچک|سبک|پرفروش|محبوب|جدید)[\s\u200c]*ترین|بهترین|(?:cheapest|most\s+expensive|best\s*sell(?:er|ing)|most\s+popular|newest)/iu

export type CatalogToolReason = 'EMPTY_RESULT' | 'PRICE_CONSTRAINT' | 'SUPERLATIVE'

/**
 * Which product turns get the tools. Deterministic flows that already work
 * (explicit vitrines with rows, variant pick/browse, code vitrines, cheaper
 * alternatives, comparisons, anaphora clarifications) keep their own path.
 */
export function catalogToolGate(params: {
  message: string
  plan: ProductRequestPlan
  catalogProducts: CatalogProduct[]
  productAccessEnabled: boolean
  hasActiveProduct: boolean
}): CatalogToolReason | null {
  if (process.env.CATALOG_TOOLS_DISABLED === '1' || !params.productAccessEnabled) return null
  const plan = params.plan
  if (plan.variantBrowse || plan.variantPick || plan.codeVariantVitrine || plan.cheaperAlternative
    || plan.comparisonConsult || plan.anaphoraConsult || plan.requestNewTopic || plan.advisoryConsult) return null
  const text = normalizePersianText(params.message)
  const productContext = plan.isProductTurn || Boolean(plan.semanticTurn) || Boolean(plan.analyzerTurn)
  if (PRICE_CONSTRAINT_RE.test(text) && (productContext || params.hasActiveProduct)) return 'PRICE_CONSTRAINT'
  if (SUPERLATIVE_RE.test(text) && (productContext || params.hasActiveProduct)) return 'SUPERLATIVE'
  if (productContext && params.catalogProducts.length === 0) return 'EMPTY_RESULT'
  return null
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const CATALOG_TOOLS: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_catalog',
      description: 'Search this store\'s product catalog. Use short product keywords in the customer\'s language (e.g. "میز تلویزیون", "پاف"). Returns matching products with exact prices and stock. Prices are in Toman.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product keywords only (type, model, material, color, size). Leave empty to browse by price only.' },
          max_price: { type: 'number', description: 'Upper price limit in Toman (e.g. 20 million = 20000000).' },
          min_price: { type: 'number', description: 'Lower price limit in Toman.' },
          in_stock_only: { type: 'boolean', description: 'Only products available right now. Default true.' },
          sort: { type: 'string', enum: ['relevance', 'price_asc', 'price_desc', 'popular'], description: 'Result order. Default relevance.' },
          limit: { type: 'number', description: 'Max results, 1-10. Default 6.' },
        },
        required: [],
      },
    },
  },
]

// ─── Tool execution ─────────────────────────────────────────────────────────

const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  images: true,
  externalUrl: true,
  attributes: true,
  tags: true,
  queryCount: true,
  sku: true,
  category: { select: { name: true } },
} satisfies Prisma.ProductSelect

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>

function isVariableSoldOut(row: ProductRow): boolean {
  const variations = extractTypedVariations(row.attributes)
  return variations.length > 0 && variations.every((variation) =>
    variation.manageStock ? (variation.stockQuantity ?? 0) <= 0 : variation.inStock === false)
}

function isAvailable(row: ProductRow): boolean {
  return row.stock !== 0 && !isVariableSoldOut(row)
}

function toCatalogProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    category: row.category?.name ?? null,
    image: row.images[0] ?? null,
    url: row.externalUrl,
    attributes: row.attributes,
    tags: row.tags,
    ...(isAvailable(row) ? {} : { unavailable: true }),
  }
}

function digitVariants(term: string): string[] {
  if (!/\d/.test(term)) return [term]
  return [...new Set([term, term.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])])]
}

/**
 * Whole-word (word-start) match: «مبل» must not match inside «جلومبلی», but
 * «میز» matches «میزهای» and Persian plural/suffix forms.
 */
function hasWord(text: string, token: string): boolean {
  return digitVariants(token).some((variant) => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}`, 'u').test(text)
  })
}

function queryTokens(query: string): string[] {
  const tokens = tokenizeCatalogText(query).filter((token) => !PRODUCT_STOP_WORDS.has(token))
  return [...new Set(tokens)].slice(0, 6)
}

function numberArg(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[,،]/g, '')) : NaN
  return Number.isFinite(number) && number > 0 ? number : null
}

export async function searchCatalogTool(agentId: string, args: Record<string, unknown>): Promise<{ rows: ProductRow[]; total: number }> {
  const query = typeof args.query === 'string' ? args.query.slice(0, 120) : ''
  const tokens = queryTokens(query)
  const maxPrice = numberArg(args.max_price)
  const minPrice = numberArg(args.min_price)
  const inStockOnly = args.in_stock_only !== false
  const sort = typeof args.sort === 'string' ? args.sort : 'relevance'
  const limit = Math.min(MAX_RESULTS, Math.max(1, Math.round(numberArg(args.limit) ?? 6)))

  const tokenFilters: Prisma.ProductWhereInput[] = tokens.flatMap((token) => digitVariants(token).flatMap((variant) => [
    { name: { contains: variant, mode: 'insensitive' as const } },
    { description: { contains: variant, mode: 'insensitive' as const } },
    { sku: { contains: variant, mode: 'insensitive' as const } },
    { tags: { has: variant } },
    { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
  ]))
  const where: Prisma.ProductWhereInput = {
    active: true,
    catalogItems: { some: { agentId } },
    AND: [
      ...(tokenFilters.length ? [{ OR: tokenFilters }] : []),
      ...(inStockOnly ? [{ OR: [{ stock: null }, { stock: { gt: 0 } }] }] : []),
      ...(maxPrice ? [{ price: { lte: maxPrice } }] : []),
      ...(minPrice ? [{ price: { gte: minPrice } }] : []),
      ...(maxPrice || minPrice || sort === 'price_asc' || sort === 'price_desc' ? [{ price: { not: null } }] : []),
    ],
  }
  const rows = await prisma.product.findMany({ where, select: productSelect, take: 200, orderBy: { queryCount: 'desc' } })
  const scored = rows
    .filter((row) => !inStockOnly || !isVariableSoldOut(row))
    .map((row) => {
      const name = normalizePersianText(row.name).toLocaleLowerCase('fa')
      const meta = normalizePersianText(`${row.category?.name ?? ''} ${row.tags.join(' ')} ${row.sku ?? ''}`).toLocaleLowerCase('fa')
      const description = normalizePersianText(row.description ?? '').toLocaleLowerCase('fa')
      let score = 0
      let covered = 0
      for (const token of tokens) {
        if (hasWord(name, token)) { score += 3; covered += 1 }
        else if (hasWord(meta, token)) { score += 2; covered += 1 }
        else if (hasWord(description, token)) { score += 1; covered += 1 }
      }
      // Rows covering every keyword always outrank partial matches.
      if (tokens.length && covered === tokens.length) score += 10
      return { row, score }
    })
  scored.sort((left, right) => {
    if (sort === 'price_asc') return (left.row.price ?? Infinity) - (right.row.price ?? Infinity) || right.score - left.score
    if (sort === 'price_desc') return (right.row.price ?? 0) - (left.row.price ?? 0) || right.score - left.score
    if (sort === 'popular') return right.row.queryCount - left.row.queryCount || right.score - left.score
    return right.score - left.score || right.row.queryCount - left.row.queryCount
  })
  // Rows covering every keyword win outright. A price/popularity sort over
  // partial matches would crown «the cheapest item mentioning میز» — a
  // cushion cover whose description says «میز» — so ordered lists use full
  // matches only.
  const full = scored.filter((item) => item.score >= 10)
  const kept = tokens.length && full.length
    ? full
    : tokens.length && sort !== 'relevance'
      ? []
      : scored
  return { rows: kept.slice(0, limit).map((item) => item.row), total: kept.length }
}

// ─── Budget / sort parsing (server-side guarantees) ─────────────────────────

const UNIT_MULTIPLIER: Array<[RegExp, number]> = [
  [/^(?:میلیون|میلیونی|م)$/u, 1_000_000],
  [/^(?:هزار|هزاری|k)$/iu, 1_000],
  [/^(?:تومن|تومان|تومنی)$/u, 1],
]

function amount(value: string, unit: string | undefined): number | null {
  const number = Number(value.replace(/[,،٬]/g, '').replace('٫', '.').replace('/', '.'))
  if (!Number.isFinite(number) || number <= 0) return null
  const multiplier = UNIT_MULTIPLIER.find(([pattern]) => pattern.test(unit ?? ''))?.[1]
  if (multiplier == null) return null
  const total = number * multiplier
  // «زیر ۱۰ تومن» is colloquial for thousands; never trust tiny totals.
  return total >= 10_000 ? total : null
}

/**
 * Budget stated in the message, in Toman. The planner model also proposes
 * price limits, but these parsed limits are enforced on every search, so a
 * model that forgets max_price can never surface an over-budget product.
 */
export function parseBudget(message: string): { maxPrice: number | null; minPrice: number | null } {
  const text = normalizePersianText(message).replace(/‌/g, ' ')
  const unit = '(میلیون|میلیونی|هزار|هزاری|تومن|تومان|تومنی|م)(?:ه)?(?=\\s|$|[.،,؟?])'
  const num = '(\\d+(?:[.,٫/]\\d+)?)'
  const between = text.match(new RegExp(`بین\\s*${num}\\s*(?:${unit})?\\s*(?:و|تا)\\s*${num}\\s*${unit}`, 'u'))
  if (between) {
    const upperUnit = between[4]
    return { minPrice: amount(between[1], between[2] ?? upperUnit), maxPrice: amount(between[3], upperUnit) }
  }
  const max = text.match(new RegExp(`(?:زیر|کمتر\\s*از|تا|حداکثر|نهایتا|نهایتاً|سقف|بودجه(?:\\s*ا?م)?(?:\\s*(?:حدود|تا))?)\\s*${num}\\s*${unit}`, 'u'))
  const min = text.match(new RegExp(`(?:بالای|بیشتر\\s*از|حداقل|از)\\s*${num}\\s*${unit}\\s*(?:به\\s*بالا|بیشتر)?`, 'u'))
  return {
    maxPrice: max ? amount(max[1], max[2]) : null,
    minPrice: min && !max ? amount(min[1], min[2]) : null,
  }
}

function sortHint(message: string): 'price_asc' | 'price_desc' | 'popular' | null {
  const text = normalizePersianText(message).replace(/‌/g, ' ')
  if (/(?:ارزون|ارزان|اقتصادی)\s*ترین|cheapest/iu.test(text)) return 'price_asc'
  if (/(?:گرون|گران|لوکس)\s*ترین|most\s+expensive/iu.test(text)) return 'price_desc'
  if (/(?:پرفروش|محبوب|پرطرفدار)\s*ترین|best\s*sell|most\s+popular/iu.test(text)) return 'popular'
  return null
}

function toman(value: number, isFa: boolean): string {
  return isFa ? `${value.toLocaleString('fa-IR')} تومان` : `${value.toLocaleString('en-US')} Toman`
}

// ─── Planner ────────────────────────────────────────────────────────────────

export interface CatalogSearchPlan {
  /** Rows that satisfy every stated constraint — the turn's trusted catalog. */
  products: CatalogProduct[]
  /** Per-turn instruction for the reply model (inserted before the turn marker). */
  instruction: string
  /** Provider usage of the planner call (null when it fell back). */
  usage: ChatUsage | null
  /** The model planned the searches (false = deterministic fallback). */
  modelPlanned: boolean
}

function plannerTranscript(history: ChatMessage[], message: string): string {
  const recent = history
    .filter((item) => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-4)
    .map((item) => `${item.role === 'user' ? 'مشتری' : 'فروشنده'}: ${String(item.content).replace(/\[\[product:[^\n]*?\]\]/g, '').replace(/\s+/g, ' ').slice(0, 280)}`)
  return [...recent, `پیام فعلی مشتری: ${message.slice(0, 400)}`].join('\n')
}

const PLANNER_SYSTEM = `You plan product searches for an online store's chat assistant. Read the conversation and call search_catalog one to three times to find what the customer is asking for right now.
- query: short product keywords in the customer's language (product type + distinctive words such as model, size, color). Resolve references like "همون"/"این" from the conversation.
- Budgets are in Toman: «۱۰ میلیون» = 10000000, «۵۰۰ هزار» = 500000. «زیر/تا/حداکثر X» → max_price; «بالای/حداقل X» → min_price.
- «ارزون‌ترین» → sort price_asc; «گرون‌ترین» → price_desc; «پرفروش‌ترین/محبوب‌ترین» → popular.
- If the first wording may miss, add one more call with a synonym or the broader product type.
Only call the tool; do not write a reply.`

/**
 * One compact function-calling round: the model turns the customer's words
 * into structured searches; the server enforces the parsed budget/sort,
 * executes them against the agent's assigned catalog, and hands the rows to
 * the ordinary reply pipeline (streaming, product cards, guards) together
 * with a precise instruction. Returns null when there is nothing to add.
 */
export async function planCatalogSearch(params: {
  agentId: string
  /** When set, the planner call is recorded in the usage log (platform budget). */
  workspaceId?: string
  conversationId?: string
  model: string
  message: string
  history: ChatMessage[]
  reason: CatalogToolReason
  isFa: boolean
}): Promise<CatalogSearchPlan | null> {
  const budget = parseBudget(params.message)
  const sort = sortHint(params.message)
  let usage: ChatUsage | null = null
  let calls: Array<Record<string, unknown>> = []
  try {
    const result = await chatCompletion({
      model: params.model,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        { role: 'user', content: plannerTranscript(params.history, params.message) },
      ],
      temperature: 0,
      maxTokens: 300,
      tools: CATALOG_TOOLS,
      toolChoice: 'auto',
    })
    usage = result.usage
    if (params.workspaceId) recordPlannerUsage(params.workspaceId, params.agentId, params.conversationId, params.model, result.usage)
    calls = result.toolCalls
      .filter((call) => call.function.name === 'search_catalog')
      .slice(0, 3)
      .flatMap((call) => {
        try { return [JSON.parse(call.function.arguments || '{}') as Record<string, unknown>] } catch { return [] }
      })
  } catch {
    // Provider without tool support: the deterministic query below still runs.
  }
  const modelPlanned = calls.length > 0
  if (!modelPlanned) calls = [{ query: extractProductTerms(params.message).join(' ') }]

  const found = new Map<string, ProductRow>()
  for (const call of calls) {
    const args: Record<string, unknown> = { ...call, in_stock_only: call.in_stock_only !== false }
    if (budget.maxPrice && (numberArg(args.max_price) == null || numberArg(args.max_price)! > budget.maxPrice)) args.max_price = budget.maxPrice
    if (budget.minPrice && (numberArg(args.min_price) == null || numberArg(args.min_price)! < budget.minPrice)) args.min_price = budget.minPrice
    if (!budget.maxPrice && numberArg(args.max_price) != null && params.reason !== 'PRICE_CONSTRAINT') delete args.max_price
    if (sort) args.sort = sort
    // Superlatives are about what can be bought now.
    if (sort === 'price_asc' || sort === 'price_desc') args.in_stock_only = true
    const { rows } = await searchCatalogTool(params.agentId, args)
    for (const row of rows) if (!found.has(row.id)) found.set(row.id, row)
  }
  let rows = [...found.values()]
  // Budgets and superlatives are about the product the customer named: a
  // side table is not «a coffee table under 10 million». Rows must cover the
  // subject keywords of the first planned search.
  // An empty-result rescue may use synonyms, so a row qualifies by covering
  // every word of ANY planned query — never by a substring of another word.
  const rowText = (row: ProductRow) => normalizePersianText(`${row.name} ${row.category?.name ?? ''} ${row.tags.join(' ')}`).toLocaleLowerCase('fa')
  const plannedQueries = calls.map((call) => queryTokens(typeof call.query === 'string' ? call.query : '')).filter((tokens) => tokens.length)
  const subject = plannedQueries[0] ?? []
  if (params.reason !== 'EMPTY_RESULT' && subject.length) {
    rows = rows.filter((row) => subject.every((token) => hasWord(rowText(row), token)))
  } else if (plannedQueries.length) {
    rows = rows.filter((row) => plannedQueries.some((tokens) => tokens.every((token) => hasWord(rowText(row), token))))
  }
  if (budget.maxPrice) rows = rows.filter((row) => row.price != null && row.price <= budget.maxPrice!)
  if (budget.minPrice) rows = rows.filter((row) => row.price != null && row.price >= budget.minPrice!)
  if (sort === 'price_asc') rows.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  if (sort === 'price_desc') rows.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
  rows = rows.slice(0, 6)

  const isFa = params.isFa
  if (rows.length) {
    const lines: string[] = []
    if (budget.maxPrice || budget.minPrice) {
      const range = [budget.minPrice ? (isFa ? `از ${toman(budget.minPrice, true)}` : `from ${toman(budget.minPrice, false)}`) : '', budget.maxPrice ? (isFa ? `تا ${toman(budget.maxPrice, true)}` : `up to ${toman(budget.maxPrice, false)}`) : ''].filter(Boolean).join(' ')
      lines.push(isFa
        ? `مشتری بودجهٔ ${range} گفته. ردیف‌های کاتالوگ این نوبت با جست‌وجوی دقیق پیدا شده‌اند و همه واقعاً در این بودجه‌اند. ۲ یا ۳ مورد مناسب را با قیمت دقیق و یک دلیل کوتاه معرفی کن؛ محصولی بیرون از این ردیف‌ها نام نبر.`
        : `The customer's budget is ${range}. This turn's catalog rows come from an exact search and all really fit that budget. Present 2–3 suitable ones with exact prices and one short reason; name no product outside these rows.`)
    }
    if (sort === 'price_asc') {
      lines.push(isFa
        ? 'ردیف اول ارزان‌ترین مورد موجودِ مرتبط است؛ همان را صریح به‌عنوان ارزان‌ترین معرفی کن و حداکثر یک گزینهٔ بعدی بگو. از مدل‌های ناموجود حرف نزن.'
        : 'The first row is the cheapest available match; present it clearly as the cheapest and mention at most one next option. Do not mention sold-out models.')
    } else if (sort === 'price_desc') {
      lines.push(isFa ? 'ردیف اول گران‌ترین مورد موجودِ مرتبط است؛ همان را معرفی کن.' : 'The first row is the most expensive available match; present it.')
    } else if (sort === 'popular') {
      lines.push(isFa ? 'ردیف‌ها به ترتیب محبوبیت‌اند؛ پرطرفدارترین را اول بگو.' : 'Rows are ordered by popularity; lead with the most popular.')
    }
    lines.push(isFa
      ? 'مثل یک پیام دایرکت بنویس: بدون فهرست بولت‌دار و بدون بولد.'
      : 'Write like a direct message: no bullet lists, no bold.')
    if (params.reason === 'EMPTY_RESULT') {
      lines.push(isFa
        ? 'جست‌وجوی تکمیلی این ردیف‌ها را پیدا کرد؛ فقط اگر واقعاً با خواستهٔ مشتری جورند معرفی کن، وگرنه صادقانه بگو دقیقاً همین را نداریم و نزدیک‌ترین را پیشنهاد بده.'
        : 'A broader search found these rows; present them only if they genuinely match the request, otherwise say honestly we do not have exactly that and suggest the closest.')
    }
    return {
      products: rows.map(toCatalogProduct),
      instruction: `\n\n=== ${isFa ? 'نتیجهٔ جست‌وجوی دقیق کاتالوگ' : 'Exact catalog search'} ===\n${lines.join('\n')}`,
      usage,
      modelPlanned,
    }
  }

  // Nothing fits the budget: say so honestly and give the real entry price
  // as text only (a card for an over-budget item reads like a bait offer).
  if (budget.maxPrice || budget.minPrice) {
    const query = typeof calls[0]?.query === 'string' ? calls[0].query : extractProductTerms(params.message).join(' ')
    const { rows: reference } = await searchCatalogTool(params.agentId, { query, sort: 'price_asc', in_stock_only: true, limit: 1 })
    const cheapest = reference[0]
    const limit = budget.maxPrice ? toman(budget.maxPrice, isFa) : toman(budget.minPrice!, isFa)
    const instruction = isFa
      ? `\n\n=== نتیجهٔ جست‌وجوی دقیق کاتالوگ ===\nدر بودجهٔ مشتری (${limit}) هیچ محصول موجودِ مطابقی در کاتالوگ نیست. کوتاه و صادقانه همین را بگو${cheapest?.price != null ? `؛ برای راهنمایی بگو ارزان‌ترین مورد مرتبطِ موجود «${cheapest.name}» با قیمت ${toman(cheapest.price, true)} است (فقط در متن؛ برایش کارت محصول نساز)` : ''} و فقط یک سؤال بپرس: بودجه کمی قابل تغییر است یا دنبال محصول دیگری است؟ هیچ محصولی بیرون از این اطلاعات نام نبر.`
      : `\n\n=== Exact catalog search ===\nNo available product matching the request fits the customer's budget (${limit}). Say so briefly and honestly${cheapest?.price != null ? `; for orientation mention that the cheapest available related item is “${cheapest.name}” at ${toman(cheapest.price, false)} (text only; no product card)` : ''}, and ask one question: is the budget flexible, or are they after something else? Name no other product.`
    return { products: [], instruction, usage, modelPlanned }
  }
  return null
}

/**
 * The planner is a platform-funded auxiliary call on the reply model (like the
 * turn analyzer): it is not a tenant charge, but its cost must reach the usage
 * log so the monthly platform budget guard sees it.
 */
function recordPlannerUsage(
  workspaceId: string,
  agentId: string,
  conversationId: string | undefined,
  model: string,
  usage: ChatUsage,
): void {
  void Promise.resolve()
    .then(() => prisma.usageLog.create({
      data: {
        workspaceId,
        agentId,
        conversationId: conversationId ?? null,
        type: 'SUMMARY',
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        reasoningTokens: usage.reasoningTokens,
        cachedTokens: usage.cachedTokens,
        providerRequestId: usage.providerRequestId,
        cost: usage.costUSD,
      },
    }))
    .catch(() => {})
}

/** Per-turn blocks go before the turn marker so the stable prefix stays cached. */
export function insertBeforeTurnMarker(content: string, block: string): string {
  const marker = content.search(/\n\n=== (?:دستور همین نوبت|Instruction for this turn) ===/u)
  return marker === -1 ? `${content}${block}` : `${content.slice(0, marker)}${block}${content.slice(marker)}`
}
