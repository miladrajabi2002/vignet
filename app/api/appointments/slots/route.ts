import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { BookingError, listAvailableSlots } from '@/lib/bookings/service'
import { slotQuerySchema } from '@/lib/bookings/validation'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const url = new URL(request.url)
  const parsed = slotQuerySchema.safeParse({
    serviceId: url.searchParams.get('serviceId'),
    date: url.searchParams.get('date'),
    partySize: url.searchParams.get('partySize') ?? 1,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const result = await listAvailableSlots({
      workspaceId: user.workspaceId,
      serviceId: parsed.data.serviceId,
      dateKey: parsed.data.date,
      partySize: parsed.data.partySize,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.code }, { status: 404 })
    }
    console.error('[appointments] slot lookup failed', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
