import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { CAPABILITY_KEYS, getDashboardModules } from '@/lib/verticals/registry'
import { enableWorkspaceCapability } from '@/lib/verticals/workspace-capabilities'

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

  const result = await enableWorkspaceCapability(user.workspaceId, parsed.data.add, parsed.data.locale)
  if (!result) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true, changed: result.changed, modules: getDashboardModules(result.capabilities) })
}
