import type { OutboundTextStream, SendOptions } from '@/lib/channels/types'

interface StreamState {
  failed: boolean
  publishedText: string
}

/**
 * Coalesce token-speed model updates into provider-safe snapshots. The first
 * snapshot is sent immediately; later snapshots are rate-limited so Telegram-
 * compatible APIs are not called once per token.
 */
export function createThrottledTextStream(params: {
  intervalMs: number
  prepare: (text: string) => string
  publish: (text: string) => Promise<void>
  finalize: (text: string, opts: SendOptions | undefined, state: StreamState) => Promise<void>
  cancel?: () => Promise<void>
  onPreviewError?: (error: unknown) => void
}): OutboundTextStream {
  let latestText = ''
  let publishedText = ''
  let lastPublishedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | undefined
  let closed = false
  let failed = false

  const schedule = () => {
    if (closed || failed || inFlight || latestText === publishedText || !latestText) return
    const delay = Math.max(0, params.intervalMs - (Date.now() - lastPublishedAt))
    if (timer) return
    if (delay === 0) {
      void flush()
      return
    }
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, delay)
  }

  const flush = async () => {
    if (closed || failed || inFlight || latestText === publishedText || !latestText) return
    const snapshot = latestText
    inFlight = params.publish(snapshot)
      .then(() => {
        publishedText = snapshot
        lastPublishedAt = Date.now()
      })
      .catch((error) => {
        // Preview delivery is a nicety. The durable final send in finish() is
        // still attempted even when a draft/edit endpoint is unavailable.
        failed = true
        params.onPreviewError?.(error)
      })
      .finally(() => {
        inFlight = undefined
        schedule()
      })
    await inFlight
  }

  return {
    update(text: string) {
      if (closed || failed) return
      const prepared = params.prepare(text)
      if (!prepared || prepared === latestText) return
      latestText = prepared
      schedule()
    },

    async finish(text: string, opts?: SendOptions) {
      closed = true
      if (timer) clearTimeout(timer)
      timer = undefined
      await inFlight
      await params.finalize(text, opts, { failed, publishedText })
    },

    async cancel() {
      closed = true
      if (timer) clearTimeout(timer)
      timer = undefined
      await inFlight
      await params.cancel?.().catch(() => {})
    },
  }
}
