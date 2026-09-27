import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ alertId: string }> }

// «پیگیری شد» after a manual call, or cancel a waiting alert.
const patchSchema = z.object({ status: z.enum(['NOTIFIED', 'CANCELLED']) })

export async function PATCH(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })

  const updated = await prisma.restockAlert.updateMany({
    where: { id: params.alertId, workspaceId: user.workspaceId, status: { in: ['ACTIVE', 'NEEDS_FOLLOW_UP'] } },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === 'NOTIFIED' ? { notifiedAt: new Date(), lastError: 'MANUAL_FOLLOW_UP' } : {}),
    },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
