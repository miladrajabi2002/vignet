import { NextResponse } from 'next/server'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Permanently clear the persisted system error/warning log. */
export async function DELETE(req: Request) {
  if (!(await isAdminAuthedRequest(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const result = await prisma.errorLog.deleteMany()
  return NextResponse.json({ ok: true, cleared: result.count })
}
