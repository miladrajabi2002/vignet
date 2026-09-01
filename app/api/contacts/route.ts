import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { contactPhoneLookupVariants, normalizeContactPhone } from '@/lib/phone'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const createContactSchema = z
  .object({
    name: z.string().trim().max(120).optional().default(''),
    phone: z.string().trim().max(32).optional().default(''),
    stage: z.enum(['lead', 'qualified', 'customer', 'lost']).default('lead'),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    notes: z.string().trim().max(5000).optional().default(''),
    marketingOptIn: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.name || value.phone), {
    message: 'NAME_OR_PHONE_REQUIRED',
  })

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createContactSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.some(
          (issue) => issue.message === 'NAME_OR_PHONE_REQUIRED',
        )
          ? 'NAME_OR_PHONE_REQUIRED'
          : 'INVALID',
      },
      { status: 400 },
    )
  }

  const phone = parsed.data.phone
    ? normalizeContactPhone(parsed.data.phone)
    : null
  if (parsed.data.phone && !phone) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 })
  }

  if (phone) {
    const existing = await prisma.contact.findFirst({
      where: {
        workspaceId: user.workspaceId,
        phone: { in: contactPhoneLookupVariants(phone) },
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'DUPLICATE_PHONE', contactId: existing.id },
        { status: 409 },
      )
    }
  }

  const uniqueTags = [...new Set(parsed.data.tags.map((tag) => tag.trim()))]
  const now = new Date()
  const contact = await prisma.contact.create({
    data: {
      workspaceId: user.workspaceId,
      name: parsed.data.name || null,
      phone,
      stage: parsed.data.stage,
      tags: uniqueTags,
      notes: parsed.data.notes || null,
      marketingOptIn: parsed.data.marketingOptIn,
      marketingOptInAt: parsed.data.marketingOptIn ? now : null,
    },
    select: { id: true },
  })

  return NextResponse.json({ contact }, { status: 201 })
}
