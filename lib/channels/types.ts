import type { ChannelType } from '@prisma/client'

/**
 * Adapter pattern for messenger platforms (Telegram, Bale, Rubika, …).
 *
 * The core inbound pipeline never imports a platform SDK directly — it only
 * talks to this interface. This isolates unstable APIs (notably Rubika) behind
 * a single, swappable implementation.
 */

/** A normalized inbound message, platform-agnostic. */
export interface InboundMessage {
  /** Platform chat/user id used to address replies and key the contact. */
  chatId: string
  /** Sender's external user id (often === chatId for 1:1 chats). */
  senderId: string
  /** Display name of the sender, when available. */
  senderName?: string
  /** Sender's public handle/username (e.g. Telegram @username, IG @handle). Stored separately from the display name so the CRM can show both. */
  senderUsername?: string
  /** Sender's profile picture URL (best-effort, fetched via a platform API call). null/undefined when unavailable. */
  senderAvatarUrl?: string
  /** Sender phone number, when the platform exposes it (e.g. Rubika). */
  senderPhone?: string
  /** Plain text body (empty for pure voice/media messages). */
  text: string
  /** Platform-native id of this inbound message (Instagram `mid`, etc.). */
  platformMessageId?: string
  /** Opaque file id for an attached voice message, if any. */
  voiceFileId?: string
  /** When the inbound is itself a reply to another message (e.g. Telegram reply_to_message), the platform message id being quoted. */
  replyToMessageId?: string
  /**
   * True when the message arrived in a "pending" / "message request" folder
   * (Instagram & Messenger: DMs from non-followers). The reply (if any) will
   * likely be refused by the platform until the recipient accepts the request.
   * The shared inbound pipeline uses this to skip a doomed auto-reply and
   * instead surface the inbound so an operator can accept it manually.
   */
  pendingFolder?: boolean
  /**
   * Logical message kind — primarily for Instagram automation routing. Other
   * channels default to 'DM'. Instagram sets COMMENT for public post/reel
   * comments, STORY_REPLY for a DM that quotes a story, and STORY_MENTION when
   * the account is mentioned in a user's story.
   */
  kind?: 'DM' | 'COMMENT' | 'REACTION' | 'STORY_REPLY' | 'STORY_REACTION' | 'STORY_MENTION'
  /** Instagram only: the post/reel media id a comment was left on. */
  postId?: string
  /** Instagram only: the comment id (for public replies). */
  commentId?: string
  /** Instagram only: the story id a reply/mention refers to. */
  storyId?: string
  /** Instagram only: story media type ('IMAGE' | 'VIDEO'). */
  storyMediaType?: string
  /** Instagram only: story media URL (expires quickly). */
  storyUrl?: string
}

/** Outbound voice payload (raw audio bytes + mime). */
export interface OutboundVoice {
  audio: Buffer
  mime: string
}

/**
 * Optional extras for an outbound text reply. Adapters use what their platform
 * supports and silently ignore the rest, so callers can always pass them.
 */
export interface SendOptions {
  /**
   * Suggested-question buttons shown with the reply. Tapping one sends its
   * text back as a normal user message (no callback handling needed).
   */
  quickReplies?: string[]
}

export interface MessengerAdapter {
  readonly channel: ChannelType
  /** Parse a raw webhook body into normalized messages (0..n). */
  parseUpdate(body: unknown): InboundMessage[]
  /** Send a plain text reply (with optional platform extras). */
  sendText(chatId: string, text: string, opts?: SendOptions): Promise<void>
  /**
   * Show a "typing…" indicator while the reply is being generated. Optional and
   * best-effort — platforms that don't support it simply omit this method, and
   * callers must not let its failure block the actual reply.
   */
  sendTyping?(chatId: string): Promise<void>
  /** Send a voice reply. Optional — falls back to text when unsupported. */
  sendVoice?(chatId: string, voice: OutboundVoice): Promise<void>
  /** Resolve a downloadable URL for an inbound voice file. Optional. */
  getVoiceUrl?(fileId: string): Promise<string | null>
  /**
   * Fetch the sender's profile picture URL (best-effort). Used to backfill the
   * contact's per-channel avatar in the CRM. Platforms that don't expose
   * customer avatars (such as Rubika) omit this method. Returns null when the
   * user has no photo or the platform refuses.
   */
  getAvatarUrl?(userId: string): Promise<string | null>
  /**
   * Fetch the sender's full profile (display name, username, avatar URL) in one
   * call. Used to backfill the contact's per-channel identity in the CRM —
   * Instagram DM webhooks only carry the sender id + username (no display name
   * or avatar), so we make a separate Graph API call to enrich the contact.
   * Returns null when the platform doesn't support it or the API refuses.
   */
  getSenderProfile?(
    userId: string,
  ): Promise<{ name?: string; username?: string; avatarUrl?: string } | null>
  /** Best-effort reaction to an inbound platform message. */
  reactToMessage?(messageId: string, recipientId: string): Promise<void>
  /** Best-effort like of a public comment. */
  likeComment?(commentId: string): Promise<void>
}
