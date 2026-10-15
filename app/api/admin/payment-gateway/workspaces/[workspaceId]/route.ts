import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { isAdminAuthed } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { notifyWorkspace } from '@/lib/notifications/create'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ workspaceId: string }> }

const schema = z.object({
  // Pause the gateway of one business (abuse, disputes, a blocked card …); the reason is shown to the owner.
  suspend: z.union([z.object({ reason: z.string().trim().max(300).optional() }), z.literal(false)]).optional(),
  // Monthly confirmed payments: null = the plan's cap, -1 = unlimited.
  capOverride: z.number().int().min(-1).max(10_000_000).nullable().optional(),
  // The owner's own switch, for support.
  enabled: z.boolean().optional(),
})

export async function PATCH(req: Request, props: Params) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { workspaceId } = await props.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, payGatewaySuspendedAt: true } })
  if (!workspace) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const data: Prisma.WorkspaceUpdateInput = {}
  const { suspend, capOverride, enabled } = parsed.data
  if (suspend !== undefined) {
    data.payGatewaySuspendedAt = suspend ? new Date() : null
    data.payGatewaySuspendReason = suspend ? suspend.reason || null : null
  }
  if (capOverride !== undefined) data.payGatewayCapOverride = capOverride
  if (enabled !== undefined) data.payGatewayEnabled = enabled
  await prisma.workspace.update({ where: { id: workspaceId }, data })

  if (suspend !== undefined && Boolean(suspend) !== Boolean(workspace.payGatewaySuspendedAt)) {
    await notifyWorkspace({
      workspaceId,
      type: 'SYSTEM',
      title: suspend ? 'درگاه پرداخت شما موقتاً متوقف شد' : 'درگاه پرداخت شما دوباره فعال شد',
      body: suspend
        ? `تا رفع توقف، کارتی برای پرداخت فرستاده نمی‌شود.${suspend.reason ? ` دلیل: ${suspend.reason}` : ''} برای پیگیری با پشتیبانی ویجنت در تماس باشید.`
        : 'ایجنت از همین حالا دوباره کارت و مبلغ دقیق را برای مشتری‌ها می‌فرستد.',
      link: '/payments',
      operatorTelegram: 'payments',
    })
  }
  return NextResponse.json({ ok: true })
}
