import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { startsNewSession, type SessionMessage } from './session'

export type ConversationSession = { start: SessionMessage; asOf: Date; asOfId?: string; restarted: boolean }

export function sessionMessageWhere(session: ConversationSession): Prisma.MessageWhereInput {
  const startAt = new Date(session.start.createdAt)
  return { AND: [
    { createdAt: { lte: session.asOf } },
    ...(session.asOfId ? [{ OR: [{ createdAt: { lt: session.asOf } }, { createdAt: session.asOf, id: { lte: session.asOfId } }] }] : []),
    { OR: [
      { createdAt: { gt: startAt } },
      { createdAt: startAt, id: { gte: session.start.id } },
    ] },
  ] }
}

/** Scan timestamps only; never load the content of an expired session. */
export async function loadConversationSession(
  conversationId: string,
  options: { inboundEventId?: string; now?: Date; pendingInbound?: boolean } = {},
): Promise<ConversationSession> {
  const anchor = options.inboundEventId ? await prisma.message.findFirst({
    where: { conversationId, inboundEventId: options.inboundEventId, role: 'USER' },
    select: { id: true, role: true, createdAt: true },
  }) : null
  const asOf = anchor?.createdAt ?? options.now ?? new Date()
  // An unpersisted web/API inbound is already the next user turn for purposes
  // of detecting inactivity. Its actual persisted timestamp will be newer.
  let newer: SessionMessage | undefined = anchor ?? (options.pendingInbound === false ? undefined : { id: '', role: 'USER', createdAt: asOf })
  let cursor: { id: string; createdAt: Date } | undefined
  while (true) {
    const rows = await prisma.message.findMany({
      where: { AND: [
        { conversationId, role: { in: ['USER', 'ASSISTANT'] }, createdAt: { lte: asOf } },
        ...(anchor ? [{ OR: [{ createdAt: { lt: asOf } }, { createdAt: asOf, id: { lte: anchor.id } }] }] : []),
        ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
      ] },
      select: { id: true, role: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 256,
    })
    for (const row of rows) {
      if (newer && startsNewSession(row, newer)) return { start: newer, asOf, asOfId: anchor?.id, restarted: true }
      newer = row
    }
    if (rows.length < 256) return { start: newer ?? { id: '', role: 'USER', createdAt: asOf }, asOf, asOfId: anchor?.id, restarted: false }
    cursor = rows[rows.length - 1]
  }
}
