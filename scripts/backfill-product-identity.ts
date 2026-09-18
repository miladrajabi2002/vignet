/**
 * One-time backfill: build compact IDENTITY chunks (semantic index v2) for
 * every assigned product of every workspace/agent. New/changed products get
 * theirs automatically from processProductEmbed afterwards — this script
 * only covers products embedded before the upgrade.
 *
 * Idempotent: a product/agent pair whose existing identity chunk content is
 * identical to the freshly built identity text is skipped.
 *
 * Usage: cd /var/www/vigent.ir/public/vignet && npx tsx -r dotenv/config scripts/backfill-product-identity.ts [--dry]
 */
import { PrismaClient } from '@prisma/client'
import { embedText } from '@/lib/ai/embeddings'
import { insertChunk, deleteChunksForProduct } from '@/lib/knowledge/vector-store'
import { buildProductIdentityText } from '@/lib/products/catalog'
import { invalidateAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'
import { normalizePersian } from '@/lib/knowledge/normalize'

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry')

interface Row {
  productId: string
  workspaceId: string
  name: string
  description: string | null
  sku: string | null
  tags: string[]
  attributes: unknown
  category: { name: string } | null
  agentId: string
}

async function main() {
  const rows: Row[] = await prisma.$queryRaw`
    SELECT p.id AS "productId", p."workspaceId", p.name, p.description, p.sku, p.tags,
           p.attributes, json_build_object('name', c.name) AS category, ac."agentId"
    FROM "Product" p
    JOIN "AgentCatalog" ac ON ac."productId" = p.id
    LEFT JOIN "ProductCategory" c ON c.id = p."categoryId"
    WHERE p.active = true
    ORDER BY p."updatedAt" DESC
  `
  console.log(`assigned product/agent pairs: ${rows.length}`)

  // existing identity chunks per agent for idempotency
  const existing = await prisma.knowledgeChunk.findMany({
    where: { metadata: { path: ['kind'], equals: 'identity' } },
    select: { agentId: true, content: true, metadata: true },
  })
  const existingMap = new Map<string, Set<string>>()
  for (const chunk of existing) {
    const meta = chunk.metadata as Record<string, unknown>
    const productId = typeof meta?.productId === 'string' ? meta.productId : null
    if (!productId) continue
    const set = existingMap.get(chunk.agentId) ?? new Set<string>()
    set.add(`${productId}::${chunk.content}`)
    existingMap.set(chunk.agentId, set)
  }
  console.log(`existing identity chunks: ${existing.length}`)

  const byProduct = new Map<string, Row[]>()
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? []
    list.push(row)
    byProduct.set(row.productId, list)
  }

  let embedded = 0
  let inserted = 0
  let skipped = 0
  let errors = 0
  const agentsSeen = new Set<string>()

  for (const [productId, agents] of byProduct) {
    const head = agents[0]
    const identityText = buildProductIdentityText({
      id: head.productId,
      workspaceId: head.workspaceId,
      name: head.name,
      description: head.description,
      price: null,
      comparePrice: null,
      sku: head.sku,
      stock: null,
      tags: head.tags,
      attributes: head.attributes,
      category: head.category,
    })
    const normalizedIdentity = normalizePersian(identityText)
    if (!identityText) {
      skipped++
      continue
    }
    // Skip pairs already carrying this exact identity chunk
    const needsWork = agents.filter(
      (a) => !(existingMap.get(a.agentId)?.has(`${productId}::${normalizedIdentity}`)),
    )
    if (needsWork.length === 0) {
      skipped += agents.length
      continue
    }

    let embedding: number[] | null = null
    if (!DRY) {
      try {
        embedding = await embedText(identityText, head.workspaceId)
        embedded++
      } catch (e) {
        console.error(`EMBED FAIL ${productId}: ${(e as Error).message}`)
        errors++
        continue
      }
    }

    for (const agent of needsWork) {
      if (DRY) {
        inserted++
        agentsSeen.add(agent.agentId)
        continue
      }
      try {
        // Replace any older identity chunk for this pair, keep the full-text chunk.
        await deleteChunksForProduct(agent.agentId, productId, 'identity')
        const kb = await prisma.knowledgeBase.findFirst({
          where: { agentId: agent.agentId, type: 'PRODUCT_CATALOG' },
          select: { id: true },
        })
        if (!kb) {
          console.warn(`no PRODUCT_CATALOG KB for agent ${agent.agentId} — run a product sync first`)
          continue
        }
        await insertChunk({
          kbId: kb.id,
          agentId: agent.agentId,
          workspaceId: agent.workspaceId,
          content: identityText,
          metadata: { productId, kind: 'identity', sku: head.sku },
          embedding: embedding as number[],
        })
        inserted++
        agentsSeen.add(agent.agentId)
      } catch (e) {
        console.error(`INSERT FAIL ${productId}/${agent.agentId}: ${(e as Error).message}`)
        errors++
      }
    }
    if (embedded > 0 && embedded % 50 === 0) console.log(`…progress: ${embedded} products embedded`)
  }

  // Refresh lexicons so intent detection sees any vocabulary deltas immediately
  if (!DRY) {
    for (const agentId of agentsSeen) invalidateAgentCatalogLexicon(agentId)
  }

  console.log('──────── BACKFILL SUMMARY ────────')
  console.log(`mode: ${DRY ? 'DRY RUN' : 'LIVE'}`)
  console.log(`products embedded: ${embedded} | identity chunks inserted: ${inserted} | pairs skipped (already ok): ${skipped} | errors: ${errors}`)
  console.log(`agents affected: ${agentsSeen.size}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('BACKFILL FAILED:', e)
  process.exit(1)
})
