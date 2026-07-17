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
  /** Encrypted long-lived Instagram User Access Token (60-day, refreshed by the worker). */
  userTokenEnc?: string
  /** ISO time when the long-lived user token expires (≈ now + 60 days). */
  userTokenExpiresAt?: string
  /**
   * Instagram user id — the identity of the connected account. Used as the
   * webhook demux key (the global webhook's `entry[].id` is this id).
   */
  igUserId?: string
  /** IG @username (display). */
  botUsername?: string
  /** IG profile picture URL. */
  igProfilePictureUrl?: string
  /** IG followers count (snapshot at connect time). */
  igFollowersCount?: number
  /** IG biography. */
  igBiography?: string
  /** ── Legacy Facebook Login fields (kept for backward compat with old channels) ── */
  /** Facebook Page id (legacy FB Login only). */
  pageId?: string
  /** Encrypted Page Access Token (legacy FB Login only). */
  pageTokenEnc?: string
  /** Instagram Business Account id (legacy FB Login only). */
  igBusinessAccountId?: string
  /** For LEGACY mode: the encrypted bot token (old single-token field). */
  botTokenEnc?: string
  /** Optional per-channel behavior settings (quick replies). */
  settings?: { quickReplies: string[] }
}

/** Build a fresh OAuth config from the Instagram Login callback. */
export function buildInstagramOAuthConfig(input: {
  userToken: string
  userTokenExpiresAt: Date
  igUserId: string
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
    igUserId: input.igUserId,
    botUsername: input.username,
    igProfilePictureUrl: input.profilePictureUrl,
    igFollowersCount: input.followersCount,
    igBiography: input.biography,
  }
}

/**
 * Decrypt the access token from a stored config. For Instagram Login OAuth
 * channels, this is the IG User Access Token (works on graph.instagram.com).
 * For legacy FB Login channels, this is the Page Access Token (graph.facebook.com).
 * For legacy manual-token channels, this is the old botTokenEnc.
 */
export function readPageToken(config: Prisma.JsonValue): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  // Instagram Login OAuth: the user token IS the access token.
  if (c?.mode === 'OAUTH' && c.userTokenEnc) {
    try {
      return decrypt(c.userTokenEnc)
    } catch {
      return null
    }
  }
  // Legacy FB Login OAuth: Page token.
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

/** Read the IG user id — the routing key for the global webhook (Instagram Login). */
export function readIgUserId(
  config: Prisma.JsonValue,
): string | null {
  const c = config as Partial<InstagramOAuthConfig> | null
  // Instagram Login stores igUserId; legacy FB Login stores igBusinessAccountId.
  return c?.igUserId ?? c?.igBusinessAccountId ?? null
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

/**
 * Channel-level reply policy for the Instagram automation engine.
 *
 *   ALL_AGENT              — the AI agent replies to every inbound message
 *                            (scenarios still run first; AI is the fallback)
 *   AGENT_EXCEPT_SCENARIOS — the AI agent replies UNLESS a scenario matched
 *                            (default; backwards-compatible with v1)
 *   AUTOMATION_ONLY        — the AI agent is OFF; only scenarios reply. When
 *                            no scenario matches, the inbound is recorded
 *                            silently with no outbound reply.
 *
 * The canonical source is the `InstagramAutomationSettings` table. This reader
 * is a FALLBACK that reads a stale snapshot embedded in `AgentChannel.config`
 * (kept so that channels connected before the settings table existed still
 * have a policy without a backfill migration).
 */
export type InstagramReplyPolicy =
  | 'ALL_AGENT'
  | 'AGENT_EXCEPT_SCENARIOS'
  | 'AUTOMATION_ONLY'

export interface AutomationPolicySnapshot {
  replyPolicy: InstagramReplyPolicy
  dmReplyPolicy: InstagramReplyPolicy
  storyReplyPolicy: InstagramReplyPolicy
  commentReplyPolicy: InstagramReplyPolicy
  stopWords: string[]
  aiEnabled: boolean
}

/** Read an inline automation policy snapshot from the channel config (fallback). */
export function readAutomationPolicy(
  config: Prisma.JsonValue,
): AutomationPolicySnapshot | null {
  const c =
    config && typeof config === 'object'
      ? (config as Record<string, unknown>)
      : {}
  const a =
    c.automationSettings && typeof c.automationSettings === 'object'
      ? (c.automationSettings as Record<string, unknown>)
      : null
  if (!a) return null
  const policy =
    a.replyPolicy === 'ALL_AGENT' ||
    a.replyPolicy === 'AGENT_EXCEPT_SCENARIOS' ||
    a.replyPolicy === 'AUTOMATION_ONLY'
      ? (a.replyPolicy as InstagramReplyPolicy)
      : 'AGENT_EXCEPT_SCENARIOS'
  const stopWords = Array.isArray(a.stopWords)
    ? a.stopWords.filter((w): w is string => typeof w === 'string' && !!w.trim())
    : []
  return {
    replyPolicy: policy,
    dmReplyPolicy: policy,
    storyReplyPolicy: policy,
    commentReplyPolicy: policy,
    stopWords,
    aiEnabled: a.aiEnabled !== false,
  }
}
