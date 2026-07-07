import type { Prisma } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/crypto'
import { newWebhookToken } from '@/lib/channels/config'

/**
 * Instagram OAuth connection config — stored encrypted in `AgentChannel.config`.
 *
 * This is the "platform-managed" model (the same one Vardast/ManyChat use):
 * vigent owns ONE Meta App. Each operator just clicks "Connect" and authorizes
 * the app via Facebook Login. We never ask them to create their own Meta App,
 * paste tokens, or configure a webhook — that's all done once, at the platform
 * level, by the vigent team.
 *
 * After OAuth we store:
 *   - the long-lived User Access Token (60-day, auto-refreshed) — needed to
 *     re-derive Page tokens and to refresh.
 *   - the Page Access Token (effectively permanent when derived from a
 *     long-lived user token) — used to send/receive DMs and reply to comments.
 *   - the Instagram Business Account id + profile snapshot (username, avatar,
 *     followers) for display + routing.
 *
 * The `webhookToken` is kept for backward compatibility with the legacy
 * per-channel webhook path (`/api/webhook/instagram/[token]`), but new OAuth
 * connections are routed by the GLOBAL webhook (`/api/webhook/instagram`)
 * using `pageId` demultiplexing — see `app/api/webhook/instagram/route.ts`.
 */
export interface InstagramOAuthConfig {
  /** Legacy per-channel webhook token (kept for the [token] route). */
  webhookToken: string
  /** Connection model: 'OAUTH' (platform-managed) | 'LEGACY' (user-pasted token). */
  mode: 'OAUTH' | 'LEGACY'
  /** Encrypted long-lived User Access Token (60-day, refreshed by the worker). */
  userTokenEnc?: string
  /** ISO time when the long-lived user token expires (≈ now + 60 days). */
  userTokenExpiresAt?: string
  /** Facebook Page id the IG account is linked to. */
  pageId?: string
  /** Encrypted Page Access Token (used for all Graph API calls). */
  pageTokenEnc?: string
  /** Instagram Business Account id (the `instagram_business_account` of the page). */
  igBusinessAccountId?: string
  /** IG @username (display). */
  botUsername?: string
  /** IG profile picture URL. */
  igProfilePictureUrl?: string
  /** IG followers count (snapshot at connect time). */
  igFollowersCount?: number
  /** IG biography. */
  igBiography?: string
  /** For LEGACY mode: the encrypted bot token (old single-token field). */
  botTokenEnc?: string
  /** Optional per-channel behavior settings (quick replies). */
  settings?: { quickReplies: string[] }
}

/** Build a fresh OAuth config from the OAuth callback's resolved credentials. */
export function buildInstagramOAuthConfig(input: {
  userToken: string
  userTokenExpiresAt: Date
  pageId: string
  pageToken: string
  igBusinessAccountId: string
  username: string
  profilePictureUrl?: string
  followersCount?: number
  biography?: string
}): InstagramOAuthConfig {
  return {
    webhookToken: newWebhookToken(),
    mode: 'OAUTH',
    userTokenEnc: encrypt(input.userToken),
    userTokenExpiresAt: input.userTokenExpiresAt.toISOString(),
    pageId: input.pageId,
    pageTokenEnc: encrypt(input.pageToken),
    igBusinessAccountId: input.igBusinessAccountId,
    botUsername: input.username,
    igProfilePictureUrl: input.profilePictureUrl,
    igFollowersCount: input.followersCount,
    igBiography: input.biography,
  }
}

/** Decrypt the Page Access Token from a stored OAuth config. */
export function readPageToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  if (c?.mode === 'OAUTH' && c.pageTokenEnc) {
    try {
      return decrypt(c.pageTokenEnc)
    } catch {
      return null
    }
  }
  // Legacy single-token fallback.
  if (c?.botTokenEnc) {
    try {
      return decrypt(c.botTokenEnc)
    } catch {
      return null
    }
  }
  return null
}

/** Decrypt the long-lived User Access Token (for refresh + page re-derivation). */
export function readUserToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  if (!c?.userTokenEnc) return null
  try {
    return decrypt(c.userTokenEnc)
  } catch {
    return null
  }
}

/** Read the webhook token (used by the legacy [token] webhook route). */
export function readWebhookToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  return c?.webhookToken ?? null
}

/** Read the IG Business Account id (routing key for the global webhook). */
export function readIgBusinessAccountId(
  config: Prisma.JsonValue,
): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  return c?.igBusinessAccountId ?? null
}

/** Read the Facebook Page id (alternate routing key for the global webhook). */
export function readPageId(config: Prisma.JsonValue): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  return c?.pageId ?? null
}

/** Is this channel connected via the new OAuth flow? */
export function isOAuthChannel(config: Prisma.JsonValue): boolean {
  const c = config as Partial<InstagramOAuthConfig> | null
  return c?.mode === 'OAUTH'
}

/** When does the long-lived user token expire? Null for legacy channels. */
export function userTokenExpiry(config: Prisma.JsonValue): Date | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  if (!c?.userTokenExpiresAt) return null
  const d = new Date(c.userTokenExpiresAt)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Normalize the `settings` blob into a safe quick-replies array. */
export function normalizeInstagramSettings(config: Prisma.JsonValue): {
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
