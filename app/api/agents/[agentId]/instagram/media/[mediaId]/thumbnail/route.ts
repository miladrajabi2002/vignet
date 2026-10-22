import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { readPageToken } from '@/lib/instagram/config'
import { igProxySrc, isInstagramCdnUrl } from '@/lib/instagram/media-proxy'
import { placeholderResponse } from '@/lib/instagram/media-placeholder'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string; mediaId: string }> }

interface GraphMedia {
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  children?: { data?: GraphMedia[] }
}

const FB_BASE = 'https://graph.facebook.com/v21.0'
const IG_BASE = 'https://graph.instagram.com/v21.0'

/** A video's media_url is the clip itself — only its poster frame is an image. */
function looksLikeVideo(url: string) {
  try {
    return /\.(mp4|mov|m4v|webm)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

/** The still that stands for a media: poster frame for videos/reels, else the image. */
function coverOf(media: GraphMedia): string | undefined {
  if (media.thumbnail_url) return media.thumbnail_url
  if (media.media_url && media.media_type !== 'VIDEO' && !looksLikeVideo(media.media_url)) return media.media_url
  return undefined
}

async function graphGet(token: string, path: string): Promise<GraphMedia | null> {
  // Same host order as resolveInstagramHost, without its extra /me probe.
  const bases = /^(IGAA|IGQ)/i.test(token) ? [IG_BASE, FB_BASE] : [FB_BASE, IG_BASE]
  for (const base of bases) {
    const response = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null)
    if (response?.ok) return (await response.json().catch(() => null)) as GraphMedia | null
  }
  return null
}

/**
 * GET /api/agents/{agentId}/instagram/media/{mediaId}/thumbnail
 *
 * Scenario cards and the edit form saved the picked post's CDN url, but
 * Instagram signs those urls for a few days only — after that every saved
 * reel/post showed the gradient placeholder. This looks the media up again
 * and redirects to the CDN relay with a fresh cover (a reel's poster frame,
 * a carousel's first slide), so a saved scenario keeps its real thumbnail.
 */
export async function GET(_req: Request, props: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { agentId, mediaId } = await props.params
  if (!/^\d{1,30}$/.test(mediaId)) return placeholderResponse()

  const channel = await prisma.agentChannel.findFirst({
    where: { agentId, type: 'INSTAGRAM', agent: { workspaceId: user.workspaceId } },
    select: { config: true },
  })
  const token = channel ? readPageToken(channel.config) : null
  if (!token) return placeholderResponse()

  const media = await graphGet(token, `${mediaId}?fields=media_type,media_url,thumbnail_url`)
  let cover = media ? coverOf(media) : undefined
  if (!cover && media?.media_type === 'CAROUSEL_ALBUM') {
    const album = await graphGet(token, `${mediaId}?fields=children{media_type,media_url,thumbnail_url}`)
    const first = album?.children?.data?.[0]
    cover = first ? coverOf(first) : undefined
  }
  if (!cover || !isInstagramCdnUrl(cover)) return placeholderResponse()

  const target = igProxySrc(cover)!
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: target,
      // Fresh covers stay signed for days; one lookup per browser per few hours.
      'Cache-Control': 'private, max-age=21600',
    },
  })
}
