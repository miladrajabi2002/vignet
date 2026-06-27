import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: { contactId: string } }

const updateSchema = z.object({
  stage: z.enum(['lead', 'qualified', 'customer', 'lost']).optional(),
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(5000).nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
})

async function ownContact(workspaceId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true },
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownContact(user.workspaceId, params.contactId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const contact = await prisma.contact.update({
    where: { id: params.contactId },
    data: parsed.data,
  })
  return NextResponse.json({ contact })
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownContact(user.workspaceId, params.contactId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.contact.delete({ where: { id: params.contactId } })
  return NextResponse.json({ ok: true })
}
