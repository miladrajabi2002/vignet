import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { normalizeBusinessProfile, readBusinessProfile, workspaceCapabilities } from '@/lib/verticals/profile'
import { CAPABILITY_KEYS, getDashboardModules } from '@/lib/verticals/registry'
import { forgetWorkspaceCapabilities } from '@/lib/verticals/workspace-capabilities'

const schema = z.object({
  /** A capability key, e.g. `bookings`. */
  add: z.enum(CAPABILITY_KEYS),
  locale: z.enum(['fa', 'en']).default('fa'),
})

/**
 * Adds one capability to the business profile without touching the rest of
 * it — e.g. "turn on bookings" from the services page. Idempotent: when the
 * capability is already on nothing is written.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { name: true, businessType: true, businessProfile: true },
  })
  if (!workspace) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const profile = readBusinessProfile(workspace.businessProfile, workspace.businessType)
  const current = workspaceCapabilities(workspace)
  if (current.includes(parsed.data.add)) {
    return NextResponse.json({ ok: true, changed: false, modules: getDashboardModules(current) })
  }

  const next = normalizeBusinessProfile({
    website: profile?.website,
    businessName: profile?.businessName ?? workspace.name,
    capabilities: [...current, parsed.data.add],
    extras: profile?.extras ?? [],
    locale: parsed.data.locale,
  })
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { businessProfile: next },
  })
  forgetWorkspaceCapabilities(user.workspaceId)
  return NextResponse.json({ ok: true, changed: true, modules: getDashboardModules(next.capabilities) })
}
