import { getRedis } from '@/lib/redis'

/**
 * Per-conversation turn serialization.
 *
 * The inbound worker runs at concurrency 8 and platforms deliver rapid-fire
 * messages as independent webhooks, so two turns for the SAME customer could
 * run concurrently: both load history without the other's message, two LLM
 * generations race, and the customer gets two replies — sometimes in the wrong
 * order (the answer before the greeting), each missing the other's context.
 *
 * A short Redis lock around persist+generate turns those into sequential
 * turns. Waiters poll briefly rather than failing, because dropping the second
 * message would be worse than answering it a second later.
 *
 * If Redis is unavailable the lock is skipped (availability over ordering) —
 * the same tradeoff the idempotency claim makes.
 */

const LOCK_TTL_SECONDS = 90
const WAIT_TIMEOUT_MS = 25_000
const POLL_INTERVAL_MS = 250

function lockKey(scope: string): string {
  return `conv_turn_lock:${scope}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Run `operation` while holding the conversation's turn lock.
 *
 * @param scope Stable per-conversation key, e.g. `${channelId}:${chatId}`.
 */
export async function withConversationTurnLock<T>(
  scope: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = lockKey(scope)
  let redis: ReturnType<typeof getRedis> | null = null
  let held = false

  try {
    redis = getRedis()
    const deadline = Date.now() + WAIT_TIMEOUT_MS
    for (;;) {
      const acquired = await redis.set(key, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
      if (acquired === 'OK') {
        held = true
        break
      }
      if (Date.now() >= deadline) {
        // The holder is wedged (or a previous crash left the key). Proceed
        // unserialized rather than dropping the customer's message; the TTL
        // will clear the stale key.
        console.warn(`[conversation-lock] timed out waiting for ${scope}; proceeding`)
        break
      }
      await sleep(POLL_INTERVAL_MS)
    }
  } catch {
    // Redis down — skip serialization.
  }

  try {
    return await operation()
  } finally {
    if (held && redis) {
      await redis.del(key).catch(() => {})
    }
  }
}
