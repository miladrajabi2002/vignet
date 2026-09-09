import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { fetchTrustedInstagramAvatar } from '@/lib/crm/avatar-proxy'
import { readUserToken } from '@/lib/instagram/config'
import { getInstagramProfile } from '@/lib/instagram/oauth'

type Params = { params: Promise<{ agentId: string; channelId: string }> }

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unavailable() {
  return NextResponse.json(
    { error: 'AVATAR_UNAVAILABLE' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

function avatarResponse(bytes: Uint8Array, contentType: string) {
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

export async function GET(_request: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const channel = await prisma.agentChannel.findFirst({
    where: {
      id: params.channelId,
      agentId: params.agentId,
      type: 'INSTAGRAM',
      active: true,
      agent: { workspaceId: user.workspaceId },
    },
    select: { id: true, config: true },
  })
  if (!channel) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const config =
    channel.config && typeof channel.config === 'object'
      ? (channel.config as Record<string, unknown>)
      : {}
  const storedUrl =
    typeof config.igProfilePictureUrl === 'string'
      ? config.igProfilePictureUrl
      : null

  if (storedUrl) {
    const stored = await fetchTrustedInstagramAvatar(storedUrl)
    if (stored) return avatarResponse(stored.bytes, stored.contentType)
  }

  const token = readUserToken(channel.config)
  if (!token) return unavailable()

  try {
    const profile = await getInstagramProfile(token)
    if (!profile.profilePictureUrl) return unavailable()

    const refreshed = await fetchTrustedInstagramAvatar(profile.profilePictureUrl)
    if (!refreshed) return unavailable()

    return avatarResponse(refreshed.bytes, refreshed.contentType)
  } catch (error) {
    console.warn('[instagram-avatar] failed to refresh profile picture', {
      channelId: channel.id,
      error,
    })
    return unavailable()
  }
}
