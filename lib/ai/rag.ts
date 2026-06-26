import { embedText } from '@/lib/ai/embeddings'
import { retrieveChunks, type RetrievedChunk } from '@/lib/knowledge/vector-store'
import type { ChatMessage } from '@/lib/ai/openrouter'

export interface RagContext {
  contextText: string
  chunks: RetrievedChunk[]
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

/**
 * Assemble the message list for the model: the agent's system prompt,
 * retrieved context, prior history, and the new user message.
 */
export function buildMessages(params: {
  systemPrompt: string
  language: string
  contextText: string
  history: ChatMessage[]
  userMessage: string
}): ChatMessage[] {
  const langLine =
    params.language === 'fa'
      ? 'به زبان فارسی پاسخ بده.'
      : 'Respond in English.'

  const contextBlock = params.contextText
    ? `\n\nاطلاعات مرتبط از پایگاه دانش (در صورت مرتبط بودن از آن استفاده کن):\n${params.contextText}`
    : ''

  const system: ChatMessage = {
    role: 'system',
    content: `${params.systemPrompt}\n\n${langLine}${contextBlock}`,
  }

  return [
    system,
    ...params.history,
    { role: 'user', content: params.userMessage },
  ]
}
