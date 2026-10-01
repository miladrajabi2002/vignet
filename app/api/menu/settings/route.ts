import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { menuSettingsSchema } from '@/lib/menu/settings'

/** Save the digital menu's look and info (the whole settings object). */
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }
  const json = await req.json().catch(() => null)
  const parsed = menuSettingsSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', fields: parsed.error.issues.map((issue) => issue.path.join('.')) }, { status: 400 })
  }
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { menuSettings: parsed.data as unknown as Prisma.InputJsonValue },
  })
  return NextResponse.json({ settings: parsed.data })
}
