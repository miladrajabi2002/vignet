'use client'

export function reportClientError(source: string, error: Error & { digest?: string }): void {
  const payload = {
    source,
    message: error.message.slice(0, 4_000),
    stack: error.stack?.slice(0, 8_000),
    digest: error.digest,
    path: typeof window === 'undefined' ? undefined : window.location.pathname,
  }
  void fetch('/api/telemetry/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined)
}
