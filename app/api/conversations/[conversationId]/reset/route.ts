import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ conversationId: string }> }

const bodySchema = z.object({
  mode: z.enum(['AI', 'OPERATOR']),
})

/**
 * POST /api/conversations/:conversationId/reset — flip a conversation between
 * "smart reply" (AI) mode and "operator only" (human handoff) mode.
 *
 *   AI        → status: 'OPEN', handedOff: false, and clear the per-conversation
 *               `metadata.aiPaused` flag (set by STOP_AI scenarios) so the agent
 *               resumes replying on the next inbound.
 *
 *   OPERATOR  → status: 'HANDED_OFF', handedOff: true. The AI stays out of the
 *               thread; only operator replies (via /reply) reach the contact.
 *
 * Auth: the caller must own the workspace.
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const existing = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true, metadata: true },
  })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const mode = parsed.data.mode

  // For AI mode, strip the `aiPaused` / `pausedAt` keys from metadata so the
  // agent resumes replying. We shallow-merge to preserve any other metadata.
  const prevMeta =
    existing.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {}
  const { aiPaused: _p, pausedAt: _t, ...restMeta } = prevMeta
  void _p
  void _t

  const data: Prisma.ConversationUpdateInput =
    mode === 'AI'
      ? {
          status: 'OPEN',
          handedOff: false,
          metadata: restMeta as Prisma.InputJsonValue,
        }
      : { status: 'HANDED_OFF', handedOff: true }

  const conversation = await prisma.conversation.update({
    where: { id: params.conversationId },
    data,
    select: { id: true, status: true, handedOff: true, metadata: true },
  })

  return NextResponse.json({ conversation })
}
