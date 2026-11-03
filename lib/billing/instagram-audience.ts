/**
 * Plans by Instagram audience: a big page brings a big stream of comments and
 * DMs, so each paid plan serves pages up to a follower count — استارتر تا
 * ۲۰ هزار، حرفه‌ای تا ۱۰۰ هزار و سازمانی تا ۱ میلیون. A page above that costs
 * more to serve than any listed price, so it has no self-serve plan: the
 * owner arranges the subscription with support. Owners connect their page
 * first and buy a plan after, so the gate sits at checkout (billing page +
 * checkout API).
 */
import { prisma } from '@/lib/prisma'
import { readIgUserId, readPageToken } from '@/lib/instagram/config'
import { igGraphGet } from '@/lib/instagram/graph-get'
import { PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'

/** Largest page (followers, inclusive) each plan may serve. */
export const PLAN_MAX_IG_FOLLOWERS: Record<PaidPlan, number> = {
  STARTER: 20_000,
  PRO: 100_000,
  BUSINESS: 1_000_000,
}

/** Above this no self-serve plan fits; the subscription goes through support. */
export const SUPPORT_QUOTE_IG_FOLLOWERS = PLAN_MAX_IG_FOLLOWERS.BUSINESS

/** Followers move; the connect-time snapshot is re-read at most once a day. */
const FRESH_MS = 24 * 60 * 60 * 1000

export interface InstagramAudience {
  followers: number
  username: string | null
}

interface StoredCounts {
  igFollowersCount?: number
  igFollowersCheckedAt?: string
  botUsername?: string
}

async function refreshFollowers(channelId: string, config: Parameters<typeof readPageToken>[0]): Promise<number | null> {
  const token = readPageToken(config)
  const igUserId = readIgUserId(config)
  if (!token || !igUserId) return null
  const profile = await igGraphGet<{ followers_count?: number }>(token, `${igUserId}?fields=followers_count`, 5_000)
  if (typeof profile?.followers_count !== 'number') return null
  // Merge into the JSON in place so a token refresh writing the same row is never undone.
  await prisma.$executeRaw`
    UPDATE "AgentChannel"
    SET config = config || jsonb_build_object('igFollowersCount', ${profile.followers_count}::int, 'igFollowersCheckedAt', ${new Date().toISOString()}::text)
    WHERE id = ${channelId}`.catch(() => undefined)
  return profile.followers_count
}

/**
 * The workspace's biggest connected Instagram page, or null with none.
 * A stale or missing count is looked up live; when Meta does not answer,
 * the last known count stands.
 */
export async function getInstagramAudience(workspaceId: string): Promise<InstagramAudience | null> {
  const channels = await prisma.agentChannel.findMany({
    where: { type: 'INSTAGRAM', agent: { workspaceId } },
    select: { id: true, config: true },
  })
  if (!channels.length) return null
  const now = Date.now()
  const counts = await Promise.all(
    channels.map(async (channel) => {
      const stored = (channel.config ?? {}) as StoredCounts
      const checkedAt = stored.igFollowersCheckedAt ? new Date(stored.igFollowersCheckedAt).getTime() : 0
      const fresh = typeof stored.igFollowersCount === 'number' && now - checkedAt < FRESH_MS
      const followers = fresh ? stored.igFollowersCount! : ((await refreshFollowers(channel.id, channel.config)) ?? stored.igFollowersCount ?? null)
      return { followers, username: stored.botUsername ?? null }
    }),
  )
  const known = counts.filter((row): row is { followers: number; username: string | null } => row.followers != null)
  if (!known.length) return null
  return known.reduce((max, row) => (row.followers > max.followers ? row : max))
}

export function planFitsAudience(plan: PaidPlan, audience: InstagramAudience | null): boolean {
  return !audience || audience.followers <= PLAN_MAX_IG_FOLLOWERS[plan]
}

/** A page too big for every listed plan: its price is set with support. */
export function needsSupportQuote(audience: InstagramAudience | null): boolean {
  return !!audience && audience.followers > SUPPORT_QUOTE_IG_FOLLOWERS
}

/** The smallest plan that serves this page; null when only support can quote it. */
export function smallestPlanForAudience(audience: InstagramAudience | null): PaidPlan | null {
  return PAID_PLANS.find((plan) => planFitsAudience(plan, audience)) ?? null
}

/** «۲۰ هزار» / «20K» */
export function formatFollowers(value: number, locale: 'fa' | 'en'): string {
  if (locale === 'en') {
    if (value >= 1_000_000) return `${(Math.round(value / 100_000) / 10).toString()}M`
    return value >= 1_000 ? `${(Math.round(value / 100) / 10).toString()}K` : String(value)
  }
  const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })
  if (value >= 1_000_000) return `${nf.format(value / 1_000_000)} میلیون`
  if (value >= 1_000) return `${nf.format(value / 1_000)} هزار`
  return nf.format(value)
}

/** Why a plan cannot be bought for this page, in the owner's language. */
export function audienceBlockMessage(plan: PaidPlan, audience: InstagramAudience, locale: 'fa' | 'en'): string {
  const cap = PLAN_MAX_IG_FOLLOWERS[plan]
  const page = audience.username ? `@${audience.username}` : locale === 'fa' ? 'پیج شما' : 'Your page'
  if (needsSupportQuote(audience)) {
    return locale === 'fa'
      ? `${page} ${formatFollowers(audience.followers, 'fa')} فالوور دارد. هزینهٔ پاسخ‌گویی به پیج‌های بالای ${formatFollowers(SUPPORT_QUOTE_IG_FOLLOWERS, 'fa')} فالوور بیشتر است؛ برای اشتراک با پشتیبانی هماهنگ کنید.`
      : `${page} has ${formatFollowers(audience.followers, 'en')} followers. Pages above ${formatFollowers(SUPPORT_QUOTE_IG_FOLLOWERS, 'en')} cost more to serve; contact support to set up the subscription.`
  }
  return locale === 'fa'
    ? `${page} ${formatFollowers(audience.followers, 'fa')} فالوور دارد؛ این پلن برای پیج‌های تا ${formatFollowers(cap, 'fa')} فالوور است.`
    : `${page} has ${formatFollowers(audience.followers, 'en')} followers; this plan serves pages up to ${formatFollowers(cap, 'en')}.`
}

/**
 * Connecting a page: a workspace that already holds a live Starter/Pro plan
 * cannot add a page bigger than that plan serves (otherwise «buy small, then
 * connect big» walks around the checkout gate). Trials and lapsed plans
 * connect freely — they still have to pass checkout. Business connects any
 * page: the accounts above its cap are the ones support has set up. Null when
 * allowed.
 */
export async function connectAudienceBlock(workspaceId: string, followers: number | undefined): Promise<{ plan: PaidPlan; cap: number } | null> {
  if (typeof followers !== 'number') return null
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
  if (!workspace || workspace.plan === 'TRIAL') return null
  const plan = workspace.plan as PaidPlan
  if (plan === 'BUSINESS') return null
  const sub = await prisma.subscription.findUnique({ where: { workspaceId }, select: { status: true, currentPeriodEnd: true } })
  if (!sub || sub.status !== 'ACTIVE' || sub.currentPeriodEnd < new Date()) return null
  const cap = PLAN_MAX_IG_FOLLOWERS[plan]
  return followers > cap ? { plan, cap } : null
}
