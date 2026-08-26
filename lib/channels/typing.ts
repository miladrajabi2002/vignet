import type { MessengerAdapter } from '@/lib/channels/types'

const TELEGRAM_LIKE_REFRESH_MS = 4_000

/**
 * Start a best-effort channel typing lifecycle without ever delaying the reply.
 *
 * Telegram and Bale clear chat actions after roughly five seconds, so they need
 * a quiet refresh while a long model call is running. Instagram keeps its
 * sender action active until `typing_off` (or its own expiry), so one start and
 * one stop request is both more natural and less noisy.
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

  const ping = () => {
    if (stopped || inFlight) return
    inFlight = true
    const controller = new AbortController()
    activeController = controller
    void adapter.sendTyping!(chatId, controller.signal)
      .catch((error) => {
        if (!stopped || !(error instanceof Error) || error.name !== 'AbortError') {
          onError(error)
        }
      })
      .finally(() => {
        if (activeController === controller) activeController = null
        inFlight = false
      })
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
    // Prevent a slow typing request from reaching the provider after the real
    // answer has already been sent and leaving a stale indicator behind it.
    activeController?.abort()
    activeController = null
    if (adapter.stopTyping) {
      void adapter.stopTyping(chatId).catch(onError)
    }
  }
}
