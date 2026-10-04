import 'dotenv/config'
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { attributeLaneIds } from '@/lib/search/attribute-lane'
import { fetchCatalogProducts, tokenizeCatalogText } from '@/lib/ai/conversation'
import { runCatalogSearches, searchCatalogTool } from '@/lib/ai/catalog-tools'
import { emptyProductPlan } from '@/lib/agent/turn/route'
import { attributeValueText } from '@/lib/products/description'

// Explicit opt-in: needs a disposable PostgreSQL with every migration applied.
describe.skipIf(process.env.RUN_CATALOG_SEARCH_DB_TESTS !== '1')('catalog search against PostgreSQL', () => {
  let workspaceId = ''
  let agentId = ''
  const ids: Record<string, string> = {}
  let vocabulary = new Set<string>()

  beforeAll(async () => {
    const tag = crypto.randomUUID()
    workspaceId = (await prisma.workspace.create({ data: { name: 'Catalog search test', slug: `catalog-search-${tag}`, excludeFromAdminReports: true } })).id
    agentId = (await prisma.agent.create({ data: { workspaceId, name: 'Shop', systemPrompt: 'x' } })).id
    const make = async (key: string, data: { name: string; price: number; stock?: number | null; queryCount?: number; attributes?: object; description?: string }) => {
      const row = await prisma.product.create({ data: { workspaceId, ...data } })
      await prisma.agentCatalog.create({ data: { agentId, productId: row.id } })
      ids[key] = row.id
    }
    // The cream manteau's colour lives ONLY in its attributes/variations, and
    // it is the least popular row: the old lanes never saw it.
    await make('cream', {
      name: 'مانتو کتان بهاره', price: 1_900_000, queryCount: 0,
      attributes: {
        'رنگ': 'کرم, مشکی',
        _variations: [
          { id: 11, sku: '9001', price: 1_900_000, manageStock: true, stockQuantity: 3, attributes: { 'رنگ': 'کرم', 'سایز': 'M' } },
          { id: 12, sku: '9002', price: 1_900_000, manageStock: true, stockQuantity: 2, attributes: { 'رنگ': 'مشکی', 'سایز': 'L' } },
        ],
      },
    })
    await make('navy', { name: 'مانتو لینن', price: 2_100_000, queryCount: 500, attributes: { 'رنگ': 'سرمه‌ای' } })
    await make('jeans', { name: 'شلوار جین راسته', price: 1_200_000, queryCount: 5 })
    const fillers = Array.from({ length: 170 }, (_, index) => ({ workspaceId, name: `مانتو مجلسی مدل ${index + 1}`, price: 3_000_000, queryCount: 100 }))
    await prisma.product.createMany({ data: fillers })
    const fillerRows = await prisma.product.findMany({ where: { workspaceId, name: { startsWith: 'مانتو مجلسی' } }, select: { id: true } })
    await prisma.agentCatalog.createMany({ data: fillerRows.map((row) => ({ agentId, productId: row.id })) })
    const rows = await prisma.product.findMany({ where: { workspaceId }, select: { name: true, attributes: true } })
    vocabulary = new Set(rows.flatMap((row) => [...tokenizeCatalogText(row.name), ...tokenizeCatalogText(attributeValueText(row.attributes))]))
  }, 60_000)

  afterAll(async () => {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  it('the attribute lane finds a row by a colour that is only in its variations', async () => {
    expect(await attributeLaneIds({ agentId, terms: ['مانتو', 'کرم'], mode: 'all' })).toEqual([ids.cream])
    expect(await attributeLaneIds({ agentId, terms: ['کرم'], mode: 'any' })).toEqual([ids.cream])
    // Variation SKUs never match a code term through the attribute text.
    expect(await attributeLaneIds({ agentId, terms: ['9001'], mode: 'all' })).toEqual([])
  })

  it('«مانتو کرم» in a 170-row catalog ranks the cream manteau first', async () => {
    const plan = { ...emptyProductPlan(), isProductTurn: true, searchTerms: ['مانتو', 'کرم'], requestedCount: 5, inventoryMode: 'ANY' as const }
    const rows = await fetchCatalogProducts(agentId, [], plan, vocabulary)
    expect(rows[0]?.id).toBe(ids.cream)
  })

  it('the budget/sort search covers attribute words too', async () => {
    const { rows } = await searchCatalogTool(agentId, { query: 'مانتو کرم', in_stock_only: false })
    expect(rows[0]?.id).toBe(ids.cream)
  })

  it('a misspelled word is corrected against the catalog before searching', async () => {
    const call = { query: 'شلاور جین', max_price: 5_000_000 }
    const without = await runCatalogSearches({ agentId, message: 'شلاور جین زیر ۵ میلیون', calls: [call], reason: 'PRICE_CONSTRAINT', isFa: true, budget: { maxPrice: 5_000_000, minPrice: null }, sort: null })
    expect(without?.products.map((product) => product.id) ?? []).not.toContain(ids.jeans)
    const withVocabulary = await runCatalogSearches({ agentId, message: 'شلاور جین زیر ۵ میلیون', calls: [call], reason: 'PRICE_CONSTRAINT', isFa: true, budget: { maxPrice: 5_000_000, minPrice: null }, sort: null, vocabulary })
    expect(withVocabulary?.products.map((product) => product.id)).toContain(ids.jeans)
  })
})
