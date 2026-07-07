import type { Prisma } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/crypto'
import { newWebhookToken } from '@/lib/channels/config'

/**
 * WhatsApp Cloud API OAuth connection config — stored encrypted in
 * `AgentChannel.config`.
 *
 * vigent owns ONE Meta App with the WhatsApp Business API product enabled. An
 * operator clicks "Connect WhatsApp" → Facebook Login (WhatsApp Embedded Signup)
 * → authorizes → we get a code → exchange for a long-lived User Access Token →
 * fetch their WhatsApp Business Account (WABA) + phone numbers → persist the
 * channel. The operator never creates their own Meta App or pastes a token.
 *
 * Required Graph API scopes:
 *   - whatsapp_business_management   → manage the WABA + phone numbers
 *   - whatsapp_business_messaging    → send/receive messages
 *
 * For sending messages, the WhatsApp Cloud API accepts the long-lived USER
 * token (with `whatsapp_business_messaging`). We therefore store the long-lived
 * user token as the access token. (A permanent system-user token would also
 * work; for simplicity we use the user token, refreshed by the worker.)
 *
 * Backward compatibility with the legacy `accessToken|phoneNumberId` token
 * model used by the existing `whatsappAdapter` (`lib/channels/whatsapp.ts`) is
 * preserved by ALSO populating `botTokenEnc` with the encrypted packed string
 * `${userToken}|${phoneNumberId}`. The legacy `readBotToken` from
 * `lib/channels/config.ts` then returns this packed string verbatim, the
 * adapter parses it as before, and the whole inbound pipeline runs unchanged.
 *
 * The `webhookToken` is kept so the global WhatsApp webhook can demux events by
 * phone number id → resolve the channel → look up its webhookToken → call
 * `handleInbound('WHATSAPP', webhookToken, body)`, which is the same shared
 * pipeline the legacy per-token webhook used.
 */
export interface WhatsappOAuthConfig {
  /** Per-channel webhook token (used by `handleInbound` to resolve the channel). */
  webhookToken: string
  /** Connection model: 'OAUTH' (platform-managed) | 'LEGACY' (user-pasted token). */
  mode: 'OAUTH' | 'LEGACY'
  /** Encrypted long-lived User Access Token (~60-day, refreshed by the worker). */
  userTokenEnc?: string
  /** ISO time when the long-lived user token expires. */
  userTokenExpiresAt?: string
  /** WhatsApp Business Account (WABA) id — the routing key for the global webhook. */
  wabaId?: string
  /** Phone Number id (per-WABA; the destination of all outbound messages). */
  phoneNumberId?: string
  /**
   * Encrypted permanent access token for the phone number. In practice we store
   * the long-lived USER token here (Cloud API accepts it for sending when the
   * `whatsapp_business_messaging` scope is granted). Kept as a separate field
   * from `userTokenEnc` so a future migration to system-user tokens is a 1-line
   * change.
   */
  phoneNumberEnc?: string
  /** Display phone number in E.164 (e.g. "+989121234567") — shown in the UI. */
  displayPhoneNumber?: string
  /** Verified business display name (e.g. "Vardast Shop") — shown in the UI. */
  verifiedName?: string
  /**
   * For LEGACY mode: the encrypted bot token in the old `accessToken|phoneNumberId`
   * format. For OAUTH mode, this is ALSO populated with the same packed string
   * so the legacy `readBotToken` keeps working unchanged.
   */
  botTokenEnc?: string
  /** Optional per-channel behavior settings (quick replies). */
  settings?: { quickReplies: string[] }
}

/** Build a fresh OAuth config from the OAuth callback's resolved credentials. */
export function buildWhatsappOAuthConfig(input: {
  userToken: string
  userTokenExpiresAt: Date
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  verifiedName?: string
}): WhatsappOAuthConfig {
  const packed = `${input.userToken}|${input.phoneNumberId}`
  return {
    webhookToken: newWebhookToken(),
    mode: 'OAUTH',
    userTokenEnc: encrypt(input.userToken),
    userTokenExpiresAt: input.userTokenExpiresAt.toISOString(),
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    phoneNumberEnc: encrypt(input.userToken),
    displayPhoneNumber: input.displayPhoneNumber,
    verifiedName: input.verifiedName,
    // Keep the legacy `readBotToken` pipeline working: it returns this packed
    // string, the whatsappAdapter parses it as `accessToken|phoneNumberId`, and
    // the shared inbound/outbound pipeline runs unchanged.
    botTokenEnc: encrypt(packed),
  }
}

/**
 * Decrypt the phone-number access token from a stored OAuth config. Falls back
 * to the legacy `botTokenEnc` (which is also the packed string for OAUTH
 * channels, so this returns the same value either way).
 *
 * Returns the packed `accessToken|phoneNumberId` string the adapter expects.
 */
export function readWhatsappToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappOAuthConfig> | null
  if (c?.mode === 'OAUTH') {
    // Prefer the packed botTokenEnc (legacy-compatible) so the downstream
    // `whatsappAdapter` parses it directly.
    if (c.botTokenEnc) {
      try {
        return decrypt(c.botTokenEnc)
      } catch {
        return null
      }
    }
    // Fallback: re-construct the packed string from userToken + phoneNumberId.
    if (c.phoneNumberEnc && c.phoneNumberId) {
      try {
        const tok = decrypt(c.phoneNumberEnc)
        return `${tok}|${c.phoneNumberId}`
      } catch {
        return null
      }
    }
  }
  // Legacy single-token fallback (the user pasted `accessToken|phoneNumberId`).
  if (c?.botTokenEnc) {
    try {
      return decrypt(c.botTokenEnc)
    } catch {
      return null
    }
  }
  return null
}

/** Decrypt the long-lived User Access Token (for refresh + WABA lookups). */
export function readUserToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappOAuthConfig> | null
  if (!c?.userTokenEnc) return null
  try {
    return decrypt(c.userTokenEnc)
  } catch {
    return null
  }
}

/** Read the WhatsApp Business Account (WABA) id — routing key for the global webhook. */
export function readWabaId(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappOAuthConfig> | null
  return c?.wabaId ?? null
}

/** Read the Phone Number id — secondary routing key for the global webhook. */
export function readPhoneNumberId(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappOAuthConfig> | null
  return c?.phoneNumberId ?? null
}

/** Read the webhook token (used by `handleInbound` to resolve the channel). */
export function readWebhookToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<WhatsappOAuthConfig> | null
  return c?.webhookToken ?? null
}

/** Is this channel connected via the new OAuth flow? */
export function isWhatsappOAuthChannel(config: Prisma.JsonValue): boolean {
  const c = config as Partial<WhatsappOAuthConfig> | null
  return c?.mode === 'OAUTH'
}

/** When does the long-lived user token expire? Null for legacy channels. */
export function userTokenExpiry(config: Prisma.JsonValue): Date | null {
  const c = config as Partial<WhatsappOAuthConfig> | null
  if (!c?.userTokenExpiresAt) return null
  const d = new Date(c.userTokenExpiresAt)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Normalize the `settings` blob into a safe quick-replies array. */
export function normalizeWhatsappSettings(config: Prisma.JsonValue): {
  quickReplies: string[]
} {
  const c =
    config && typeof config === 'object'
      ? (config as Record<string, unknown>)
      : {}
  const s =
    c.settings && typeof c.settings === 'object'
      ? (c.settings as Record<string, unknown>)
      : {}
  const quickReplies = Array.isArray(s.quickReplies)
    ? s.quickReplies
        .filter((q): q is string => typeof q === 'string' && !!q.trim())
        .map((q) => q.trim().slice(0, 40))
        .slice(0, 4)
    : []
  return { quickReplies }
}
