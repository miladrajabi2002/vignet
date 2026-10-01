import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { appointmentDaySummary } from '@/lib/bookings/service'
import { assertDateKey } from '@/lib/bookings/time'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    try { assertDateKey(value); return true } catch { return false }
  }),
  days: z.coerce.number().int().min(1).max(62).default(14),
  serviceId: z.string().min(1).max(80).optional(),
})

/** Per-day counts for the week strip — one query instead of one per day. */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    from: url.searchParams.get('from'),
    days: url.searchParams.get('days') ?? undefined,
    serviceId: url.searchParams.get('serviceId') || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const days = await appointmentDaySummary({
    workspaceId: user.workspaceId,
    fromDateKey: parsed.data.from,
    days: parsed.data.days,
    serviceId: parsed.data.serviceId,
  })
  return NextResponse.json({ days })
}
