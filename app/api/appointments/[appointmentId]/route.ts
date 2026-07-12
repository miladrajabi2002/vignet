import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { notifyAppointmentCancellation } from '@/lib/bookings/service'
import { appointmentUpdateSchema } from '@/lib/bookings/validation'

type Props = { params: Promise<{ appointmentId: string }> }

export async function GET(_request: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { appointmentId } = await props.params
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, workspaceId: user.workspaceId },
    include: { service: true, contact: true },
  })
  if (!appointment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ appointment })
}

export async function PATCH(request: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { appointmentId } = await props.params
  const parsed = appointmentUpdateSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, workspaceId: user.workspaceId },
    select: { id: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
    return NextResponse.json({ error: 'TERMINAL_STATUS' }, { status: 409 })
  }

  const isCancellation = parsed.data.status === 'CANCELLED'
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: parsed.data.status,
      cancellationReason: isCancellation ? parsed.data.cancellationReason : null,
      cancelledAt: isCancellation ? new Date() : null,
    },
    include: {
      service: { select: { id: true, name: true, timezone: true, location: true } },
      contact: { select: { id: true, name: true, phone: true } },
    },
  })
  if (isCancellation) {
    await notifyAppointmentCancellation({ workspaceId: user.workspaceId, appointment: updated })
  }
  return NextResponse.json({ appointment: updated })
}
