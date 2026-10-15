import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { APPOINTMENT_BULK_SCOPES, appointmentBulkWhere, countBulkScopes, parseBulkScope } from '@/lib/bulk-delete/scopes'

export const dynamic = 'force-dynamic'

/**
 * Bulk cleanup for bookings — the «حذف گروهی» menu on the appointments page.
 *
 * GET    → { counts } per preset (لغوشده، غیبت، تمام‌شده بیش از یک ماه پیش).
 * DELETE → permanently removes the bookings matching `?scope=`. Appointments
 * are not soft-deleted (same as the single-booking delete), so there is no
 * «all» preset and no undo; the reply carries `byService` so the page can
 * lower each service's booking count without a reload.
 */

const BATCH_SIZE = 1000

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const now = new Date()
  const counts = await countBulkScopes(APPOINTMENT_BULK_SCOPES, (scope) =>
    prisma.appointment.count({ where: { workspaceId: user.workspaceId, ...appointmentBulkWhere(scope, now) } }),
  )
  return NextResponse.json({ counts })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }
  // No default here: without «all» an empty scope must not mean anything.
  if (!new URL(request.url).searchParams.get('scope')) {
    return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400 })
  }
  const scope = parseBulkScope(request, APPOINTMENT_BULK_SCOPES)
  if (!scope) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400 })
  const scopeWhere = appointmentBulkWhere(scope)

  let deleted = 0
  const byService: Record<string, number> = {}
  for (;;) {
    const rows = await prisma.appointment.findMany({
      where: { workspaceId: user.workspaceId, ...scopeWhere },
      select: { id: true, serviceId: true },
      take: BATCH_SIZE,
    })
    if (rows.length === 0) break
    await prisma.appointment.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })
    for (const row of rows) byService[row.serviceId] = (byService[row.serviceId] ?? 0) + 1
    deleted += rows.length
    if (rows.length < BATCH_SIZE) break
  }

  return NextResponse.json({ ok: true, deleted, byService })
}
