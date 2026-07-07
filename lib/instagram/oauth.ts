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
 *   META_APP_ID              — the App ID
 *   META_APP_SECRET          — the App Secret
 *   META_APP_VERIFY_TOKEN    — arbitrary string for webhook verification
 *   NEXT_PUBLIC_APP_URL      — public base URL (e.g. https://vigent.ir)
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

/** A pending OAuth handshake, signed with HMAC so it can't be tampered with. */
export interface OAuthState {
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
    ) as OAuthState
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
 * Build the Instagram Login authorization URL — the direct Instagram consent
 * screen. This is NOT Facebook; the user sees Instagram's UI.
 */
export function buildInstagramAuthUrl(state: string): string {
  const clientId = process.env.META_APP_ID
  if (!clientId) throw new Error('META_APP_ID is not set')
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
  const clientId = process.env.META_APP_ID
  const clientSecret = process.env.META_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('META_APP_ID / META_APP_SECRET not set')
  }
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
  const clientSecret = process.env.META_APP_SECRET
  if (!clientSecret) throw new Error('META_APP_SECRET is not set')
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
  igUserId: string
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
    'id,username,name,profile_picture_url,followers_count,media_count,account_type,biography',
  )
  url.searchParams.set('access_token', igToken)
  const res = await fetch(url)
  const data = (await res.json()) as {
    id?: string
    username?: string
    name?: string
    profile_picture_url?: string
    followers_count?: number
    media_count?: number
    account_type?: string
    biography?: string
    error?: unknown
  }
  if (!res.ok || !data.id || !data.username) {
    throw new Error(`Instagram profile fetch failed: ${JSON.stringify(data)}`)
  }
  return {
    igUserId: data.id,
    username: data.username,
    name: data.name,
    profilePictureUrl: data.profile_picture_url,
    followersCount: data.followers_count,
    mediaCount: data.media_count,
    accountType: data.account_type,
    biography: data.biography,
  }
}
