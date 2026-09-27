import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

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
