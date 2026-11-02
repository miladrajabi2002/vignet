/**
 * Product judge: the model reads the customer's request and the catalog rows
 * the search found, and says which of them are really what the customer
 * means — or that none is.
 *
 * The searches are lexical (a word inside a name, tag or description), so a
 * word that also appears in an unrelated row pulls that row in: «طی کلیپسی»
 * (a hair claw clip) found a hair-styling set whose description mentions
 * clips, «مینی» found a face shaver and two big air fryers, and «رژ لب ویولت
 * ۴۴۶» found a mascara. Ranking by covered words cannot tell these apart;
 * reading can. One short call on product turns with competing rows only.
 */
import { auxCompletion, type TurnLedger } from '@/lib/ai/llm/aux'
import type { CatalogProduct } from '@/lib/ai/rag'
import { extractTypedVariations } from '@/lib/products/description'

/** Rows shown to the judge; the searches rarely return more worth reading. */
const MAX_CANDIDATES = 12

export type ProductJudgeKind = 'exact' | 'similar' | 'none'

export interface ProductJudgement {
  kind: ProductJudgeKind
  /** Ids of the rows that fit, best first. */
  ids: string[]
}

const SYSTEM = `You match a customer's product request in an Iranian online shop to catalog rows. You never answer the customer.
Read the request (Persian, colloquial, typos, Finglish, brand or model names in Latin letters) and the numbered rows.
Return ONLY JSON: {"kind":"exact|similar|none","rows":[row numbers, best first, at most 5]}
- exact: the rows ARE what the customer named or clearly described (same product type; same brand/model/code/shade when they named one). A row whose variant list contains the colour/shade/number they asked for counts, even if that variant is out of stock.
- similar: nothing is exactly that, but some rows are the same TYPE of product and a fair alternative (e.g. another model of the same appliance, another shade of the same lipstick).
- none: no row is that type of product. A row is never a match only because one word of the request appears in its description (a hair-styling set is not a hair clip; a face shaver is not a mini coffee machine; a mascara is not a lipstick).
Brand and type must agree when the customer named them. Prefer in-stock rows among equals. Never list a row of a different product type.`

function rowLine(product: CatalogProduct, index: number): string {
  const variants = extractTypedVariations(product.attributes)
    .slice(0, 12)
    .map((variation) => Object.values(variation.attributes ?? {}).join('/'))
    .filter(Boolean)
  const stock = product.unavailable || product.stock === 0 ? 'ناموجود' : 'موجود'
  const description = (product.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140)
  return [
    `${index + 1}. ${product.name}`,
    product.category ? `دسته: ${product.category}` : '',
    product.price != null ? `قیمت: ${product.price}` : '',
    stock,
    variants.length ? `تنوع: ${variants.join('، ')}` : '',
    description ? `توضیح: ${description}` : '',
  ].filter(Boolean).join(' | ')
}

/**
 * Null when the judge could not run (no key, timeout, malformed answer): the
 * caller keeps the search result exactly as it was.
 */
export async function judgeCatalogCandidates(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  ledger?: TurnLedger | null
  message: string
  searchTerms: string[]
  candidates: CatalogProduct[]
}): Promise<ProductJudgement | null> {
  const candidates = params.candidates.slice(0, MAX_CANDIDATES)
  if (!candidates.length) return null
  const user = [
    `Customer message: ${params.message.slice(0, 400)}`,
    params.searchTerms.length ? `Product words understood: ${params.searchTerms.join(' | ')}` : '',
    'Rows:',
    ...candidates.map(rowLine),
  ].filter(Boolean).join('\n')
  try {
    const result = await auxCompletion({
      purpose: 'product_judge',
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      conversationId: params.conversationId,
      ledger: params.ledger,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
      responseFormat: 'json_object',
      temperature: 0,
      maxTokens: 120,
      timeoutMs: 6_000,
      retries: 0,
    })
    const parsed = JSON.parse(String(result.content ?? '').replace(/^```json\s*|```$/g, '')) as { kind?: string; rows?: unknown }
    const kind: ProductJudgeKind | null = parsed.kind === 'exact' || parsed.kind === 'similar' || parsed.kind === 'none' ? parsed.kind : null
    if (!kind) return null
    const rows = Array.isArray(parsed.rows) ? parsed.rows : []
    const ids = [...new Set(rows
      .map((row) => Number(row))
      .filter((row) => Number.isInteger(row) && row >= 1 && row <= candidates.length)
      .map((row) => candidates[row - 1].id))]
      .slice(0, 5)
    if (kind !== 'none' && !ids.length) return null
    return { kind, ids: kind === 'none' ? [] : ids }
  } catch {
    return null
  }
}

/**
 * Apply a judgement to the search result: the chosen rows in the judge's
 * order; similar rows are marked as close alternatives so the reply says
 * «دقیقاً همین را نداریم، نزدیک‌ترینش…»; none empties the list so the reply
 * says it was not found instead of presenting unrelated cards.
 */
export function applyProductJudgement(products: CatalogProduct[], judgement: ProductJudgement | null): CatalogProduct[] {
  if (!judgement) return products
  if (judgement.kind === 'none') return []
  const byId = new Map(products.map((product) => [product.id, product]))
  const chosen = judgement.ids
    .map((id) => byId.get(id))
    .filter((product): product is CatalogProduct => Boolean(product))
  if (!chosen.length) return products
  return judgement.kind === 'similar'
    ? chosen.map((product) => ({ ...product, nearMatch: true, fullTermMatch: false }))
    : chosen
}
