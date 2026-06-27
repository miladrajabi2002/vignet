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
}

/** Outbound voice payload (raw audio bytes + mime). */
export interface OutboundVoice {
  audio: Buffer
  mime: string
}

export interface MessengerAdapter {
  readonly channel: ChannelType
  /** Parse a raw webhook body into normalized messages (0..n). */
  parseUpdate(body: unknown): InboundMessage[]
  /** Send a plain text reply. */
  sendText(chatId: string, text: string): Promise<void>
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
