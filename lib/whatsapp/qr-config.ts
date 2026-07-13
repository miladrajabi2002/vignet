import type { Prisma } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/crypto'
import { newWebhookToken } from '@/lib/channels/config'

/**
 * WhatsApp QR-bridge connection config — stored encrypted in
 * `AgentChannel.config`, alongside (but disjoint from) the existing OAuth
 * config in `lib/whatsapp/config.ts`.
 *
 * Connection model: the operator scans a QR code (or pairs by phone number)
 * in the dashboard. A long-running mini-service (`mini-services/whatsapp-bridge`,
 * a Baileys-based process on port 3040) holds the WhatsApp Web session and
 * forwards inbound messages to `/api/webhook/whatsapp-qr`. The Next.js app
 * sends outbound replies back to the bridge via `POST /send-text`.
 *
 * The `mode: 'QR'` flag distinguishes this from the existing OAuth (`'OAUTH'`)
 * and legacy-token (`'LEGACY'`) modes. The shared `readWhatsappToken` /
 * `readBotToken` pipeline returns the synthetic packed string `qr:<sessionId>`,
 * which `whatsappAdapter.sendText` recognises and routes to the bridge instead
 * of the Meta Graph API.
 *
 * Why a synthetic token? The shared inbound pipeline (`resolveChannel` →
 * `readBotToken` → `getAdapter('WHATSAPP', token)`) is wired around a single
 * packed-string token. Reusing it means QR channels flow through the SAME
 * pipeline as OAuth channels — no separate inbound path, no parallel adapter —
 * only the final "send" step branches on the `qr:` prefix.
 */
export interface WhatsappQrConfig {
  /** Per-channel webhook token (used by `handleInbound` to resolve the channel). */
  webhookToken: string
  /** Connection model: 'QR' (Baileys bridge). */
  mode: 'QR'
  /**
   * Bridge session id — the key under which the bridge persists the Baileys
   * auth state (`./auth/<sessionId>/` in the bridge process). Reusing it on
   * reconnect lets the operator skip re-scanning the QR.
   */
  bridgeSessionId: string
  /** Encrypted packed string `qr:<sessionId>` — what `readBotToken` returns. */
  botTokenEnc: string
  /** Connected WhatsApp number in E.164 (e.g. "+989121234567"), filled after login. */
  displayPhoneNumber?: string
  /** WhatsApp account display name (pushName), filled after login. */
  verifiedName?: string
  /** Optional per-channel behavior settings (quick replies). */
  settings?: { quickReplies: string[] }
}

/** Generate a URL-safe session id for the bridge (used as the auth-folder name). */
export function newBridgeSessionId(): string {
  // 16 bytes base64url → 22 chars, plenty unique per workspace+channel.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

/** Pack `qr:<sessionId>` into the synthetic token the adapter understands. */
export function packQrToken(sessionId: string): string {
  return `qr:${sessionId}`
}

/** Build a fresh QR config from a bridge session id + connected phone info. */
export function buildWhatsappQrConfig(input: {
  bridgeSessionId: string
  displayPhoneNumber?: string
  verifiedName?: string
}): WhatsappQrConfig {
  const packed = packQrToken(input.bridgeSessionId)
  return {
    webhookToken: newWebhookToken(),
    mode: 'QR',
    bridgeSessionId: input.bridgeSessionId,
    botTokenEnc: encrypt(packed),
    displayPhoneNumber: input.displayPhoneNumber,
    verifiedName: input.verifiedName,
  }
}

/** Is this channel connected via the QR bridge (Bailes)? */
export function isWhatsappQrChannel(config: Prisma.JsonValue): boolean {
  const c = config as Partial<WhatsappQrConfig> | null
  return c?.mode === 'QR'
}

/** Read the bridge session id from a stored QR config. */
export function readBridgeSessionId(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappQrConfig> | null
  return c?.bridgeSessionId ?? null
}

/**
 * Decrypt the synthetic `qr:<sessionId>` packed token. Returns null for
 * non-QR configs or malformed values. Used by `readWhatsappToken` /
 * `readBotToken` so the shared pipeline never has to know about QR mode
 * specifically.
 */
export function readQrToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappQrConfig> | null
  if (c?.mode !== 'QR') return null
  // Prefer the stored packed string; reconstruct from sessionId as a fallback.
  if (c.botTokenEnc) {
    try {
      return decrypt(c.botTokenEnc)
    } catch {
      /* fall through */
    }
  }
  if (c.bridgeSessionId) return packQrToken(c.bridgeSessionId)
  return null
}

/** Bridge base URL (with trailing slash stripped). Defaults to localhost:3040. */
export function bridgeBaseUrl(): string {
  return (process.env.WHATSAPP_BRIDGE_URL ?? 'http://localhost:3040').replace(
    /\/$/,
    '',
  )
}

/** Shared secret for Next.js → bridge and bridge → Next.js requests. */
export function bridgeSecret(): string {
  return process.env.WHATSAPP_BRIDGE_SECRET ?? ''
}

/** Headers to send when calling the bridge from the Next.js side. */
export function bridgeHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const s = bridgeSecret()
  if (s) h['x-bridge-secret'] = s
  return h
}

/**
 * Extract the bare session id from a synthetic `qr:<sessionId>` token.
 * Returns null when the token isn't a QR token.
 */
export function parseQrToken(token: string): string | null {
  if (!token.startsWith('qr:')) return null
  const id = token.slice(3)
  return /^[A-Za-z0-9_-]{4,64}$/.test(id) ? id : null
}
