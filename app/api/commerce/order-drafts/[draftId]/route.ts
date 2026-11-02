import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { REQUEST_CLOSED_STATUSES } from '@/lib/commerce/request-states'

type Params = { params: Promise<{ draftId: string }> }

// Operators move a filed pre-order to its final state after arranging payment.
const patchSchema = z.object({ status: z.enum(['CONFIRMED', 'CANCELLED']) })

export async function PATCH(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })

  const updated = await prisma.orderDraft.updateMany({
    where: { id: params.draftId, workspaceId: user.workspaceId, status: 'SUBMITTED' },
    data: { status: parsed.data.status, resolvedAt: new Date() },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/**
 * Trashes a closed pre-order from «درخواست‌ها» (undo for a few minutes,
 * purged after 7 days). An open one is still a live cart in its chat: it is
 * cancelled first.
 */
export async function DELETE(_req: Request, props: Params) {
  const { draftId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const draft = await prisma.orderDraft.findFirst({ where: { id: draftId, workspaceId: user.workspaceId }, select: { id: true, status: true } })
  if (!draft) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (!(REQUEST_CLOSED_STATUSES as readonly string[]).includes(draft.status)) return NextResponse.json({ error: 'OPEN' }, { status: 409 })
  await prisma.orderDraft.deleteMany({ where: { id: draft.id, workspaceId: user.workspaceId, status: { in: [...REQUEST_CLOSED_STATUSES] } } })
  return NextResponse.json({ ok: true, ids: [draft.id] })
}
