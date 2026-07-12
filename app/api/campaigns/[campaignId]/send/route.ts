import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchCampaign } from '@/lib/queue/jobs'
import { rateLimit } from '@/lib/ratelimit'

type Params = { params: Promise<{ campaignId: string }> }

const confirmSchema = z.object({
  confirm: z.literal(true),
  expectedRecipientCount: z.number().int().min(1).max(500),
})

/** Explicit, count-bound confirmation. DRAFT -> QUEUED is atomic/idempotent. */
export async function POST(req: Request, props: Params) {
  const { campaignId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit(`campaign-send:${user.workspaceId}`, 3, 60))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }
  const json = await req.json().catch(() => null)
  const parsed = confirmSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'CONFIRMATION_REQUIRED' }, { status: 400 })

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: user.workspaceId },
    select: {
      id: true,
      status: true,
      expectedRecipientCount: true,
      _count: { select: { recipients: true } },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (
    campaign.expectedRecipientCount !== parsed.data.expectedRecipientCount ||
    campaign._count.recipients !== parsed.data.expectedRecipientCount
  ) {
    return NextResponse.json({ error: 'AUDIENCE_CHANGED' }, { status: 409 })
  }
  if (campaign.status !== 'DRAFT') {
    return NextResponse.json({
      ok: campaign.status !== 'CANCELLED' && campaign.status !== 'FAILED',
      status: campaign.status,
      alreadyConfirmed: true,
    })
  }

  const queued = await prisma.campaign.updateMany({
    where: { id: campaign.id, workspaceId: user.workspaceId, status: 'DRAFT' },
    data: { status: 'QUEUED', confirmedAt: new Date() },
  })
  if (queued.count !== 1) {
    return NextResponse.json({ error: 'ALREADY_CONFIRMED' }, { status: 409 })
  }

  await dispatchCampaign({ campaignId: campaign.id })
  return NextResponse.json({ ok: true, status: 'QUEUED' }, { status: 202 })
}
