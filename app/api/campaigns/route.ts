import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  campaignAudienceSchema,
  resolveCampaignAudience,
  safeAudienceSnapshot,
} from '@/lib/campaigns/audience'
import { rateLimit } from '@/lib/ratelimit'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
  audience: campaignAudienceSchema,
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      status: true,
      expectedRecipientCount: true,
      sentCount: true,
      failedCount: true,
      skippedCount: true,
      createdAt: true,
      confirmedAt: true,
      completedAt: true,
    },
  })
  return NextResponse.json({ campaigns })
}

/** Create a frozen DRAFT only. This endpoint never dispatches messages. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }
  if (!(await rateLimit(`campaign-create:${user.workspaceId}`, 5, 60))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }
  const json = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', issues: parsed.error.flatten() }, { status: 400 })
  }

  const audience = await resolveCampaignAudience(user.workspaceId, parsed.data.audience)
  if (audience.eligible.length === 0) {
    return NextResponse.json({
      error: 'NO_ELIGIBLE_RECIPIENTS',
      excludedNoConsent: audience.excludedNoConsent,
      excludedNoChannel: audience.excludedNoChannel,
    }, { status: 400 })
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        workspaceId: user.workspaceId,
        name: parsed.data.name.trim(),
        message: parsed.data.message.trim(),
        status: 'DRAFT',
        audienceSnapshot: safeAudienceSnapshot(parsed.data.audience),
        expectedRecipientCount: audience.eligible.length,
        eligibleCount: audience.eligible.length,
        excludedCount: audience.excludedNoConsent + audience.excludedNoChannel,
      },
      select: { id: true, name: true, status: true, expectedRecipientCount: true },
    })
    await tx.campaignRecipient.createMany({
      data: audience.eligible.map((contact) => ({
        campaignId: created.id,
        contactId: contact.id,
        channel: contact.channel,
        conversationId: contact.conversationId,
      })),
      skipDuplicates: true,
    })
    return created
  })

  return NextResponse.json({
    campaign,
    excludedNoConsent: audience.excludedNoConsent,
    excludedNoChannel: audience.excludedNoChannel,
  }, { status: 201 })
}
