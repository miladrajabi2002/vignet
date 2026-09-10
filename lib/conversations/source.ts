import type { ChannelType, Prisma } from '@prisma/client'
import type { InboundMessage } from '@/lib/channels/types'

export type InboundSourceKind =
  | 'DM'
  | 'COMMENT'
  | 'REACTION'
  | 'STORY_REPLY'
  | 'STORY_REACTION'
  | 'STORY_MENTION'
  | 'MESSAGE'

export type InboundSource = {
  channel: ChannelType
  kind: InboundSourceKind
  platformMessageId?: string
  replyToMessageId?: string
  postId?: string
  commentId?: string
  storyId?: string
  storyMediaType?: string
  pendingFolder?: boolean
  /**
   * Verified attachment reference (view-time only, never a stored file):
   * `mediaKind` + `mediaUrl` (Instagram CDN URL) or `mediaFileId`
   * (Telegram/Bale file id resolved via getFile on demand).
   */
  mediaKind?: 'photo' | 'video' | 'voice' | 'sticker' | 'file' | 'audio'
  mediaUrl?: string
  mediaFileId?: string
}

/** Stable metadata written on every messenger USER message. */
export function inboundMessageMetadata(
  channel: ChannelType,
  message: InboundMessage,
): Prisma.InputJsonObject {
  const source: Record<string, Prisma.InputJsonValue> = {
    channel,
    kind: channel === 'INSTAGRAM' ? (message.kind ?? 'DM') : 'MESSAGE',
  }
  if (message.platformMessageId) source.platformMessageId = message.platformMessageId
  if (message.replyToMessageId) source.replyToMessageId = message.replyToMessageId
  if (message.postId) source.postId = message.postId
  if (message.commentId) source.commentId = message.commentId
  if (message.storyId) source.storyId = message.storyId
  if (message.storyMediaType) source.storyMediaType = message.storyMediaType
  if (message.pendingFolder) source.pendingFolder = true
  // Verified channel attachment reference for view-time media display. The
  // URL/id is a channel-scoped pointer only — the media proxy route resolves
  // it live and the file is never persisted on this server.
  const mediaKind = message.voiceFileId && !message.mediaKind ? 'voice' : message.mediaKind
  if (mediaKind) source.mediaKind = mediaKind
  if (message.mediaUrl) source.mediaUrl = message.mediaUrl
  const mediaFileId = message.mediaFileId ?? message.voiceFileId
  if (mediaFileId) source.mediaFileId = mediaFileId
  return { vigentoInbound: source as Prisma.InputJsonObject }
}

export function readInboundSource(metadata: unknown): InboundSource | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).vigentoInbound
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (typeof row.channel !== 'string' || typeof row.kind !== 'string') return null
  return row as InboundSource
}

export function inboundSourceLabel(source: InboundSource | null, locale: 'fa' | 'en'): string | null {
  if (!source) return null
  if (source.channel !== 'INSTAGRAM') return null
  const fa: Record<InboundSourceKind, string> = {
    DM: 'دایرکت اینستاگرام',
    COMMENT: 'کامنت اینستاگرام',
    REACTION: 'ری‌اکشن اینستاگرام',
    STORY_REPLY: 'پاسخ به استوری',
    STORY_REACTION: 'ری‌اکشن استوری',
    STORY_MENTION: 'منشن در استوری',
    MESSAGE: 'پیام اینستاگرام',
  }
  const en: Record<InboundSourceKind, string> = {
    DM: 'Instagram DM',
    COMMENT: 'Instagram comment',
    REACTION: 'Instagram reaction',
    STORY_REPLY: 'Story reply',
    STORY_REACTION: 'Story reaction',
    STORY_MENTION: 'Story mention',
    MESSAGE: 'Instagram message',
  }
  return (locale === 'fa' ? fa : en)[source.kind] ?? (locale === 'fa' ? 'پیام اینستاگرام' : 'Instagram message')
}
