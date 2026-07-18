import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type LiveResource = 'conversations' | 'contacts'

function versionOf(row: { id: string; createdAt: Date } | null): string {
  return row ? `${row.createdAt.toISOString()}:${row.id}` : 'empty'
}

/**
 * A deliberately tiny change detector for the CRM list pages. It returns only
 * the newest workspace-owned entity version; the browser refreshes the server
 * page when this value changes and never downloads a duplicate list payload.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user)
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const resource = new URL(request.url).searchParams.get(
    'resource',
  ) as LiveResource | null
  if (resource !== 'conversations' && resource !== 'contacts') {
    return NextResponse.json({ error: 'INVALID_RESOURCE' }, { status: 400 })
  }

  const latest =
    resource === 'conversations'
      ? await prisma.conversation.findFirst({
          where: { workspaceId: user.workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, createdAt: true },
        })
      : await prisma.contact.findFirst({
          where: { workspaceId: user.workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, createdAt: true },
        })

  return NextResponse.json(
    { version: versionOf(latest) },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
