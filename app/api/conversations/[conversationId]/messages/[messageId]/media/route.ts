import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { getAdapter } from '@/lib/channels/registry'
import { safeHttpGet } from '@/lib/security/safe-http'

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
 */

const ALLOWED_MEDIA_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'application/octet-stream',
]
const MAX_MEDIA_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

interface InboundMediaReference {
  mediaKind?: string
  mediaUrl?: string
  mediaFileId?: string
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

  try {
    const response = await safeHttpGet(targetUrl, {
      allowedContentTypes: ALLOWED_MEDIA_CONTENT_TYPES,
      maxBytes: MAX_MEDIA_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: 2,
    })
    if (response.status !== 200 || response.body.length === 0) {
      return unavailable(404, 'MEDIA_UNAVAILABLE')
    }
    const contentType = String(response.headers['content-type'] ?? 'application/octet-stream')
    return mediaResponse(response.body, contentType)
  } catch {
    // Expired Instagram CDN URLs, revoked Telegram files, content-type
    // mismatches and blocked targets all land here: the UI renders its
    // placeholder chip via <img>/<video> onError.
    return unavailable(404, 'MEDIA_UNAVAILABLE')
  }
}
