import { prisma } from '@/lib/prisma'
import { embedText } from '@/lib/ai/embeddings'
import { insertChunk, deleteChunksForProduct } from '@/lib/knowledge/vector-store'
import { cleanDescriptionForChat } from '@/lib/products/description'

export interface ProductEmbedJobData {
  productId: string
  workspaceId: string
  /** Agents to (re)embed for; defaults to all agents that have the product. */
  agentIds?: string[]
  /** When true, remove the product's chunks instead of embedding. */
  deleted?: boolean
}

interface ProductWithCategory {
  id: string
  workspaceId: string
  name: string
  description: string | null
  price: number | null
  comparePrice: number | null
  sku: string | null
  stock: number | null
  tags: string[]
  attributes: unknown
  category: { name: string } | null
}

/**
 * Pull the `_variations` array out of a product's `attributes` JSON column.
 *
 * Variations are stashed under the `_variations` key by the WooCommerce ingest
 * (see lib/integrations/woocommerce.ts → mapWooProduct) so we don't need a
 * Prisma migration. Returns `null` when the attribute column doesn't carry
 * variations (e.g. simple products, manual products without variations, or
 * integrations that haven't been re-synced since v4.3.5).
 */
function extractVariations(attrs: unknown): Array<Record<string, unknown>> | null {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return null
  const obj = attrs as Record<string, unknown>
  const v = obj._variations
  if (!Array.isArray(v) || v.length === 0) return null
  return v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
}

/**
 * Build the semantic-search representation of a product (Persian).
 *
 * The text is what gets embedded into the vector store and what the RAG
 * retrieval matches against. It deliberately excludes volatile commercial
 * facts such as price and stock. After retrieval, chat loads those facts from
 * the live Product row, so embedding them here only makes routine inventory
 * updates expensive and leaves stale numbers inside vectors.
 *
 * For variable products we render each variation's attributes as a separate
 * line ("رنگ: آبی", "رنگ: سبز", …) so the embedding model sees each
 * color/size as a distinct semantic token, not as JSON noise. Empirically,
 * LLM embeddings match "آبی" much better against the literal phrase "رنگ:
 * آبی" than against `{"attributes":{"رنگ":"آبی"}}`.
 */
export function buildProductText(p: ProductWithCategory): string {
  // WooCommerce descriptions commonly contain HTML lists. Preserve their
  // label/value content as clean text so both exact Persian terms and semantic
  // meaning contribute to retrieval instead of embedding markup noise.
  const description = cleanDescriptionForChat(p.description, 4_000)

  // Split out `_variations` so it doesn't leak into the "مشخصات" line as JSON.
  // The remaining attributes (color list, size list, material, …) stay as a
  // clean `key: value` block.
  const variations = extractVariations(p.attributes)
  const publicAttrs: Record<string, unknown> = {}
  if (p.attributes && typeof p.attributes === 'object' && !Array.isArray(p.attributes)) {
    for (const [k, v] of Object.entries(p.attributes as Record<string, unknown>)) {
      if (k === '_variations') continue
      publicAttrs[k] = v
    }
  }

  const lines = [
    `محصول: ${p.name}`,
    p.category ? `دسته‌بندی: ${p.category.name}` : '',
    p.sku ? `کد محصول (SKU): ${p.sku}` : '',
    `توضیحات: ${description || 'ندارد'}`,
    p.tags.length ? `تگ‌ها: ${p.tags.join('، ')}` : '',
    Object.keys(publicAttrs).length > 0 ? `مشخصات: ${JSON.stringify(publicAttrs)}` : '',
  ].filter(Boolean)

  // Append each variation as its own line so the embedding model sees the
  // attribute values as natural-language tokens rather than JSON.
  //
  // Example output:
  //   تنوع: رنگ آبی، سایز XL
  //   تنوع: رنگ سبز، سایز L
  //
  // We cap at 60 variations to stay within the embedding model's context
  // window (8K tokens for text-embedding-3-small; 60 lines × ~30 tokens
  // = 1.8K, well under budget).
  if (variations) {
    const shown = variations.slice(0, 60)
    for (const v of shown) {
      const attrs = v.attributes
      const attrStr =
        attrs && typeof attrs === 'object' && !Array.isArray(attrs)
          ? Object.entries(attrs)
              .map(([k, val]) => `${k} ${String(val)}`)
              .join('، ')
          : ''
      if (!attrStr) continue
      lines.push(`تنوع: ${attrStr}`)
    }
    if (variations.length > shown.length) {
      lines.push(`(و ${variations.length - shown.length} تنوع دیگر)`)
    }
  }

  return lines.join('\n').trim()
}

/** Get (or create) the auto-managed PRODUCT_CATALOG knowledge base for an agent. */
async function getOrCreateProductKB(agentId: string, workspaceId: string) {
  const existing = await prisma.knowledgeBase.findFirst({
    where: { agentId, type: 'PRODUCT_CATALOG' },
  })
  if (existing) return existing
  return prisma.knowledgeBase.create({
    data: {
      agentId,
      workspaceId,
      name: 'کاتالوگ محصولات',
      type: 'PRODUCT_CATALOG',
      status: 'READY',
    },
  })
}

/**
 * Re-embed (or remove) a product across the agents that know about it.
 * Runs from the product-embed queue or inline.
 */
export async function processProductEmbed(
  data: ProductEmbedJobData,
): Promise<void> {
  const agentIds =
    data.agentIds ??
    (
      await prisma.agentCatalog.findMany({
        where: { productId: data.productId },
        select: { agentId: true },
      })
    ).map((a) => a.agentId)

  if (data.deleted) {
    for (const agentId of agentIds) {
      await deleteChunksForProduct(agentId, data.productId)
    }
    // WooCommerce deletions are soft deletes, so mark cleanup completion. If
    // enqueue/processing fails this remains null and the durable delivery retry
    // will schedule cleanup again.
    await prisma.product.updateMany({
      where: { id: data.productId },
      data: { embeddingUpdatedAt: new Date() },
    })
    return
  }

  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    include: { category: { select: { name: true } } },
  })
  if (!product) return

  const text = buildProductText(product)
  if (agentIds.length === 0) {
    await prisma.product.update({
      where: { id: product.id },
      data: { embeddingUpdatedAt: new Date() },
    })
    return
  }
  // The product representation is identical for every assigned agent. Generate
  // the vector once, then reuse it in each agent-scoped chunk; this avoids one
  // paid embedding request per agent during large catalog syncs.
  const embedding = await embedText(text, product.workspaceId)

  for (const agentId of agentIds) {
    const kb = await getOrCreateProductKB(agentId, product.workspaceId)
    await deleteChunksForProduct(agentId, product.id)
    await insertChunk({
      kbId: kb.id,
      agentId,
      workspaceId: product.workspaceId,
      content: text,
      metadata: { productId: product.id, sku: product.sku, price: product.price },
      embedding,
    })
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { embeddingUpdatedAt: new Date() },
  })
}
