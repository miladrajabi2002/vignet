import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dateKeyToDatabaseDate } from '@/lib/bookings/time'
import { serviceUpdateSchema } from '@/lib/bookings/validation'

type Props = { params: Promise<{ serviceId: string }> }

async function ownedService(workspaceId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, workspaceId },
    select: { id: true },
  })
}

export async function GET(_request: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { serviceId } = await props.params
  const service = await prisma.service.findFirst({
    where: { id: serviceId, workspaceId: user.workspaceId },
    include: {
      weeklyRules: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
      exceptions: { orderBy: { date: 'asc' } },
      _count: { select: { appointments: true } },
    },
  })
  if (!service) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ service })
}

export async function PATCH(request: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { serviceId } = await props.params
  if (!(await ownedService(user.workspaceId, serviceId))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const parsed = serviceUpdateSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { weeklyRules, exception, removeExceptionDate, ...scalarData } = parsed.data
  const service = await prisma.$transaction(async (tx) => {
    if (weeklyRules) {
      await tx.serviceAvailabilityRule.deleteMany({ where: { serviceId } })
      if (weeklyRules.length) {
        await tx.serviceAvailabilityRule.createMany({
          data: weeklyRules.map((rule) => ({
            serviceId,
            ...rule,
            capacity: rule.capacity ?? null,
            active: rule.active ?? true,
          })),
        })
      }
    }
    if (exception) {
      const date = dateKeyToDatabaseDate(exception.date)
      await tx.serviceDateException.upsert({
        where: { serviceId_date: { serviceId, date } },
        update: {
          closed: exception.closed,
          startMinute: exception.startMinute ?? null,
          endMinute: exception.endMinute ?? null,
          capacity: exception.capacity ?? null,
          note: exception.note ?? null,
        },
        create: {
          serviceId,
          date,
          closed: exception.closed,
          startMinute: exception.startMinute ?? null,
          endMinute: exception.endMinute ?? null,
          capacity: exception.capacity ?? null,
          note: exception.note ?? null,
        },
      })
    }
    if (removeExceptionDate) {
      await tx.serviceDateException.deleteMany({
        where: { serviceId, date: dateKeyToDatabaseDate(removeExceptionDate) },
      })
    }
    await tx.service.update({
      where: { id: serviceId },
      data: scalarData,
    })
    return tx.service.findUniqueOrThrow({
      where: { id: serviceId },
      include: {
        weeklyRules: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        exceptions: { orderBy: { date: 'asc' } },
        _count: { select: { appointments: true } },
      },
    })
  })
  return NextResponse.json({ service })
}

/** Services with appointment history are archived rather than hard-deleted. */
export async function DELETE(_request: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { serviceId } = await props.params
  const result = await prisma.service.updateMany({
    where: { id: serviceId, workspaceId: user.workspaceId },
    data: { active: false },
  })
  if (!result.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
