import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getWorkspaceOpenRouterKey } from '@/lib/ai/openrouter'
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
}

async function getEmbedContext(workspaceId: string): Promise<EmbedContext> {
  const [key, ws] = await Promise.all([
    getWorkspaceOpenRouterKey(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { defaultEmbedModel: true },
    }),
  ])
  if (!key) throw new Error('NO_OPENROUTER_KEY')
  return { key, model: ws?.defaultEmbedModel ?? 'text-embedding-3-small' }
}

async function callEmbeddings(
  ctx: EmbedContext,
  input: string[],
): Promise<number[][]> {
  const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
      'X-Title': 'Vigent',
    },
    body: JSON.stringify({ model: ctx.model, input }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Embeddings failed (${res.status}): ${body}`)
  }
  const json = await res.json()
  // OpenAI-compatible response: { data: [{ embedding: number[], index }] }
  const sorted = (json.data ?? []).sort(
    (a: { index: number }, b: { index: number }) => a.index - b.index,
  )
  return sorted.map((d: { embedding: number[] }) => d.embedding)
}

/** Embed a single string using the workspace's OpenRouter key (Redis-cached). */
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
