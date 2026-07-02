import { prisma } from '@/lib/prisma'
import { dispatchIngestion } from '@/lib/queue/jobs'

/**
 * WordPress content sync (plugin `content.*` webhook topics).
 *
 * The Vigent WP plugin pushes posts/pages as clean text. Each published
 * post becomes one KnowledgeBase row per agent in the workspace (type TEXT,
 * keyed by the post permalink in `sourceUrl`) and is ingested through the
 * normal chunk/embed pipeline, so the agent can answer from site content
 * without a manual crawl.
 */

/** Name prefix marking knowledge synced from the WordPress plugin. */
export const WP_CONTENT_PREFIX = '🌐 '

export interface WpContentPayload {
  id?: number
  type?: string
  title?: string
  url?: string
  excerpt?: string
  content?: string
}

export async function handleWpContentWebhook(
  integration: { id: string; workspaceId: string },
  payload: { topic: string; data: unknown },
): Promise<void> {
  const { id: integrationId, workspaceId } = integration
  const topic = payload.topic
  const data = (payload.data ?? {}) as WpContentPayload

  try {
    let count = 0
    if (topic === 'content.updated' || topic === 'content.created') {
      count = await upsertContent(workspaceId, data)
    } else if (topic === 'content.deleted') {
      count = await deleteContent(workspaceId, data)
    } else {
      await writeLog(integrationId, workspaceId, 'error', 0, `Unknown content topic: ${topic}`)
      return
    }
    await writeLog(integrationId, workspaceId, 'ok', count, topic)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await writeLog(integrationId, workspaceId, 'error', 0, `${topic}: ${msg}`.slice(0, 1000))
    throw e
  }
}

async function upsertContent(
  workspaceId: string,
  data: WpContentPayload,
): Promise<number> {
  const url = (data.url ?? '').trim()
  const title = (data.title ?? '').trim()
  const content = (data.content ?? '').trim()
  if (!url || !content) return 0

  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    select: { id: true },
  })
  if (agents.length === 0) return 0

  const name = `${WP_CONTENT_PREFIX}${title || url}`.slice(0, 190)
  const text = [title, data.excerpt, content].filter(Boolean).join('\n\n')

  let count = 0
  for (const agent of agents) {
    const existing = await prisma.knowledgeBase.findFirst({
      where: { agentId: agent.id, sourceUrl: url, name: { startsWith: WP_CONTENT_PREFIX } },
      select: { id: true },
    })
    const kb = existing
      ? await prisma.knowledgeBase.update({
          where: { id: existing.id },
          data: { name, status: 'PENDING', errorMsg: null, lastIngestedAt: new Date() },
        })
      : await prisma.knowledgeBase.create({
          data: {
            agentId: agent.id,
            workspaceId,
            name,
            type: 'TEXT',
            sourceUrl: url,
            status: 'PENDING',
            lastIngestedAt: new Date(),
          },
        })
    await dispatchIngestion({ kbId: kb.id, text })
    count++
  }
  return count
}

async function deleteContent(
  workspaceId: string,
  data: WpContentPayload,
): Promise<number> {
  const url = (data.url ?? '').trim()
  if (!url) return 0

  const rows = await prisma.knowledgeBase.findMany({
    where: { workspaceId, sourceUrl: url, name: { startsWith: WP_CONTENT_PREFIX } },
    select: { id: true },
  })
  if (rows.length === 0) return 0

  const ids = rows.map((r) => r.id)
  await prisma.knowledgeChunk.deleteMany({ where: { kbId: { in: ids } } })
  await prisma.knowledgeBase.deleteMany({ where: { id: { in: ids } } })
  return rows.length
}

function writeLog(
  integrationId: string,
  workspaceId: string,
  outcome: 'ok' | 'error',
  count: number,
  message: string,
) {
  return prisma.storeSyncLog.create({
    data: {
      integrationId,
      workspaceId,
      direction: 'push',
      entity: 'content_update',
      outcome,
      count,
      message,
    },
  })
}
