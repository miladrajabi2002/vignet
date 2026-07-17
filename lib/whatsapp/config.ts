import { encrypt } from '@/lib/crypto'
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
