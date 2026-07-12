import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

type Params = { params: Promise<{ runId: string }> }

const feedbackSchema = z
  .object({
    applied: z.literal(true).optional(),
    helpful: z.boolean().optional(),
  })
  .refine((value) => value.applied === true || value.helpful !== undefined)

export async function POST(req: Request, props: Params) {
  const { runId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = feedbackSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const existing = await prisma.vigentoRun.findFirst({
    where: { id: runId, workspaceId: user.workspaceId },
    select: { id: true, applied: true },
  })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.vigentoRun.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.applied
        ? { applied: true, appliedAt: existing.applied ? undefined : new Date() }
        : {}),
      ...(parsed.data.helpful !== undefined ? { helpful: parsed.data.helpful } : {}),
    },
  })
  return NextResponse.json({ ok: true })
}

