import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** List the latest notifications for the current workspace + unread count. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { workspaceId: user.workspaceId, read: false },
    }),
  ])

  return NextResponse.json({ items, unread })
}
