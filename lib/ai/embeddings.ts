import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { getRedis } from '@/lib/redis'
import { redisUnderMemoryPressure } from '@/lib/redis-memory'

/** Fixed embedding dimension — must match the vector(1536) schema column. */
export const EMBED_DIM = 1536

// Query embeddings repeat a lot (the same customer questions recur across
// conversations), and an embedding is a pure function of (model, text). Cache
// them in Redis to cut embedding cost and latency. Fails open on any Redis error.
//
// TTL is 24 hours rather than 7 days because each cached entry is ~30 KB (1536
// floats × ~20 bytes JSON-encoded), and on busy multi-tenant installs the
// `emb:` keyspace was pushing Redis to its maxmemory limit — causing OOM
// errors on the woo-webhook queue (HTTP 503 QUEUE_UNAVAILABLE). 24h retains
// the high-value query cache (questions recur within a day) while keeping
// Redis memory bounded.
//
// The cache shares the `noeviction` Redis that BullMQ lives on, so it must
// never be what fills it: a full Redis refuses the webhook enqueue and inbound
// customer messages are dropped. Two guards keep it bounded:
//   - entries are stored as base64 float32 (~8 KB) instead of JSON (~32 KB).
//     pgvector stores float4 anyway, so no precision the search uses is lost.
//   - writes are skipped while Redis is under memory pressure.
const EMBED_CACHE_TTL = 24 * 60 * 60 // 24 hours
const F32_PREFIX = 'f32:'

function embedCacheKey(model: string, text: string): string {
  const hash = crypto.createHash('sha1').update(text).digest('hex')
  return `emb:${model}:${hash}`
}

export function encodeCachedEmbedding(vec: number[]): string {
  const bytes = Buffer.allocUnsafe(vec.length * 4)
  for (let i = 0; i < vec.length; i++) bytes.writeFloatLE(vec[i], i * 4)
  return F32_PREFIX + bytes.toString('base64')
}

export function decodeCachedEmbedding(raw: string): number[] | null {
  if (!raw.startsWith(F32_PREFIX)) {
    // Entries written before the compact encoding are plain JSON arrays.
    const vec = JSON.parse(raw)
    return Array.isArray(vec) ? vec : null
  }
  const bytes = Buffer.from(raw.slice(F32_PREFIX.length), 'base64')
  if (bytes.length === 0 || bytes.length % 4 !== 0) return null
  const vec = new Array<number>(bytes.length / 4)
  for (let i = 0; i < vec.length; i++) vec[i] = bytes.readFloatLE(i * 4)
  return vec
}

async function getCachedEmbedding(key: string): Promise<number[] | null> {
  try {
    const raw = await getRedis().get(key)
    if (!raw) return null
    return decodeCachedEmbedding(raw)
  } catch {
    return null
  }
}

function setCachedEmbedding(key: string, vec: number[]): void {
  void (async () => {
    if (await redisUnderMemoryPressure()) return
    await getRedis().set(key, encodeCachedEmbedding(vec), 'EX', EMBED_CACHE_TTL)
  })().catch(() => {
    // ignore — caching is best-effort
  })
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
