import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { readIgUserId, readPageToken } from '@/lib/instagram/config'
import { resolveInstagramHost } from '@/lib/channels/instagram'
import {
  instagramPostShortcode,
  parseInstagramPostReferences,
} from '@/lib/instagram/post-reference'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

const requestSchema = z.object({
  references: z.string().trim().min(1).max(10_000),
})

interface MediaPage {
  data?: Array<{ id?: string; permalink?: string }>
  paging?: { next?: string }
}

/** Resolve copied Instagram permalinks to the exact media ids emitted in comment webhooks. */
export async function POST(req: Request, props: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = requestSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const parsed = parseInstagramPostReferences(body.data.references)
  if (parsed.invalid.length > 0 || (parsed.ids.length === 0 && parsed.shortcodes.length === 0)) {
    return NextResponse.json({ error: 'INVALID_REFERENCE', invalid: parsed.invalid }, { status: 400 })
  }
  if (parsed.shortcodes.length === 0) {
    return NextResponse.json({ ids: parsed.ids })
  }

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

  const pending = new Set(parsed.shortcodes)
  const resolvedIds = new Map<string, string>()
  const firstUrl = new URL(`${graph.base}/${igUserId}/media`)
  firstUrl.searchParams.set('fields', 'id,permalink')
  firstUrl.searchParams.set('limit', '100')
  let pageUrl: string | null = firstUrl.toString()

  // Meta paginates the owned-media edge. Bound both pages and wall time so an
  // old post or malformed paging response cannot hold a form submission open.
  const lookupDeadline = Date.now() + 20_000
  for (let page = 0; page < 50 && pageUrl && pending.size > 0 && Date.now() < lookupDeadline; page += 1) {
    const timeoutMs = Math.max(1_000, Math.min(8_000, lookupDeadline - Date.now()))
    const response = await fetch(pageUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null)
    if (!response?.ok) {
      return NextResponse.json({ error: 'MEDIA_LOOKUP_FAILED' }, { status: 502 })
    }

    const payload = (await response.json().catch(() => ({}))) as MediaPage
    for (const media of payload.data ?? []) {
      if (!media.id || !media.permalink) continue
      const shortcode = instagramPostShortcode(media.permalink)
      if (shortcode && pending.has(shortcode)) {
        resolvedIds.set(shortcode, media.id)
        pending.delete(shortcode)
      }
    }

    const next = payload.paging?.next
    if (!next) {
      pageUrl = null
      continue
    }
    try {
      const candidate = new URL(next)
      pageUrl = candidate.protocol === 'https:' &&
        (candidate.hostname === 'graph.instagram.com' || candidate.hostname === 'graph.facebook.com')
        ? candidate.toString()
        : null
    } catch {
      pageUrl = null
    }
  }

  if (pending.size > 0) {
    return NextResponse.json({ error: 'MEDIA_NOT_FOUND', shortcodes: [...pending] }, { status: 404 })
  }

  return NextResponse.json({
    ids: [...new Set([
      ...parsed.ids,
      ...parsed.shortcodes.map((shortcode) => resolvedIds.get(shortcode)).filter((id): id is string => Boolean(id)),
    ])],
  })
}
