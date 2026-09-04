import type { MessengerAdapter } from '@/lib/channels/types'

const TELEGRAM_LIKE_REFRESH_MS = 4_000
const PING_RETRY_DELAY_MS = 1_500
const MAX_PING_ATTEMPTS = 3

/**
 * Start a best-effort channel typing lifecycle without ever delaying the reply.
 *
 * Telegram and Bale clear chat actions after roughly five seconds, so they need
 * a quiet refresh while a long model call is running. Instagram keeps its
 * sender action active until `typing_off` (or its own expiry), so one start and
 * one stop request is both more natural and less noisy.
 *
 * graph.instagram.com intermittently answers transient 500s (IGApiException,
 * code 2) — a single-shot `typing_on` used to silently lose the indicator for
 * the whole turn. Failed pings are therefore retried up to MAX_PING_ATTEMPTS
 * with a short backoff, and the error is only surfaced after the last attempt.
 */
export function startChannelTyping(
  adapter: MessengerAdapter,
  chatId: string,
  onError: (error: unknown) => void = () => {},
): () => void {
  if (!adapter.sendTyping) return () => {}

  let stopped = false
  let inFlight = false
  let activeController: AbortController | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0

  const ping = () => {
    if (stopped || inFlight) return
    inFlight = true
    attempts += 1
    const controller = new AbortController()
    activeController = controller
    void adapter.sendTyping!(chatId, controller.signal)
      .then(() => {
        // A successful ping re-arms the budget so the periodic Telegram/Bale
        // refreshes never exhaust the retry counter of a healthy lifecycle.
        attempts = 0
      })
      .catch((error) => {
        if (stopped && error instanceof Error && error.name === 'AbortError') return
        // Retry transient provider failures quietly; only give up loudly
        // once every attempt is exhausted.
        if (!stopped && attempts < MAX_PING_ATTEMPTS) {
          scheduleRetry()
          return
        }
        onError(error)
      })
      .finally(() => {
        if (activeController === controller) activeController = null
        inFlight = false
      })
  }

  const scheduleRetry = () => {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      ping()
    }, PING_RETRY_DELAY_MS)
    retryTimer.unref?.()
  }

  // The first indicator is intentionally fire-and-forget: a slow nicety API
  // must never sit in front of the model request (this previously added up to
  // ten seconds to Telegram response time).
  ping()

  const refreshMs =
    adapter.channel === 'TELEGRAM' || adapter.channel === 'BALE'
      ? TELEGRAM_LIKE_REFRESH_MS
      : null
  const timer = refreshMs ? setInterval(ping, refreshMs) : null
  timer?.unref?.()

  return () => {
    if (stopped) return
    stopped = true
    if (timer) clearInterval(timer)
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    // Prevent a slow typing request from reaching the provider after the real
    // answer has already been sent and leaving a stale indicator behind it.
    activeController?.abort()
    activeController = null
    if (adapter.stopTyping) {
      void adapter.stopTyping(chatId).catch(onError)
    }
  }
}
