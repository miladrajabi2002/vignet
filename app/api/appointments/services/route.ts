import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { listBookingServices, serviceSlug } from '@/lib/bookings/service'
import { serviceCreateSchema } from '@/lib/bookings/validation'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const services = await listBookingServices(user.workspaceId)
  return NextResponse.json({ services })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed)
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })

  const parsed = serviceCreateSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { weeklyRules, ...data } = parsed.data
  const slug = `${serviceSlug(data.name)}-${crypto.randomUUID().slice(0, 6)}`
  const service = await prisma.service.create({
    data: {
      workspaceId: user.workspaceId,
      slug,
      ...data,
      description: data.description || null,
      location: data.location || null,
      weeklyRules: {
        create: weeklyRules.map((rule) => ({
          ...rule,
          capacity: rule.capacity ?? null,
          active: rule.active ?? true,
        })),
      },
    },
    include: { weeklyRules: true, exceptions: true, _count: { select: { appointments: true } } },
  })
  return NextResponse.json({ service }, { status: 201 })
}
