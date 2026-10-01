import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { BookingError, rescheduleAppointment } from '@/lib/bookings/service'
import { assertDateKey } from '@/lib/bookings/time'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

type Props = { params: Promise<{ appointmentId: string }> }

const bodySchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    try { assertDateKey(value); return true } catch { return false }
  }),
  startMinute: z.number().int().min(0).max(1439),
})

export async function POST(request: Request, props: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed)
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  const { appointmentId } = await props.params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  try {
    const result = await rescheduleAppointment({
      workspaceId: user.workspaceId,
      appointmentId,
      localDate: parsed.data.localDate,
      startMinute: parsed.data.startMinute,
      source: 'dashboard',
    })
    return NextResponse.json({ appointment: result.appointment })
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === 'APPOINTMENT_NOT_FOUND' || error.code === 'SERVICE_NOT_FOUND'
        ? 404
        : error.code === 'CAPACITY_EXCEEDED' || error.code === 'TRANSACTION_CONFLICT' || error.code === 'APPOINTMENT_NOT_ACTIVE'
          ? 409
          : 422
      return NextResponse.json({ error: error.code }, { status })
    }
    console.error('[appointments] reschedule failed', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
