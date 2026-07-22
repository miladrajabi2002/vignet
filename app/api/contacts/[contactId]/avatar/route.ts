import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { fetchInstagramSenderProfile } from '@/lib/instagram/sender-profile'
import { fetchTrustedInstagramAvatar } from '@/lib/crm/avatar-proxy'

type Params = { params: Promise<{ contactId: string }> }

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unavailable() {
  return NextResponse.json(
    { error: 'AVATAR_UNAVAILABLE' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

function avatarResponse(bytes: Uint8Array, contentType: string) {
  // Copy into a concrete ArrayBuffer; BodyInit does not accept a typed array
  // whose backing store could be SharedArrayBuffer.
  const body = new Uint8Array(bytes.byteLength)
  body.set(bytes)
  return new NextResponse(body.buffer, {
    status: 200,
    headers: {
      'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
      'Content-Type': contentType,
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    },
  })
}

export async function GET(request: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const channel = new URL(request.url).searchParams.get('channel')
  if (channel !== 'INSTAGRAM') {
    return NextResponse.json({ error: 'UNSUPPORTED_CHANNEL' }, { status: 400 })
  }

  const contact = await prisma.contact.findFirst({
    where: { id: params.contactId, workspaceId: user.workspaceId },
    select: {
      id: true,
      instagramId: true,
      instagramAvatarUrl: true,
      conversations: {
        where: { channel: 'INSTAGRAM' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { agentId: true },
      },
    },
  })
  if (!contact) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (contact.instagramAvatarUrl) {
    const stored = await fetchTrustedInstagramAvatar(contact.instagramAvatarUrl)
    if (stored) return avatarResponse(stored.bytes, stored.contentType)
  }

  if (!contact.instagramId) return unavailable()

  // Prefer the channel(s) that actually own this contact's Instagram
  // conversations. A workspace fallback covers contacts imported before the
  // conversation relation was backfilled or moved between agents.
  const relatedAgentIds = new Set(contact.conversations.map((item) => item.agentId))
  const channels = await prisma.agentChannel.findMany({
    where: {
      type: 'INSTAGRAM',
      active: true,
      agent: { workspaceId: user.workspaceId },
    },
    orderBy: { createdAt: 'desc' },
    select: { agentId: true, config: true },
  })
  channels.sort(
    (left, right) =>
      Number(relatedAgentIds.has(right.agentId)) -
      Number(relatedAgentIds.has(left.agentId)),
  )

  for (const agentChannel of channels) {
    const profile = await fetchInstagramSenderProfile(
      agentChannel.config,
      contact.instagramId,
    )
    if (!profile?.avatarUrl) continue

    const refreshed = await fetchTrustedInstagramAvatar(profile.avatarUrl)
    if (!refreshed) continue

    // Save only a verified, currently downloadable URL. The workspace
    // predicate remains on the write as a final tenant-boundary guard.
    await prisma.contact
      .updateMany({
        where: {
          id: contact.id,
          workspaceId: user.workspaceId,
          instagramId: contact.instagramId,
        },
        data: {
          instagramAvatarUrl: profile.avatarUrl,
          ...(profile.username
            ? { instagramUsername: profile.username }
            : {}),
        },
      })
      .catch((error) => {
        console.error('[crm-avatar] failed to persist refreshed profile', {
          contactId: contact.id,
          workspaceId: user.workspaceId,
          error,
        })
      })

    return avatarResponse(refreshed.bytes, refreshed.contentType)
  }

  return unavailable()
}
