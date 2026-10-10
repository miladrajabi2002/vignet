import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { invalidateWidgetConfig } from '@/lib/widget/cache'
import { loadStoreAccessChoice, saveStoreAccessChoice } from '@/lib/agents/store-access-choice'

const answerSchema = z.object({
  productAccessEnabled: z.boolean(),
  orderTrackingEnabled: z.boolean(),
  orderCaptureEnabled: z.boolean(),
  payLinkEnabled: z.boolean(),
})

// What the owner still has to decide about the connected store.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json(await loadStoreAccessChoice(user.workspaceId))
}

// The owner's answer, applied to every agent that has not been decided yet.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = answerSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', issues: parsed.error.flatten() }, { status: 400 })
  }

  const agentIds = await saveStoreAccessChoice(user.workspaceId, parsed.data)
  await Promise.all(agentIds.map((id) => invalidateWidgetConfig(id)))
  return NextResponse.json({ ok: true, agents: agentIds.length })
}
