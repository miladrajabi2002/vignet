import crypto from 'crypto'

/**
 * Instagram OAuth (Facebook Login) flow — the "one click connect" model.
 *
 * vigent owns a single Meta App. An operator clicks "Connect Instagram" and is
 * sent to Facebook's OAuth dialog. After they authorize, Meta redirects back
 * with a `code` which we exchange for a long-lived User Access Token, then use
 * that to fetch their Facebook Pages + the Instagram Business Account linked to
 * each Page. The chosen Page's Page Access Token is what we actually use to
 * send/receive DMs and reply to comments.
 *
 * Required env vars (set once by the platform operator — see the Meta App
 * setup guide):
 *   META_APP_ID              — the App ID of vigent's Meta App
 *   META_APP_SECRET          — the App Secret
 *   META_APP_VERIFY_TOKEN    — arbitrary string set on the App webhook config
 *   NEXT_PUBLIC_APP_URL      — public base URL (e.g. https://vigent.ir)
 *
 * The OAuth redirect URI is `${APP_URL}/api/instagram/oauth/callback` and must
 * be added to "Valid OAuth Redirect URIs" in the App dashboard (Basic settings).
 */

const GRAPH_VERSION = 'v21.0'
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`

/**
 * Scopes requested at connect time. These map exactly to the permission lines
 * the user sees on the consent screen ("vardast-IG is requesting access to…"):
 *
 *   instagram_basic            → "View profile and access media (required)"
 *   instagram_manage_comments  → "Access and manage comments"
 *   instagram_manage_messages  → "Access and manage messages"
 *   pages_show_list            → list the user's Pages (to find the IG account)
 *   pages_read_engagement      → read comments/mentions
 *   pages_messaging            → send/receive DMs via the Page
 *   pages_manage_metadata      → mark messages as read (typing/read state)
 */
export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_messaging',
  'pages_manage_metadata',
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

/** The public callback URL Meta redirects to after the user authorizes. */
export function instagramRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/instagram/oauth/callback`
}

/** Build the Facebook OAuth dialog URL the user is sent to. */
export function buildInstagramAuthUrl(state: string): string {
  const clientId = process.env.META_APP_ID
  if (!clientId) throw new Error('META_APP_ID is not set')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: instagramRedirectUri(),
    response_type: 'code',
    scope: INSTAGRAM_OAUTH_SCOPES.join(','),
    state,
    // Force a re-authorization prompt when reconnecting a different account.
    auth_type: 'rerequest',
  })
  return `${OAUTH_DIALOG}?${params.toString()}`
}

/** The verify token configured once on the App's webhook subscription. */
export function metaVerifyToken(): string {
  const t = process.env.META_APP_VERIFY_TOKEN
  if (!t) throw new Error('META_APP_VERIFY_TOKEN is not set')
  return t
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
  url.searchParams.set('redirect_uri', instagramRedirectUri())
  url.searchParams.set('code', code)
  const res = await fetch(url, { method: 'GET' })
  const data = (await res.json()) as TokenResponse & { error?: unknown }
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Instagram OAuth code exchange failed: ${JSON.stringify(data)}`,
    )
  }
  return { token: data.access_token, expiresIn: data.expires_in ?? 3600 }
}

/**
 * Exchange a short-lived User Token for a long-lived one (~60 days).
 * Long-lived tokens can be refreshed indefinitely (see `refreshLongLivedToken`).
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

/** A Facebook Page owned by the user, with its linked IG account (if any). */
export interface InstagramPage {
  pageId: string
  pageName: string
  pageAccessToken: string
  pageCategory?: string
  instagram: {
    igBusinessAccountId: string
    username: string
    name?: string
    profilePictureUrl?: string
    followersCount?: number
    biography?: string
  } | null
  instagramError?: string
}

/**
 * List the user's Facebook Pages + the Instagram Business Account linked to
 * each. Only Pages with a linked IG account can be used for messaging.
 */
export async function listFacebookPagesWithInstagram(
  longUserToken: string,
): Promise<InstagramPage[]> {
  // 1) Get the user's Pages.
  const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`)
  pagesUrl.searchParams.set('access_token', longUserToken)
  pagesUrl.searchParams.set(
    'fields',
    'id,name,access_token,category',
  )
  pagesUrl.searchParams.set('limit', '100')
  const pagesRes = await fetch(pagesUrl)
  const pagesJson = (await pagesRes.json()) as {
    data?: Array<{
      id: string
      name: string
      access_token: string
      category?: string
    }>
    error?: unknown
  }
  if (!pagesRes.ok) {
    throw new Error(
      `Failed to list Facebook Pages: ${JSON.stringify(pagesJson)}`,
    )
  }
  const pages = pagesJson.data ?? []

  // 2) For each page, resolve its linked Instagram Business Account + profile.
  const out: InstagramPage[] = []
  for (const p of pages) {
    const page: InstagramPage = {
      pageId: p.id,
      pageName: p.name,
      pageAccessToken: p.access_token,
      pageCategory: p.category,
      instagram: null,
    }
    try {
      const igIdUrl = new URL(`${GRAPH_BASE}/${p.id}`)
      igIdUrl.searchParams.set('fields', 'instagram_business_account')
      igIdUrl.searchParams.set('access_token', p.access_token)
      const igIdRes = await fetch(igIdUrl)
      const igIdJson = (await igIdRes.json()) as {
        instagram_business_account?: { id: string }
        error?: unknown
      }
      const igId = igIdJson.instagram_business_account?.id
      if (!igId) {
        out.push(page)
        continue
      }
      // Fetch the IG profile snapshot.
      const profUrl = new URL(`${GRAPH_BASE}/${igId}`)
      profUrl.searchParams.set(
        'fields',
        'username,name,profile_picture_url,followers_count,biography',
      )
      profUrl.searchParams.set('access_token', p.access_token)
      const profRes = await fetch(profUrl)
      const profJson = (await profRes.json()) as {
        username?: string
        name?: string
        profile_picture_url?: string
        followers_count?: number
        biography?: string
        error?: unknown
      }
      if (!profRes.ok || !profJson.username) {
        page.instagramError = `IG profile fetch failed: ${JSON.stringify(
          profJson,
        )}`
        out.push(page)
        continue
      }
      page.instagram = {
        igBusinessAccountId: igId,
        username: profJson.username,
        name: profJson.name,
        profilePictureUrl: profJson.profile_picture_url,
        followersCount: profJson.followers_count,
        biography: profJson.biography,
      }
    } catch (e) {
      page.instagramError = e instanceof Error ? e.message : String(e)
    }
    out.push(page)
  }
  return out
}

/**
 * Subscribe a Page to the App's webhook subscriptions so Meta starts sending
 * DM/comment/story events for that Page to our global webhook. Called once per
 * connection right after we persist the channel.
 */
export async function subscribePageToApp(
  pageId: string,
  pageToken: string,
): Promise<boolean> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`)
  url.searchParams.set('access_token', pageToken)
  url.searchParams.set(
    'subscribed_fields',
    'messages,messaging_postbacks,feed,story_mention,mentions',
  )
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    console.error(
      `[instagram] subscribePageToApp(${pageId}) failed:`,
      body,
    )
    return false
  }
  return true
}

/**
 * Check whether a user follows the connected account. The Graph API does NOT
 * expose a "is this user a follower" check for arbitrary users — so the
 * follow-gate is implemented as a SOFT trust gate (the user taps "I followed")
 * or, for a hard gate, a STORY_MENTION gate (the user must mention the account
 * in a story, which fires a verifiable webhook). This helper exists for the
 * future and currently returns null (unknown).
 */
export async function checkFollowStatus(): Promise<boolean | null> {
  return null
}
