const CHUNK_LOAD_RE = /(?:chunkloaderror|loading chunk [\d-]+ failed|failed to load chunk|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module)/i
const RECOVERY_KEY = 'vigent:chunk-load-recovery-at'
const RECOVERY_COOLDOWN_MS = 60_000

let inMemoryRecoveryAt = 0

export type ChunkLoadRecoveryResult =
  | 'not-chunk-error'
  | 'reload-started'
  | 'reload-already-attempted'

function errorText(value: unknown): string {
  if (value instanceof Error) return `${value.name} ${value.message}`
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const candidate = value as { name?: unknown; message?: unknown }
    return `${String(candidate.name ?? '')} ${String(candidate.message ?? '')}`
  }
  return ''
}

export function isChunkLoadError(value: unknown): boolean {
  return CHUNK_LOAD_RE.test(errorText(value))
}

export function withChunkRetryParam(href: string, now: number): string {
  const url = new URL(href)
  url.searchParams.set('_vigent_chunk_retry', String(now))
  return url.toString()
}

/**
 * Recover from a stale Next.js runtime after deployment. A cache-busted hard
 * navigation fetches fresh HTML and manifests; the cooldown prevents a broken
 * release from trapping the browser in a reload loop.
 */
export function recoverFromChunkLoadError(value: unknown): ChunkLoadRecoveryResult {
  if (!isChunkLoadError(value) || typeof window === 'undefined') return 'not-chunk-error'

  const now = Date.now()
  let previous = inMemoryRecoveryAt
  try {
    previous = Math.max(previous, Number(window.sessionStorage.getItem(RECOVERY_KEY)) || 0)
  } catch {
    // Privacy modes may block sessionStorage; the module-level guard still works.
  }

  if (now - previous < RECOVERY_COOLDOWN_MS) return 'reload-already-attempted'

  inMemoryRecoveryAt = now
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, String(now))
  } catch {
    // Reloading is still safe with the in-memory cooldown.
  }
  window.location.replace(withChunkRetryParam(window.location.href, now))
  return 'reload-started'
}
