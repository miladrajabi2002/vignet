import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({ rating: z.union([z.literal(1), z.literal(-1)]) })

export async function PATCH(
  req: Request,
  { params }: { params: { messageId: string } },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  // Verify the message belongs to this workspace via conversation join.
  const msg = await prisma.message.findFirst({
    where: {
      id: params.messageId,
      conversation: { workspaceId: user.workspaceId },
      role: 'ASSISTANT',
    },
    select: { id: true },
  })
  if (!msg) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.message.update({
    where: { id: params.messageId },
    data: { rating: parsed.data.rating },
  })

  return NextResponse.json({ ok: true })
}
