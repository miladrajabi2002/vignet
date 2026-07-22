import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { dashboardChecklistDismissedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
