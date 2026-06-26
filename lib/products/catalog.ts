import { prisma } from '@/lib/prisma'
import { embedText } from '@/lib/ai/embeddings'
import { insertChunk, deleteChunksForProduct } from '@/lib/knowledge/vector-store'

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

/** Build a rich, embeddable text representation of a product (Persian). */
export function buildProductText(p: ProductWithCategory): string {
  const lines = [
    `محصول: ${p.name}`,
    p.category ? `دسته‌بندی: ${p.category.name}` : '',
    p.price != null ? `قیمت: ${p.price.toLocaleString('fa-IR')} تومان` : '',
    p.comparePrice != null
      ? `قیمت اصلی: ${p.comparePrice.toLocaleString('fa-IR')} تومان`
      : '',
    p.stock != null
      ? `موجودی: ${p.stock > 0 ? `${p.stock} عدد` : 'ناموجود'}`
      : 'موجودی: نامحدود',
    p.sku ? `کد محصول (SKU): ${p.sku}` : '',
    `توضیحات: ${p.description || 'ندارد'}`,
    p.tags.length ? `تگ‌ها: ${p.tags.join('، ')}` : '',
    p.attributes ? `مشخصات: ${JSON.stringify(p.attributes)}` : '',
  ]
  return lines.filter(Boolean).join('\n').trim()
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
    return
  }

  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    include: { category: { select: { name: true } } },
  })
  if (!product) return

  const text = buildProductText(product)

  for (const agentId of agentIds) {
    const kb = await getOrCreateProductKB(agentId, product.workspaceId)
    await deleteChunksForProduct(agentId, product.id)
    const embedding = await embedText(text, product.workspaceId)
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
