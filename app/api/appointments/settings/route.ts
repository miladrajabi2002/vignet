import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  /** Remind customers in their conversation 24 h and 2 h before a booking. */
  remindersEnabled: z.boolean(),
})

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { bookingRemindersEnabled: parsed.data.remindersEnabled },
  })
  return NextResponse.json({ ok: true, remindersEnabled: parsed.data.remindersEnabled })
}
