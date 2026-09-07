import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  // Mark one notification or a displayed batch read; omit both to mark all.
  id: z.string().optional(),
  ids: z.array(z.string().min(1)).min(1).max(100).optional(),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  await prisma.notification.updateMany({
    where: {
      workspaceId: user.workspaceId,
      read: false,
      ...(parsed.data.id ? { id: parsed.data.id } : parsed.data.ids ? { id: { in: parsed.data.ids } } : {}),
    },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
