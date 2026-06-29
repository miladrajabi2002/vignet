import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  // Mark one notification read, or omit `id` to mark all read.
  id: z.string().optional(),
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
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
    },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
