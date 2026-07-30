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
    select: {
      id: true,
      metadata: true,
      status: true,
      handedOff: true,
      workspaceId: true,
      agentId: true,
      channel: true,
      summary: true,
      contact: { select: { name: true, phone: true } },
      agent: { select: { name: true, language: true } },
    },
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
    existing.metadata &&
    typeof existing.metadata === 'object' &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {}
  const {
    aiPaused: _p,
    pausedAt: _t,
    pausedBy: _b,
    controlMode: _m,
    controlChangedAt: _c,
    controlChangedBy: _u,
    ...restMeta
  } = prevMeta
  void _p
  void _t
  void _b
  void _m
  void _c
  void _u

  const changedAt = new Date()
  const controlMetadata: Prisma.InputJsonValue = mode === 'AI'
    ? {
        ...restMeta,
        controlMode: 'AI',
        controlChangedAt: changedAt.toISOString(),
        controlChangedBy: user.id,
      }
    : {
        ...prevMeta,
        aiPaused: true,
        pausedAt: changedAt.toISOString(),
        pausedBy: user.id,
        controlMode: 'OPERATOR',
        controlChangedAt: changedAt.toISOString(),
        controlChangedBy: user.id,
      }

  const conversation = await prisma.$transaction(async (tx) => {
    if (mode === 'AI') {
      const resumed = await tx.conversation.update({
        where: { id: existing.id },
        data: {
          status: 'OPEN',
          handedOff: false,
          metadata: controlMetadata,
        },
        select: { id: true, status: true, handedOff: true, metadata: true },
      })
      await tx.handoffAlert.updateMany({
        where: {
          conversationId: existing.id,
          state: { in: ['open', 'claimed'] },
        },
        data: { state: 'resolved', resolvedAt: changedAt },
      })
      return resumed
    }

    // The conditional update is the idempotency gate: concurrent/retried
    // operator switches cannot create duplicate alerts or notifications.
    const claimed = await tx.conversation.updateMany({
      where: {
        id: existing.id,
        OR: [{ status: { not: 'HANDED_OFF' } }, { handedOff: false }],
      },
      data: {
        status: 'HANDED_OFF',
        handedOff: true,
        metadata: controlMetadata,
      },
    })

    if (claimed.count === 1) {
      const english = existing.agent.language.toLowerCase().startsWith('en')
      const reason = english
        ? 'Manually switched to operator-only mode'
        : 'تغییر دستی گفتگو به حالت فقط اپراتور'
      await tx.handoffAlert.create({
        data: {
          workspaceId: existing.workspaceId,
          conversationId: existing.id,
          agentId: existing.agentId,
          contactName: existing.contact?.name ?? null,
          contactPhone: existing.contact?.phone ?? null,
          channel: existing.channel,
          reason,
          summary: existing.summary,
          state: 'claimed',
          claimedBy: user.id,
        },
      })
      await tx.notification.create({
        data: {
          workspaceId: existing.workspaceId,
          type: 'HANDOFF',
          title: english ? 'Operator-only mode enabled' : 'حالت فقط اپراتور فعال شد',
          body: english
            ? `${existing.agent.name} has stepped aside for this conversation.`
            : `${existing.agent.name} در این گفتگو دیگر پاسخ خودکار نمی‌دهد.`,
          link: `/conversations/${existing.id}`,
        },
      })
    }

    return tx.conversation.findUniqueOrThrow({
      where: { id: existing.id },
      select: { id: true, status: true, handedOff: true, metadata: true },
    })
  })

  return NextResponse.json({ conversation })
}
