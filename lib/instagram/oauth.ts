import crypto from 'crypto'

/**
 * Instagram Login flow (Business Login for Instagram / "Instagram API with
 * Instagram Login") — the direct-Instagram OAuth flow that launched July 2024.
 *
 * This is the flow Vardast uses: the user clicks "Connect" and is sent directly
 * to Instagram (api.instagram.com/oauth/authorize), NOT to Facebook. If they're
 * already logged into Instagram in their browser, no login form appears — they
 * go straight to the consent screen ("vigent-IG is requesting access to…").
 *
 * The previous Facebook Login flow showed Facebook's UI, required the user to
 * pick a Facebook Page, and was confusing. Instagram Login is simpler:
 *   - Direct Instagram authentication (no Facebook involved)
 *   - No Page picker (the IG account IS the identity)
 *   - The returned Instagram User Access Token works on graph.instagram.com
 *     for ALL operations: profile, comments, AND messages (DMs)
 *
 * Required env vars (same Meta App, just with the "Instagram Platform" product
 * added and "Instagram API with Instagram Login" enabled):
 *   INSTAGRAM_APP_ID          — the Instagram App ID (DIFFERENT from Facebook App ID!)
 *                              Found in App Dashboard → Instagram → API Setup with Instagram Login
 *   INSTAGRAM_APP_SECRET      — the Instagram App Secret (DIFFERENT from Facebook App Secret!)
 *   META_APP_VERIFY_TOKEN     — arbitrary string for webhook verification
 *   NEXT_PUBLIC_APP_URL       — public base URL (e.g. https://vigent.ir)
 *
 * IMPORTANT: For Instagram Login, you MUST use the Instagram App ID/Secret from the
 * "API Setup with Instagram Login" page — NOT the Facebook App ID from App Settings → Basic.
 * Using the Facebook App ID causes the error:
 *   "Invalid Request: Request parameters are invalid: Invalid platform app"
 *
 * The OAuth redirect URI is `${APP_URL}/api/instagram/oauth/callback`.
 *
 * IMPORTANT: In the Meta App dashboard, you must:
 *   1. Add the "Instagram Platform" product
 *   2. Choose "Instagram API with Instagram Login"
 *   3. Add the redirect URI to "Valid OAuth Redirect URIs" (under Instagram →
 *      API Setup with Instagram Login, NOT under Facebook Login)
 *   4. The webhook is configured at the app level (Callback URL:
 *      /api/webhook/instagram, same as before)
 */

const GRAPH_VERSION = 'v21.0'
/** Instagram Graph API base — all API calls with IG tokens go here. */
export const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`
/** OAuth authorization endpoint — the consent screen URL. */
const OAUTH_DIALOG = 'https://api.instagram.com/oauth/authorize'
/** OAuth token exchange endpoint. */
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'

/**
 * Scopes requested at connect time. These use the NEW scope names (the old
 * `instagram_basic` / `instagram_manage_messages` etc. were deprecated
 * Jan 27, 2025).
 *
 * The consent screen the user sees maps to:
 *   instagram_business_basic          → "View profile and access media (required)"
 *   instagram_business_manage_messages → "Access and manage messages"
 *   instagram_business_manage_comments → "Access and manage comments"
 *
 * This EXACTLY matches Vardast's permission screen.
 */
export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
] as const

/**
 * Valid fields requested when subscribing an Instagram account to webhooks.
 * Story mentions arrive through `messages` as a `story_mention` attachment;
 * `story_mention` itself is not a subscribable field in Meta's API.
 */
export const INSTAGRAM_WEBHOOK_FIELDS = [
  'messages',
  'messaging_postbacks',
  'comments',
  'mentions',
] as const

/** A pending OAuth handshake, signed with HMAC so it can't be tampered with. */
export interface OAuthState {
  userId: string
  agentId: string
  workspaceId: string
  nonce: string
  /** Optional: where to send the user after a successful connect. */
  returnTo?: string
}

function stateSecret(): string {
  // For HMAC state signing we can use either secret — they're both app secrets.
  const s =
    process.env.INSTAGRAM_APP_SECRET ??
    process.env.META_APP_SECRET ??
    process.env.ENCRYPTION_KEY
  if (!s)
    throw new Error(
      'INSTAGRAM_APP_SECRET (or META_APP_SECRET or ENCRYPTION_KEY) is not set',
    )
  return s
}

/** Serialize + sign an OAuthState so the callback can trust it. */
export function signState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', stateSecret())
    .update(payload)
    .digest('base64url')
  return `${payload}.${sig}`
}

/** Verify + decode a signed state string. Returns null on any tampering. */
export function verifyState(raw: string): OAuthState | null {
  if (raw.length > 4096) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null
  const expected = crypto
    .createHmac('sha256', stateSecret())
    .update(payload)
    .digest('base64url')
  const suppliedBytes = Buffer.from(sig)
  const expectedBytes = Buffer.from(expected)
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return null
  }
  try {
    const state = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as OAuthState
    if (
      !state ||
      typeof state.userId !== 'string' ||
      typeof state.agentId !== 'string' ||
      typeof state.workspaceId !== 'string' ||
      typeof state.nonce !== 'string' ||
      !state.userId ||
      !state.agentId ||
      !state.workspaceId ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(state.nonce) ||
      (state.returnTo !== undefined && typeof state.returnTo !== 'string')
    ) {
      return null
    }
    return state
  } catch {
    return null
  }
}

/** The public callback URL Instagram redirects to after the user authorizes. */
export function instagramRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/instagram/oauth/callback`
}

/**
 * The Instagram App ID — DIFFERENT from the Facebook App ID.
 * Found in App Dashboard → Instagram → API Setup with Instagram Login.
 * Falls back to META_APP_ID for backward compatibility (but that will cause
 * "Invalid platform app" errors with Instagram Login — use INSTAGRAM_APP_ID).
 */
function instagramAppId(): string {
  const id = process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID
  if (!id)
    throw new Error(
      'INSTAGRAM_APP_ID is not set. ' +
        'Find it in App Dashboard → Instagram → API Setup with Instagram Login. ' +
        '(NOTE: this is DIFFERENT from the Facebook App ID in App Settings → Basic.)',
    )
  return id
}

/** The Instagram App Secret (DIFFERENT from Facebook App Secret). */
function instagramAppSecret(): string {
  const s = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET
  if (!s)
    throw new Error(
      'INSTAGRAM_APP_SECRET is not set. ' +
        'Find it in App Dashboard → Instagram → API Setup with Instagram Login.',
    )
  return s
}

/**
 * Build the Instagram Login authorization URL — the direct Instagram consent
 * screen. This is NOT Facebook; the user sees Instagram's UI.
 */
export function buildInstagramAuthUrl(state: string): string {
  const clientId = instagramAppId()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: instagramRedirectUri(),
    response_type: 'code',
    scope: INSTAGRAM_OAUTH_SCOPES.join(','),
    state,
  })
  return `${OAUTH_DIALOG}?${params.toString()}`
}

/** The verify token configured once on the App's webhook subscription. */
export function metaVerifyToken(): string {
  const t = process.env.META_APP_VERIFY_TOKEN
  if (!t) throw new Error('META_APP_VERIFY_TOKEN is not set')
  return t
}

interface ShortTokenResponse {
  access_token: string
  user_id: number
}

interface LongTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/**
 * Exchange the OAuth `code` for a short-lived Instagram User Access Token.
 * The response also includes the IG user id.
 */
export async function exchangeCodeForUserToken(
  code: string,
): Promise<{ token: string; igUserId: string }> {
  const clientId = instagramAppId()
  const clientSecret = instagramAppSecret()
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: instagramRedirectUri(),
      code,
    }),
  })
  const data = (await res.json()) as ShortTokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Instagram OAuth code exchange failed: ${JSON.stringify(data)}`,
    )
  }
  return {
    token: data.access_token,
    igUserId: String(data.user_id),
  }
}

/**
 * Exchange a short-lived IG token for a long-lived one (~60 days).
 * Long-lived tokens can be refreshed indefinitely (see {@link refreshLongLivedToken}).
 */
export async function exchangeForLongLivedToken(
  shortToken: string,
): Promise<{ token: string; expiresAt: Date }> {
  const clientSecret = instagramAppSecret()
  const url = new URL('https://graph.instagram.com/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('access_token', shortToken)
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as LongTokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Long-lived token exchange failed: ${JSON.stringify(data)}`,
    )
  }
  const ttl = data.expires_in ?? 60 * 24 * 60 * 60
  return {
    token: data.access_token,
    expiresAt: new Date(Date.now() + ttl * 1000),
  }
}

/**
 * Refresh a long-lived IG Token. Returns a fresh ~60-day token. Should be
 * called well before expiry (the worker does this daily for all OAuth channels).
 */
export async function refreshLongLivedToken(
  longToken: string,
): Promise<{ token: string; expiresAt: Date }> {
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', longToken)
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as LongTokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  }
  const ttl = data.expires_in ?? 60 * 24 * 60 * 60
  return {
    token: data.access_token,
    expiresAt: new Date(Date.now() + ttl * 1000),
  }
}

/** Instagram profile snapshot fetched right after OAuth. */
export interface InstagramProfile {
  /** App-scoped account id returned as `id`; used for Graph API calls. */
  igUserId: string
  /** Native Instagram user id returned as `user_id`; used in webhook owner fields. */
  webhookIgId: string
  username: string
  name?: string
  profilePictureUrl?: string
  followersCount?: number
  mediaCount?: number
  accountType?: string
  biography?: string
}

/**
 * Fetch the connected Instagram account's profile using the IG token. This
 * replaces the old `listFacebookPagesWithInstagram` — there's no Page picker
 * because Instagram Login connects directly to the IG account.
 */
export async function getInstagramProfile(
  igToken: string,
): Promise<InstagramProfile> {
  const url = new URL(`${GRAPH_BASE}/me`)
  url.searchParams.set(
    'fields',
    'id,user_id,username,name,profile_picture_url,followers_count,media_count,account_type,biography',
  )
  url.searchParams.set('access_token', igToken)
  const res = await fetch(url)
  const data = (await res.json()) as {
    id?: string
    user_id?: string | number
    username?: string
    name?: string
    profile_picture_url?: string
    followers_count?: number
    media_count?: number
    account_type?: string
    biography?: string
    error?: unknown
  }
  if (
    !res.ok ||
    !data.id ||
    data.user_id === undefined ||
    data.user_id === null ||
    !data.username
  ) {
    throw new Error(`Instagram profile fetch failed: ${JSON.stringify(data)}`)
  }
  return {
    igUserId: data.id,
    webhookIgId: String(data.user_id),
    username: data.username,
    name: data.name,
    profilePictureUrl: data.profile_picture_url,
    followersCount: data.followers_count,
    mediaCount: data.media_count,
    accountType: data.account_type,
    biography: data.biography,
  }
}

/**
 * Subscribe the connected Instagram account to the app's webhook fields.
 *
 * With Instagram API with Instagram Login, the OAuth flow automatically
 * subscribes the IG user to the app's webhook — BUT only if the webhook
 * endpoint (Callback URL + Verify Token) is already configured in the Meta
 * App dashboard. If the webhook isn't configured yet, the auto-subscription
 * silently fails and NO events will be delivered.
 *
 * This function explicitly calls `POST /{ig-user-id}/subscribed_apps` to
 * (re)subscribe the IG user to the `messages`, `messaging_postbacks`,
 * `comments`, and `mentions` fields. Story mentions are delivered through
 * `messages` as attachments with type `story_mention`. It's idempotent and
 * safe to call on every connect.
 *
 * Returns the list of subscribed fields on success, or null on failure (the
 * channel is still saved — the operator can retry subscription from the
 * diagnostics panel).
 */
export async function subscribeIgUserToWebhook(
  igUserId: string,
  igToken: string,
): Promise<string[] | null> {
  try {
    const url = new URL(`${GRAPH_BASE}/${igUserId}/subscribed_apps`)
    url.searchParams.set('access_token', igToken)
    url.searchParams.set(
      'subscribed_fields',
      INSTAGRAM_WEBHOOK_FIELDS.join(','),
    )
    const res = await fetch(url, { method: 'POST' })
    const data = (await res.json()) as {
      success?: boolean
      error?: { message?: string; code?: number }
    }
    if (!res.ok || !data.success) {
      console.error(
        `[instagram] subscribeIgUserToWebhook(${igUserId}) failed:`,
        data,
      )
      return null
    }
    return [...INSTAGRAM_WEBHOOK_FIELDS]
  } catch (e) {
    console.error('[instagram] subscribeIgUserToWebhook error:', e)
    return null
  }
}

/**
 * Remove this app's webhook subscription from an Instagram professional
 * account. Used before a local channel is deleted or replaced so Meta does not
 * keep delivering orphaned events to the global callback.
 */
export async function unsubscribeIgUserFromWebhook(
  igUserId: string,
  igToken: string,
): Promise<boolean> {
  try {
    const url = new URL(`${GRAPH_BASE}/${igUserId}/subscribed_apps`)
    url.searchParams.set('access_token', igToken)
    const res = await fetch(url, { method: 'DELETE' })
    const data = (await res.json()) as {
      success?: boolean
      error?: { message?: string; code?: number }
    }
    if (!res.ok || !data.success) {
      console.error(
        `[instagram] unsubscribeIgUserFromWebhook(${igUserId}) failed:`,
        data,
      )
      return false
    }
    return true
  } catch (e) {
    console.error('[instagram] unsubscribeIgUserFromWebhook error:', e)
    return false
  }
}

/**
 * Verify that the webhook subscription is active for an IG user. Returns the
 * list of subscribed fields, or null if the user is not subscribed (which
 * means webhooks will NOT be delivered for this account).
 */
export async function getIgUserWebhookSubscription(
  igUserId: string,
  igToken: string,
): Promise<string[] | null> {
  try {
    const url = new URL(`${GRAPH_BASE}/${igUserId}/subscribed_apps`)
    url.searchParams.set('access_token', igToken)
    const res = await fetch(url, { method: 'GET' })
    const data = (await res.json()) as {
      data?: Array<{ subscribed_fields?: string[] }>
      error?: { message?: string }
    }
    if (!res.ok) return null
    const subs = data.data?.[0]?.subscribed_fields ?? []
    return subs.length ? subs : null
  } catch {
    return null
  }
}
