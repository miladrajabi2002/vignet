import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import {
  BookingError,
  createAppointment,
  listAppointmentsForDate,
} from '@/lib/bookings/service'
import { dateKeyInTimeZone } from '@/lib/bookings/time'
import {
  appointmentCreateSchema,
  appointmentListQuerySchema,
} from '@/lib/bookings/validation'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const url = new URL(request.url)
  const parsed = appointmentListQuerySchema.safeParse({
    date: url.searchParams.get('date') || undefined,
    serviceId: url.searchParams.get('serviceId') || undefined,
    status: url.searchParams.get('status') || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID', issues: parsed.error.flatten() }, { status: 400 })
  }
  const date = parsed.data.date ?? dateKeyInTimeZone(new Date())
  const appointments = await listAppointmentsForDate({
    workspaceId: user.workspaceId,
    dateKey: date,
    serviceId: parsed.data.serviceId,
    status: parsed.data.status,
  })
  return NextResponse.json({ date, appointments })
}

function bookingErrorResponse(error: BookingError) {
  const status =
    error.code === 'SERVICE_NOT_FOUND' || error.code === 'CONTACT_NOT_FOUND'
      ? 404
      : error.code === 'CAPACITY_EXCEEDED' || error.code === 'TRANSACTION_CONFLICT'
        ? 409
        : 422
  return NextResponse.json({ error: error.code }, { status })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed)
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  const parsed = appointmentCreateSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await createAppointment(user.workspaceId, {
      ...parsed.data,
      // Authenticated dashboard requests cannot impersonate an AI/tool call in
      // the audit trail. Agent bookings bypass this route through agent-tools.
      source: 'dashboard',
    })
    return NextResponse.json(
      { appointment: result.appointment, idempotent: !result.created },
      { status: result.created ? 201 : 200 },
    )
  } catch (error) {
    if (error instanceof BookingError) return bookingErrorResponse(error)
    console.error('[appointments] create failed', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
