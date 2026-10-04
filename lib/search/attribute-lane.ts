import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Catalog rows whose identity OR attribute/variation values carry the terms.
 *
 * The Prisma lanes of the catalog search only look at name, description,
 * SKU, tags and category: a cream «مانتو» whose colour lives only in its
 * WooCommerce variations («رنگ: کرم») never entered the candidate pool of a
 * large catalog, so «مانتو کرم» answered with whichever مانتو were most
 * popular. This lane reads the attribute JSON as text in PostgreSQL.
 *
 *   mode 'all' — every term matches name/SKU/tags/category/attributes
 *                (description stays out: a coincidental word in prose
 *                must not make a row «exact»);
 *   mode 'any' — any attribute-word term matches the attribute values.
 *
 * Digit-only terms (product codes) never match attribute text, whose
 * variation SKUs and prices would match them by accident.
 */
export async function attributeLaneIds(params: {
  agentId: string
  terms: string[]
  mode: 'all' | 'any'
  availableOnly?: boolean
  limit?: number
}): Promise<string[]> {
  const terms = [...new Set(params.terms.map((term) => term.trim()).filter((term) => term.length >= 2))].slice(0, 6)
  if (!terms.length) return []
  const pattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
  const isCode = (term: string) => /^\d+$/.test(term)
  const termMatch = (term: string) => isCode(term)
    ? Prisma.sql`(p."name" ILIKE ${pattern(term)} OR COALESCE(p."sku", '') ILIKE ${pattern(term)})`
    : Prisma.sql`(
        p."name" ILIKE ${pattern(term)}
        OR COALESCE(p."sku", '') ILIKE ${pattern(term)}
        OR array_to_string(p."tags", ' ') ILIKE ${pattern(term)}
        OR COALESCE(c."name", '') ILIKE ${pattern(term)}
        OR COALESCE(p."attributes"::text, '') ILIKE ${pattern(term)}
      )`
  const attributeTerms = terms.filter((term) => !isCode(term))
  if (params.mode === 'any' && !attributeTerms.length) return []
  const condition = params.mode === 'all'
    ? Prisma.join(terms.map(termMatch), ' AND ')
    : Prisma.sql`(${Prisma.join(attributeTerms.map((term) => Prisma.sql`COALESCE(p."attributes"::text, '') ILIKE ${pattern(term)}`), ' OR ')})`
  const stock = params.availableOnly ? Prisma.sql`AND (p."stock" IS NULL OR p."stock" > 0)` : Prisma.empty
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p."id"
      FROM "Product" p
      JOIN "AgentCatalog" ac ON ac."productId" = p."id" AND ac."agentId" = ${params.agentId}
      LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
      WHERE p."active" = true AND p."deletedAt" IS NULL ${stock}
        AND ${condition}
      ORDER BY p."queryCount" DESC, p."updatedAt" DESC
      LIMIT ${Math.min(80, Math.max(1, params.limit ?? 40))}`
    return rows.map((row) => row.id)
  } catch (error) {
    console.error('[search] attribute lane failed:', error)
    return []
  }
}
