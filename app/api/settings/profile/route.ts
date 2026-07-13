import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const payloadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  language: z.enum(['fa', 'en']),
})

export async function PATCH(request: Request) {
  const current = await requireUser()
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })

  const user = await prisma.user.update({
    where: { id: current.id },
    data: parsed.data,
    select: { name: true, language: true },
  })
  return NextResponse.json({ user })
}
