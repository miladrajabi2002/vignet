import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { getRedis } from '@/lib/redis'

/** Fixed embedding dimension — must match the vector(1536) schema column. */
export const EMBED_DIM = 1536

// Query embeddings repeat a lot (the same customer questions recur across
// conversations), and an embedding is a pure function of (model, text). Cache
// them in Redis to cut embedding cost and latency. Fails open on any Redis error.
const EMBED_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days

function embedCacheKey(model: string, text: string): string {
  const hash = crypto.createHash('sha1').update(text).digest('hex')
  return `emb:${model}:${hash}`
}

async function getCachedEmbedding(key: string): Promise<number[] | null> {
  try {
    const raw = await getRedis().get(key)
    if (!raw) return null
    const vec = JSON.parse(raw)
    return Array.isArray(vec) ? vec : null
  } catch {
    return null
  }
}

function setCachedEmbedding(key: string, vec: number[]): void {
  try {
    void getRedis().set(key, JSON.stringify(vec), 'EX', EMBED_CACHE_TTL)
  } catch {
    // ignore — caching is best-effort
  }
}

interface EmbedContext {
  key: string
  model: string
  workspaceId: string
}

async function getEmbedContext(workspaceId: string): Promise<EmbedContext> {
  const [key, ws] = await Promise.all([
    Promise.resolve(getPlatformOpenRouterKey()),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { defaultEmbedModel: true },
    }),
  ])
  if (!key) throw new Error('PLATFORM_AI_NOT_CONFIGURED')
  return {
    key,
    model: ws?.defaultEmbedModel ?? 'openai/text-embedding-3-small',
    workspaceId,
  }
}

async function callEmbeddings(
  ctx: EmbedContext,
  input: string[],
): Promise<number[][]> {
  const { getPlatformCommercialConfig } = await import('@/lib/platform/commercial-config')
  const runtime = await getPlatformCommercialConfig()
  const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
      'X-Title': 'Vigent',
    },
    body: JSON.stringify({
      model: ctx.model,
      input,
      // Keep the provider response compatible with the pgvector column.
      dimensions: EMBED_DIM,
      provider: {
        data_collection: 'deny',
        zdr: runtime.zeroDataRetention,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    throw new Error(`OPENROUTER_EMBEDDING_${res.status}`)
  }
  const json = await res.json()
  const rawCost = Number(json.usage?.cost)
  await prisma.usageLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      type: 'EMBEDDING',
      model: ctx.model,
      promptTokens: Number(json.usage?.prompt_tokens) || 0,
      providerRequestId: typeof json.id === 'string' ? json.id : null,
      cost: Number.isFinite(rawCost) ? rawCost : null,
    },
  }).catch((error) => console.error('[embeddings] usage log failed:', error))
  // OpenAI-compatible response: { data: [{ embedding: number[], index }] }
  const sorted = (json.data ?? []).sort(
    (a: { index: number }, b: { index: number }) => a.index - b.index,
  )
  return sorted.map((d: { embedding: number[] }) => d.embedding)
}

/** Embed a single string using Vigent's platform key (Redis-cached). */
export async function embedText(
  text: string,
  workspaceId: string,
): Promise<number[]> {
  const ctx = await getEmbedContext(workspaceId)

  const cacheKey = embedCacheKey(ctx.model, text)
  const cached = await getCachedEmbedding(cacheKey)
  if (cached) return cached

  const [vec] = await callEmbeddings(ctx, [text])
  setCachedEmbedding(cacheKey, vec)
  return vec
}

/** Embed many strings in one request. */
export async function embedTexts(
  texts: string[],
  workspaceId: string,
): Promise<number[][]> {
  if (texts.length === 0) return []
  const ctx = await getEmbedContext(workspaceId)
  return callEmbeddings(ctx, texts)
}
