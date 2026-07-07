import crypto from 'crypto'
import { GRAPH_BASE } from '@/lib/channels/whatsapp'

/**
 * WhatsApp Cloud API OAuth (Facebook Login with WhatsApp Embedded Signup) —
 * the "one click connect" model, mirroring the Instagram OAuth flow.
 *
 * vigent owns a single Meta App with the WhatsApp Business API product. An
 * operator clicks "Connect WhatsApp" → Facebook Login dialog opens (this is the
 * Embedded Signup flow that Meta renders with the WhatsApp-specific consent UI)
 * → after authorization, Meta redirects back with a `code` which we exchange
 * for a long-lived User Access Token. We then fetch the user's WhatsApp
 * Business Account(s) (WABAs) and the phone numbers registered to each. The
 * user picks the phone number to connect (or we auto-connect when there's only
 * one), and we persist the channel.
 *
 * For sending messages via the Cloud API, we use the long-lived USER token
 * (with the `whatsapp_business_messaging` scope granted). This works for
 * standard OAuth connections. (For higher-volume production deployments a
 * permanent System User token is preferred; that's a 1-line swap in
 * `buildWhatsappOAuthConfig`.)
 *
 * Required env vars (same as Instagram OAuth — vigent owns ONE Meta App with
 * BOTH the Instagram Graph API and WhatsApp Business API products enabled):
 *   META_APP_ID              — the App ID of vigent's Meta App
 *   META_APP_SECRET          — the App Secret
 *   META_APP_VERIFY_TOKEN    — arbitrary string set on the App webhook config
 *   NEXT_PUBLIC_APP_URL      — public base URL (e.g. https://vigent.ir)
 *
 * The OAuth redirect URI is `${APP_URL}/api/whatsapp/oauth/callback` and must
 * be added to "Valid OAuth Redirect URIs" in the App dashboard (Basic settings).
 */

const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_BASE.split('/').pop()}/dialog/oauth`

/**
 * Scopes requested at connect time. These map to the WhatsApp Embedded Signup
 * consent screen:
 *
 *   whatsapp_business_management  → manage the WABA + phone numbers
 *   whatsapp_business_messaging   → send/receive messages
 */
export const WHATSAPP_OAUTH_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
] as const

/** A pending OAuth handshake, signed with HMAC so it can't be tampered with. */
export interface WhatsappOAuthState {
  agentId: string
  workspaceId: string
  nonce: string
  /** Optional: where to send the user after a successful connect. */
  returnTo?: string
}

function stateSecret(): string {
  const s = process.env.META_APP_SECRET ?? process.env.ENCRYPTION_KEY
  if (!s) throw new Error('META_APP_SECRET (or ENCRYPTION_KEY) is not set')
  return s
}

/** Serialize + sign a WhatsappOAuthState so the callback can trust it. */
export function signState(state: WhatsappOAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', stateSecret())
    .update(payload)
    .digest('base64url')
  return `${payload}.${sig}`
}

/** Verify + decode a signed state string. Returns null on any tampering. */
export function verifyState(raw: string): WhatsappOAuthState | null {
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  const expected = crypto
    .createHmac('sha256', stateSecret())
    .update(payload)
    .digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null
  }
  try {
    return JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as WhatsappOAuthState
  } catch {
    return null
  }
}

/** The public callback URL Meta redirects to after the user authorizes. */
export function whatsappRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/whatsapp/oauth/callback`
}

/** Build the Facebook OAuth dialog URL the user is sent to. */
export function buildWhatsappAuthUrl(state: string): string {
  const clientId = process.env.META_APP_ID
  if (!clientId) throw new Error('META_APP_ID is not set')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: whatsappRedirectUri(),
    response_type: 'code',
    scope: WHATSAPP_OAUTH_SCOPES.join(','),
    state,
    // Force a re-authorization prompt when reconnecting a different account.
    auth_type: 'rerequest',
  })
  return `${OAUTH_DIALOG}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

/** Exchange the OAuth `code` for a short-lived User Access Token. */
export async function exchangeCodeForUserToken(
  code: string,
): Promise<{ token: string; expiresIn: number }> {
  const clientId = process.env.META_APP_ID
  const clientSecret = process.env.META_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('META_APP_ID / META_APP_SECRET not set')
  }
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('redirect_uri', whatsappRedirectUri())
  url.searchParams.set('code', code)
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as TokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(
      `WhatsApp OAuth code exchange failed: ${JSON.stringify(data)}`,
    )
  }
  return { token: data.access_token, expiresIn: data.expires_in ?? 3600 }
}

/**
 * Exchange a short-lived User Token for a long-lived one (~60 days).
 * Long-lived tokens can be refreshed indefinitely (see {@link refreshLongLivedToken}).
 */
export async function exchangeForLongLivedToken(
  shortToken: string,
): Promise<{ token: string; expiresAt: Date }> {
  const clientId = process.env.META_APP_ID
  const clientSecret = process.env.META_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('META_APP_ID / META_APP_SECRET not set')
  }
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('fb_exchange_token', shortToken)
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as TokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Long-lived token exchange failed: ${JSON.stringify(data)}`,
    )
  }
  // Long-lived user tokens are ~60 days. expires_in is in seconds.
  const ttl = data.expires_in ?? 60 * 24 * 60 * 60
  return {
    token: data.access_token,
    expiresAt: new Date(Date.now() + ttl * 1000),
  }
}

/**
 * Refresh a long-lived User Token. Returns a fresh ~60-day token. Should be
 * called well before expiry (the worker does this daily for all OAuth channels).
 */
export async function refreshLongLivedToken(
  longToken: string,
): Promise<{ token: string; expiresAt: Date }> {
  const clientId = process.env.META_APP_ID
  const clientSecret = process.env.META_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('META_APP_ID / META_APP_SECRET not set')
  }
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('fb_exchange_token', longToken)
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as TokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  }
  const ttl = data.expires_in ?? 60 * 24 * 60 * 60
  return {
    token: data.access_token,
    expiresAt: new Date(Date.now() + ttl * 1000),
  }
}

/** A WhatsApp Business phone number resolved during the OAuth flow. */
export interface WhatsappPhoneNumber {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  verifiedName?: string
  /** The access token used to send messages from this number (the long-lived user token). */
  accessToken: string
}

/**
 * List the user's WhatsApp Business Accounts (WABAs) and the phone numbers
 * registered to each. The user's Pages are queried first (`/me/accounts` with
 * the `whatsapp_business_account` field); each Page that has a WABA contributes
 * its WABA id. Then for each WABA we list the phone numbers with their display
 * name + verified name.
 *
 * Returns a flat array of {@link WhatsappPhoneNumber} — one entry per phone
 * number — so the caller can present a simple "pick the number to connect" UI
 * (or auto-connect when there's exactly one).
 */
export async function listWhatsappBusinessAccounts(
  userToken: string,
): Promise<WhatsappPhoneNumber[]> {
  // 1) Get the user's Pages with their linked WABA (if any).
  const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`)
  pagesUrl.searchParams.set('access_token', userToken)
  pagesUrl.searchParams.set(
    'fields',
    'id,name,whatsapp_business_account',
  )
  pagesUrl.searchParams.set('limit', '100')
  const pagesRes = await fetch(pagesUrl)
  const pagesJson = (await pagesRes.json()) as {
    data?: Array<{
      id: string
      name?: string
      whatsapp_business_account?: { id: string }
    }>
    error?: unknown
  }
  if (!pagesRes.ok) {
    throw new Error(
      `Failed to list WhatsApp Business Accounts: ${JSON.stringify(pagesJson)}`,
    )
  }
  const pages = pagesJson.data ?? []

  // Collect distinct WABA ids (a Page may not have a WABA; multiple Pages may
  // share a WABA — dedupe so we don't list phone numbers twice).
  const wabaIds = new Map<string, true>()
  for (const p of pages) {
    const wabaId = p.whatsapp_business_account?.id
    if (wabaId) wabaIds.set(wabaId, true)
  }
  if (!wabaIds.size) return []

  // 2) For each WABA, list its phone numbers.
  const out: WhatsappPhoneNumber[] = []
  for (const wabaId of wabaIds.keys()) {
    try {
      const phUrl = new URL(`${GRAPH_BASE}/${wabaId}/phone_numbers`)
      phUrl.searchParams.set('access_token', userToken)
      phUrl.searchParams.set(
        'fields',
        'display_phone_number,verified_name,name_status',
      )
      phUrl.searchParams.set('limit', '100')
      const phRes = await fetch(phUrl)
      const phJson = (await phRes.json()) as {
        data?: Array<{
          id: string
          display_phone_number?: string
          verified_name?: string
          name_status?: string
        }>
        error?: unknown
      }
      if (!phRes.ok) {
        console.error(
          `[whatsapp] failed to list phone numbers for WABA ${wabaId}:`,
          phJson,
        )
        continue
      }
      for (const ph of phJson.data ?? []) {
        // Skip numbers whose name hasn't been approved yet — they can receive
        // but the display name is "not approved" which is confusing in the UI.
        // We still include them so the operator can pick the right one; the
        // status is just logged.
        out.push({
          wabaId,
          phoneNumberId: ph.id,
          displayPhoneNumber: ph.display_phone_number,
          verifiedName: ph.verified_name,
          accessToken: userToken,
        })
      }
    } catch (e) {
      console.error(
        `[whatsapp] listWhatsappBusinessAccounts: WABA ${wabaId} failed:`,
        e,
      )
    }
  }
  return out
}

/**
 * Subscribe a WABA to the app's webhook subscription so Meta starts sending
 * inbound message events for that WABA to our global webhook. Called once per
 * connection right after we persist the channel.
 */
export async function subscribeWabaToWebhook(
  wabaId: string,
  token: string,
): Promise<boolean> {
  const url = new URL(`${GRAPH_BASE}/${wabaId}/subscribed_apps`)
  url.searchParams.set('access_token', token)
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    console.error(
      `[whatsapp] subscribeWabaToWebhook(${wabaId}) failed:`,
      body,
    )
    return false
  }
  return true
}
