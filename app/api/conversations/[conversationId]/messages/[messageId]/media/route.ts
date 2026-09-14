import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { getAdapter } from '@/lib/channels/registry'
import { safeHttpGet } from '@/lib/security/safe-http'
import { readPageToken } from '@/lib/instagram/config'
import { resolveInstagramHost } from '@/lib/channels/instagram'
import type { Prisma } from '@prisma/client'

type Params = { params: Promise<{ conversationId: string; messageId: string }> }

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * View-time media proxy for inbound channel attachments (Instagram photos and
 * Telegram/Bale photos, videos and voice notes).
 *
 * No media bytes are ever persisted on this server: the USER message carries
 * only a trusted channel reference (`vigentoInbound.mediaUrl` for Instagram's
 * short-lived CDN URL, `mediaFileId` for Telegram/Bale file ids). When an
 * operator opens the conversation, this route resolves the reference live and
 * streams the bytes through with workspace-scoped authorization and the same
 * SSRF/DNS-pinning protections used by the avatar proxies.
 *
 * A15: Instagram CDN signatures eventually expire. When the stored URL no
 * longer serves the bytes, the route asks the Graph API for a FRESH CDN URL
 * (`GET /{platformMessageId}?fields=attachments` returns image_data/video_data
 * URLs) and retries — so old photos keep rendering in the dashboard without
 * ever storing the file. Meta does not return audio attachments on retrieval,
 * so voice notes rely on the stored URL plus the STT transcript that is
 * already part of the message text.
 */

const ALLOWED_MEDIA_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'application/octet-stream',
]
const MAX_MEDIA_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000
const GRAPH_TIMEOUT_MS = 12_000

interface InboundMediaReference {
  mediaKind?: string
  mediaUrl?: string
  mediaFileId?: string
  platformMessageId?: string
}

function readInboundMedia(metadata: unknown): InboundMediaReference | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).vigentoInbound
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  return {
    mediaKind: typeof row.mediaKind === 'string' ? row.mediaKind : undefined,
    mediaUrl: typeof row.mediaUrl === 'string' && row.mediaUrl.startsWith('https://')
      ? row.mediaUrl
      : undefined,
    mediaFileId: typeof row.mediaFileId === 'string' && row.mediaFileId ? row.mediaFileId : undefined,
    platformMessageId: typeof row.platformMessageId === 'string' && row.platformMessageId
      ? row.platformMessageId
      : undefined,
  }
}

function unavailable(status = 404, error = 'MEDIA_UNAVAILABLE') {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

function mediaResponse(bytes: Uint8Array, contentType: string) {
  // Copy into a concrete ArrayBuffer; BodyInit does not accept a typed array
  // whose backing store could be a SharedArrayBuffer.
  const body = new Uint8Array(bytes.byteLength)
  body.set(bytes)
  return new NextResponse(body.buffer, {
    status: 200,
    headers: {
      // Instagram CDN URLs expire quickly; Telegram file URLs are re-resolved
      // on every view. A short private cache keeps the thread snappy without
      // serving stale media after expiry.
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'Content-Type': contentType,
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    },
  })
}

async function fetchMediaBytes(targetUrl: string) {
  try {
    const response = await safeHttpGet(targetUrl, {
      allowedContentTypes: ALLOWED_MEDIA_CONTENT_TYPES,
      maxBytes: MAX_MEDIA_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: 2,
    })
    if (response.status !== 200 || response.body.length === 0) return null
    const contentType = String(response.headers['content-type'] ?? 'application/octet-stream')
    return { body: response.body, contentType }
  } catch {
    // Expired Instagram CDN URLs, revoked Telegram files, content-type
    // mismatches and blocked targets all land here.
    return null
  }
}

/** Ask Instagram for a fresh CDN URL for a photo/video message. */
async function resolveFreshInstagramMediaUrl(
  agentId: string,
  platformMessageId: string,
): Promise<string | null> {
  const channelRow = await prisma.agentChannel.findFirst({
    where: { agentId, type: 'INSTAGRAM', active: true },
    select: { config: true },
  })
  const token = channelRow ? readPageToken(channelRow.config) : null
  if (!token) return null
  const host = await resolveInstagramHost(token)
  if (!host) return null
  try {
    const res = await fetch(
      `${host.base}/${encodeURIComponent(platformMessageId)}?fields=attachments`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      },
    )
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as {
      attachments?: { data?: Array<{ image_data?: { url?: string }; video_data?: { url?: string } }> }
    } | null
    const attachment = json?.attachments?.data?.[0]
    const fresh = attachment?.image_data?.url ?? attachment?.video_data?.url
    return typeof fresh === 'string' && fresh.startsWith('https://') ? fresh : null
  } catch {
    return null
  }
}

/** Best-effort refresh of the stored channel reference for later views. */
async function persistFreshMediaUrl(messageId: string, metadata: unknown, freshUrl: string) {
  try {
    const next = JSON.parse(JSON.stringify(metadata ?? {})) as Record<string, unknown>
    const inbound = (next.vigentoInbound && typeof next.vigentoInbound === 'object')
      ? (next.vigentoInbound as Record<string, unknown>)
      : {}
    inbound.mediaUrl = freshUrl
    next.vigentoInbound = inbound
    await prisma.message.update({
      where: { id: messageId },
      data: { metadata: next as Prisma.InputJsonObject },
    })
  } catch {
    // A metadata refresh failure must never break the media response.
  }
}

export async function GET(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return unavailable(401, 'UNAUTHORIZED')

  const message = await prisma.message.findFirst({
    where: {
      id: params.messageId,
      conversationId: params.conversationId,
      conversation: { workspaceId: user.workspaceId },
    },
    select: {
      id: true,
      metadata: true,
      conversation: { select: { channel: true, agentId: true } },
    },
  })
  if (!message) return unavailable(404, 'NOT_FOUND')

  const media = readInboundMedia(message.metadata)
  if (!media || (!media.mediaUrl && !media.mediaFileId)) {
    return unavailable(404, 'MEDIA_UNAVAILABLE')
  }

  let targetUrl: string | null = null

  if (media.mediaUrl) {
    targetUrl = media.mediaUrl
  } else if (media.mediaFileId) {
    const channel = message.conversation.channel
    if (channel !== 'TELEGRAM' && channel !== 'BALE') {
      return unavailable(404, 'MEDIA_CHANNEL_UNSUPPORTED')
    }
    const channelRow = await prisma.agentChannel.findFirst({
      where: {
        agentId: message.conversation.agentId,
        type: channel,
        active: true,
      },
      select: { config: true },
    })
    const token = channelRow ? readBotToken(channelRow.config) : null
    if (!token) return unavailable(404, 'MEDIA_CHANNEL_UNAVAILABLE')
    const adapter = getAdapter(channel, token)
    // getFile is generic: it resolves photo/video/voice/document file ids as
    // well, so the same helper serves every Telegram/Bale media kind.
    targetUrl = (await adapter.getVoiceUrl?.(media.mediaFileId)) ?? null
  }

  if (!targetUrl) return unavailable(404, 'MEDIA_UNAVAILABLE')

  let served = await fetchMediaBytes(targetUrl)

  // ─ A15 fallback: an expired Instagram CDN signature is not the end of the
  // line for photos/videos. The Graph message endpoint can re-issue a fresh
  // URL on demand, keeping the dashboard preview alive without storing bytes.
  if (!served && message.conversation.channel === 'INSTAGRAM' && media.platformMessageId) {
    const freshUrl = await resolveFreshInstagramMediaUrl(
      message.conversation.agentId,
      media.platformMessageId,
    )
    if (freshUrl && freshUrl !== targetUrl) {
      served = await fetchMediaBytes(freshUrl)
      if (served) {
        await persistFreshMediaUrl(message.id, message.metadata, freshUrl)
      }
    }
  }

  if (!served) return unavailable(404, 'MEDIA_UNAVAILABLE')
  return mediaResponse(served.body, served.contentType)
}
