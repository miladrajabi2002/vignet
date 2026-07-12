import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import {
  campaignAudienceSchema,
  resolveCampaignAudience,
} from '@/lib/campaigns/audience'
import { rateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit(`campaign-preview:${user.workspaceId}`, 12, 60))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }
  const json = await req.json().catch(() => null)
  const parsed = campaignAudienceSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', issues: parsed.error.flatten() }, { status: 400 })
  }

  const audience = await resolveCampaignAudience(user.workspaceId, parsed.data)
  return NextResponse.json({
    totalMatched: audience.totalMatched,
    eligibleCount: audience.eligible.length,
    excludedNoConsent: audience.excludedNoConsent,
    excludedNoChannel: audience.excludedNoChannel,
    capped: audience.capped,
    sample: audience.eligible.slice(0, 5).map((contact) => ({
      id: contact.id,
      label: contact.name || contact.phone || 'Customer',
      channel: contact.channel,
    })),
  })
}
