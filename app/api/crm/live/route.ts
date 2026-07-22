import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { contactLiveVersion, conversationLiveVersion } from '@/lib/crm/live-version'

type LiveResource = 'conversations' | 'contacts'

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

  let version: string
  if (resource === 'conversations') {
    const [count, latestConversation, latestContact] = await Promise.all([
      prisma.conversation.count({ where: { workspaceId: user.workspaceId } }),
      prisma.conversation.findFirst({
        where: { workspaceId: user.workspaceId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, updatedAt: true },
      }),
      prisma.contact.findFirst({
        where: { workspaceId: user.workspaceId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, updatedAt: true },
      }),
    ])
    version = conversationLiveVersion({ count, latestConversation, latestContact })
  } else {
    const [count, latest] = await Promise.all([
      prisma.contact.count({ where: { workspaceId: user.workspaceId } }),
      prisma.contact.findFirst({
        where: { workspaceId: user.workspaceId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, updatedAt: true },
      }),
    ])
    version = contactLiveVersion({ count, latest })
  }

  return NextResponse.json(
    { version },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
