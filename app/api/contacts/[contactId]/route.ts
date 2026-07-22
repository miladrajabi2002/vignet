import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ contactId: string }> }

const updateSchema = z.object({
  stage: z.enum(['lead', 'qualified', 'customer', 'lost']).optional(),
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(5000).nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  marketingOptIn: z.boolean().optional(),
})

async function ownContact(workspaceId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true, marketingOptIn: true },
  })
}

export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const existing = await ownContact(user.workspaceId, params.contactId)
  if (!existing)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const consent = parsed.data.marketingOptIn
  const consentChanged = consent !== undefined && consent !== existing.marketingOptIn
  const contact = await prisma.contact.update({
    where: { id: params.contactId },
    data: {
      ...parsed.data,
      ...(consentChanged && consent === true
        ? { marketingOptInAt: new Date(), marketingOptOutAt: null }
        : {}),
      ...(consentChanged && consent === false ? { marketingOptOutAt: new Date() } : {}),
    },
  })
  return NextResponse.json({ contact })
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownContact(user.workspaceId, params.contactId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Deleting a CRM profile must not silently destroy the message history
      // operators may still need for support, disputes, or audit. Preserve the
      // conversations/messages and detach them before removing the contact.
      const detached = await tx.conversation.updateMany({
        where: {
          contactId: params.contactId,
          workspaceId: user.workspaceId,
        },
        data: { contactId: null },
      })

      // deleteMany keeps the tenant predicate on the destructive statement and
      // makes a concurrent delete harmless instead of crossing workspace scope.
      const deleted = await tx.contact.deleteMany({
        where: { id: params.contactId, workspaceId: user.workspaceId },
      })
      if (deleted.count !== 1) throw new Error('CONTACT_DELETE_RACE')

      return { preservedConversations: detached.count }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Failed to delete contact', {
      contactId: params.contactId,
      workspaceId: user.workspaceId,
      error,
    })
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
  }
}
