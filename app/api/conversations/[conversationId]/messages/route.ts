import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ conversationId: string }> }

/**
 * GET — lightweight message history for a conversation.
 *
 * Used by the dashboard conversation thread's polling loop to detect new
 * visitor messages (and messages from other operator tabs) without a full
 * page refresh. Authenticated via session cookie; workspace-scoped so a user
 * can only poll their own workspace's conversations.
 *
 * Query: ?since=<messageId> — when provided, messages after the stable
 * (createdAt, id) cursor are returned. The id tie-breaker prevents messages
 * sharing one timestamp from being skipped. When omitted, the last 100
 * messages are returned.
 *
 * Returns: { messages: [{ id, role, content, createdAt, contentType, metadata }] }
 */
export async function GET(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Verify the conversation belongs to the user's workspace.
  const url = new URL(_req.url)
  const sinceId = url.searchParams.get('since')

  // Resolve the workspace-owned cursor to a stable timestamp/id pair.
  let sinceCursor: { createdAt: Date; id: string } | null = null
  if (sinceId) {
    sinceCursor = await prisma.message.findFirst({
      where: {
        id: sinceId,
        conversationId: params.conversationId,
        conversation: { workspaceId: user.workspaceId },
      },
      select: { id: true, createdAt: true },
    })
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: {
      id: true,
      messages: {
        orderBy: sinceCursor
          ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
          : [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        take: 100,
        where: sinceCursor
          ? {
              OR: [
                { createdAt: { gt: sinceCursor.createdAt } },
                { createdAt: sinceCursor.createdAt, id: { gt: sinceCursor.id } },
              ],
            }
          : undefined,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          contentType: true,
          metadata: true,
        },
      },
    },
  })
  if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const orderedMessages = sinceCursor ? conversation.messages : conversation.messages.reverse()
  const messages = orderedMessages
    .filter((m) => {
      if (m.role !== 'SYSTEM') return true
      const metadata = m.metadata as Record<string, unknown> | null
      return Boolean(metadata?.vigentoActivity)
    })
    .map((m) => ({
      id: m.id,
      role: m.role,
      // Keep canonical product markers for the shared conversation renderer.
      // Machine syntax is removed visually by the renderer, not destructively
      // at the API boundary, so rich cards survive polling and refreshes.
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      contentType: m.contentType,
      metadata: m.metadata as Record<string, unknown> | null,
    }))

  return NextResponse.json({ messages })
}
