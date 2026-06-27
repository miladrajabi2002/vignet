import { embedText } from '@/lib/ai/embeddings'
import { retrieveChunks, type RetrievedChunk } from '@/lib/knowledge/vector-store'
import type { ChatMessage } from '@/lib/ai/openrouter'

export interface RagContext {
  contextText: string
  chunks: RetrievedChunk[]
}

export interface CatalogProduct {
  id: string
  name: string
  description: string | null
  price: number | null
  stock: number | null
  category: string | null
}

/** Embed the user query and retrieve the most relevant knowledge chunks. */
export async function retrieveContext(params: {
  workspaceId: string
  agentId: string
  query: string
  limit?: number
}): Promise<RagContext> {
  let chunks: RetrievedChunk[] = []
  try {
    const queryEmbedding = await embedText(params.query, params.workspaceId)
    chunks = await retrieveChunks({
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      queryEmbedding,
      limit: params.limit ?? 5,
    })
  } catch (e) {
    // If embeddings/retrieval fail (e.g. no key yet), answer without context.
    console.error('[rag] retrieval failed:', e)
  }

  const contextText = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n')

  return { contextText, chunks }
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US').replace(/,/g, '،') + ' تومان'
}

function buildCatalogBlock(products: CatalogProduct[], isFa: boolean): string {
  if (products.length === 0) return ''

  const lines = products.map((p, i) => {
    const parts: string[] = [`نام: ${p.name}`]
    if (p.price != null) parts.push(`قیمت: ${formatPrice(p.price)}`)
    if (p.category) parts.push(`دسته‌بندی: ${p.category}`)
    if (p.description) parts.push(`توضیحات: ${p.description.slice(0, 300)}`)
    if (p.stock != null) {
      parts.push(p.stock > 0 ? `موجودی: ${p.stock} عدد` : 'موجودی: ناموجود')
    }
    return `${i + 1}. ${parts.join(' | ')}`
  })

  if (isFa) {
    return `

=== کاتالوگ محصولات ===
${lines.join('\n')}
======================
قوانین اجباری:
• برای قیمت‌ها و مشخصات، فقط و فقط از کاتالوگ بالا استفاده کن
• هرگز قیمت را حدس نزن یا از دانش عمومی خود استفاده نکن
• اگر محصولی در کاتالوگ نبود، بگو: "اطلاعات این محصول را ندارم"
• موجودی "ناموجود" را صادقانه اعلام کن`
  } else {
    return `

=== Product Catalog ===
${lines.join('\n')}
======================
Mandatory rules:
• For prices and specs, ONLY use the catalog above — never your general knowledge
• If a product is not listed, say: "I don't have information about this product"
• Report out-of-stock honestly`
  }
}

/**
 * Assemble the message list for the model: the agent's system prompt,
 * retrieved context, prior history, and the new user message.
 */
export function buildMessages(params: {
  systemPrompt: string
  language: string
  contextText: string
  catalogProducts: CatalogProduct[]
  history: ChatMessage[]
  userMessage: string
}): ChatMessage[] {
  const isFa = params.language === 'fa'

  const langLine = isFa ? 'به زبان فارسی پاسخ بده.' : 'Respond in English.'

  // Tone: warm and concise, not robotic
  const toneInstruction = isFa
    ? 'لحنت صمیمی، مختصر و انسانی باشد — مثل یک فروشنده حرفه‌ای، نه ربات. از جملات کوتاه و روشن استفاده کن.'
    : 'Be warm, concise and human — like a professional salesperson, not a robot. Use short, clear sentences.'

  const catalogBlock = buildCatalogBlock(params.catalogProducts, isFa)

  const contextBlock = params.contextText
    ? isFa
      ? `\n\nاطلاعات تکمیلی از پایگاه دانش:\n${params.contextText}`
      : `\n\nAdditional context from knowledge base:\n${params.contextText}`
    : ''

  const system: ChatMessage = {
    role: 'system',
    content: `${params.systemPrompt}\n\n${langLine} ${toneInstruction}${catalogBlock}${contextBlock}`,
  }

  return [
    system,
    ...params.history,
    { role: 'user', content: params.userMessage },
  ]
}
