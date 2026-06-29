import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin/auth'
import { getServerMetrics } from '@/lib/admin/metrics'

export const dynamic = 'force-dynamic'

/** Live server resource metrics — admin-cookie guarded (not next-auth). */
export async function GET() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return NextResponse.json(await getServerMetrics())
}
