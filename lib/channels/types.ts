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
  /** Sender phone number, when the platform exposes it (e.g. Rubika). */
  senderPhone?: string
  /** Plain text body (empty for pure voice/media messages). */
  text: string
  /** Opaque file id for an attached voice message, if any. */
  voiceFileId?: string
  /**
   * True when the message arrived in a "pending" / "message request" folder
   * (Instagram & Messenger: DMs from non-followers). The reply (if any) will
   * likely be refused by the platform until the recipient accepts the request.
   * The shared inbound pipeline uses this to skip a doomed auto-reply and
   * instead surface the inbound so an operator can accept it manually.
   */
  pendingFolder?: boolean
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
}
