import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { stripProductTokens } from '@/lib/widget/config'

type Params = { params: Promise<{ conversationId: string }> }

/**
 * GET — lightweight message history for a conversation.
 *
 * Used by the dashboard conversation thread's polling loop to detect new
 * visitor messages (and messages from other operator tabs) without a full
 * page refresh. Authenticated via session cookie; workspace-scoped so a user
 * can only poll their own workspace's conversations.
 *
 * Query: ?since=<messageId> — when provided, only messages with a createdAt
 * strictly greater than the given message's createdAt are returned. This
 * keeps the payload tiny on repeated polls. When omitted, the last 100
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

  // Resolve the `since` cursor to a createdAt timestamp (if provided).
  let sinceDate: Date | null = null
  if (sinceId) {
    const cursor = await prisma.message.findUnique({
      where: { id: sinceId },
      select: { createdAt: true },
    })
    sinceDate = cursor?.createdAt ?? null
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        where: sinceDate ? { createdAt: { gt: sinceDate } } : undefined,
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

  const messages = conversation.messages
    .filter((m) => {
      if (m.role !== 'SYSTEM') return true
      const metadata = m.metadata as Record<string, unknown> | null
      return Boolean(metadata?.vigentoActivity)
    })
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: stripProductTokens(m.content),
      createdAt: m.createdAt.toISOString(),
      contentType: m.contentType,
      metadata: m.metadata as Record<string, unknown> | null,
    }))

  return NextResponse.json({ messages })
}
