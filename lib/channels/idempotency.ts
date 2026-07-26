import { getRedis } from '@/lib/redis'

/**
 * Inbound event idempotency.
 *
 * Messaging platforms redeliver webhooks (Meta retries on timeout/5xx and
 * occasionally duplicates at-least-once; Telegram redelivers when the 200 is
 * lost), and BullMQ re-runs stalled jobs. Without a claim on the platform
 * message id, every redelivery produces a duplicate stored USER message and a
 * duplicate AI reply (double credit burn, spammy UX).
 *
 * Claim-then-process with release-on-error: the claim is taken BEFORE any
 * work; if processing throws, the claim is released so a queue retry can
 * still handle the message. A hard crash mid-processing leaves the claim in
 * place (that message's retry is skipped) — losing one message to a crash is
 * preferred over double-replying on every platform redelivery.
 */

const CLAIM_TTL_SECONDS = 24 * 3600

function claimRedisKey(channelId: string, eventKey: string): string {
  return `inbound_seen:${channelId}:${eventKey}`
}

/** Returns true when this event has not been seen before (claim acquired). */
export async function claimInboundEvent(
  channelId: string,
  eventKey: string,
): Promise<boolean> {
  try {
    const redis = getRedis()
    const res = await redis.set(
      claimRedisKey(channelId, eventKey),
      '1',
      'EX',
      CLAIM_TTL_SECONDS,
      'NX',
    )
    return res === 'OK'
  } catch {
    // Redis unavailable → prefer availability (process the message) over
    // dedup. A rare duplicate beats silently dropping customer messages.
    return true
  }
}

/** Release a claim after a processing failure so a retry can run. */
export async function releaseInboundEvent(
  channelId: string,
  eventKey: string,
): Promise<void> {
  try {
    await getRedis().del(claimRedisKey(channelId, eventKey))
  } catch {
    // Best-effort: the claim expires via TTL anyway.
  }
}
