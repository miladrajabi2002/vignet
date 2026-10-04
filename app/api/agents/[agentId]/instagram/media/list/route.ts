import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { readIgUserId, readPageToken } from '@/lib/instagram/config'
import { resolveInstagramHost } from '@/lib/channels/instagram'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Normalized media item returned to the dashboard picker.
 * - POST items carry a permalink + caption (published, permanent).
 * - STORY items carry expiresAt (timestamp + 24h) — Instagram stories vanish
 *   after 24 hours, so the UI shows a live countdown and the scheduler
 *   deactivates story-scoped automations once they expire.
 */
export interface InstagramMediaListItem {
  id: string
  kind: 'POST' | 'STORY'
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  productType?: string
  mediaUrl?: string
  permalink?: string
  caption?: string
  timestamp: string
  /** STORY only — when the story disappears from the page. */
  expiresAt?: string
}

interface GraphMediaItem {
  id?: string
  caption?: string
  media_type?: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
}

interface GraphMediaPage {
  data?: GraphMediaItem[]
  paging?: { next?: string }
}

/** Instagram stories live exactly 24h (plus a small grace window). */
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

/**
 * GET /api/agents/{agentId}/instagram/media/list?kind=posts|stories
 *
 * Lists the connected page's own media so operators can visually pick
 * posts/reels/stories in a popup instead of pasting permalinks by hand.
 * - kind=posts   → GET /{ig-user-id}/media   (published photos, videos,
 *                  reels, carousels — paginated)
 * - kind=stories → GET /{ig-user-id}/stories  (only the ACTIVE stories,
 *                  i.e. published within the last 24h)
 */
export async function GET(req: Request, props: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  const kind = new URL(req.url).searchParams.get('kind') === 'stories' ? 'stories' : 'posts'
  // How many 30-item pages to walk in one request (client "load more").
  const pagesRequested = Math.max(1, Math.min(5, Number(new URL(req.url).searchParams.get('pages')) || 1))
  const { agentId } = await props.params
  const channel = await prisma.agentChannel.findFirst({
    where: {
      agentId,
      type: 'INSTAGRAM',
      agent: { workspaceId: user.workspaceId },
    },
    select: { config: true },
  })
  if (!channel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

  const token = readPageToken(channel.config)
  const igUserId = readIgUserId(channel.config)
  if (!token || !igUserId) return NextResponse.json({ error: 'IG_RECONNECT_REQUIRED' }, { status: 409 })

  const graph = await resolveInstagramHost(token)
  if (!graph) return NextResponse.json({ error: 'IG_RECONNECT_REQUIRED' }, { status: 409 })

  const fields =
    kind === 'stories'
      ? 'id,media_type,media_url,thumbnail_url,timestamp'
      : 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp'

  const first = new URL(`${graph.base}/${igUserId}/${kind === 'stories' ? 'stories' : 'media'}`)
  first.searchParams.set('fields', fields)
  first.searchParams.set('limit', '30')

  const items: InstagramMediaListItem[] = []
  // Stories are capped by Meta at ~100 active; posts paginate — bound both so
  // a huge page cannot hold the request open (matches the resolve route).
  const deadline = Date.now() + 20_000
  let pageUrl: string | null = first.toString()
  let nextUrl: string | null = null

  for (let page = 0; page < pagesRequested && pageUrl && Date.now() < deadline; page += 1) {
    const response = await fetch(pageUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    if (!response?.ok) {
      return NextResponse.json({ error: 'MEDIA_LOOKUP_FAILED' }, { status: 502 })
    }

    const payload = (await response.json().catch(() => ({}))) as GraphMediaPage
    for (const media of payload.data ?? []) {
      if (!media.id || !media.timestamp) continue
      const mediaType =
        media.media_type === 'VIDEO' ? 'VIDEO' : media.media_type === 'CAROUSEL_ALBUM' ? 'CAROUSEL_ALBUM' : 'IMAGE'
      const base: InstagramMediaListItem = {
        id: media.id,
        kind: kind === 'stories' ? 'STORY' : 'POST',
        mediaType,
        // For videos Meta serves the poster frame via thumbnail_url.
        mediaUrl: mediaType === 'VIDEO' ? media.thumbnail_url || media.media_url : media.media_url,
        timestamp: media.timestamp,
      }
      if (kind === 'stories') {
        base.expiresAt = new Date(new Date(media.timestamp).getTime() + STORY_LIFETIME_MS).toISOString()
      } else {
        base.permalink = media.permalink
        base.caption = media.caption ?? undefined
        base.productType = media.media_product_type
      }
      items.push(base)
    }

    const next = payload.paging?.next
    nextUrl = null
    if (next) {
      try {
        const candidate = new URL(next)
        if (
          candidate.protocol === 'https:' &&
          (candidate.hostname === 'graph.instagram.com' || candidate.hostname === 'graph.facebook.com')
        ) {
          nextUrl = candidate.toString()
        }
      } catch {
        nextUrl = null
      }
    }
    pageUrl = nextUrl
  }

  return NextResponse.json({ items, hasMore: Boolean(nextUrl) })
}
