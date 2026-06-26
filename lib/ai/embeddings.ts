import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getWorkspaceOpenRouterKey } from '@/lib/ai/openrouter'

/** Fixed embedding dimension — must match the vector(1536) schema column. */
export const EMBED_DIM = 1536

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

/** Embed a single string using the workspace's OpenRouter key. */
export async function embedText(
  text: string,
  workspaceId: string,
): Promise<number[]> {
  const ctx = await getEmbedContext(workspaceId)
  const [vec] = await callEmbeddings(ctx, [text])
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
