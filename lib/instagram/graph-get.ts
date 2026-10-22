const FB_BASE = 'https://graph.facebook.com/v21.0'
const IG_BASE = 'https://graph.instagram.com/v21.0'

/**
 * One Graph GET with a stored channel token. Instagram Login tokens
 * («IGAA…») live on graph.instagram.com, Page tokens on graph.facebook.com;
 * try the likely host first and fall back to the other — the same order as
 * resolveInstagramHost, without its extra /me probe. Null on any failure.
 */
export async function igGraphGet<T>(token: string, path: string, timeoutMs = 8_000): Promise<T | null> {
  const bases = /^(IGAA|IGQ)/i.test(token) ? [IG_BASE, FB_BASE] : [FB_BASE, IG_BASE]
  for (const base of bases) {
    const response = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null)
    if (response?.ok) return (await response.json().catch(() => null)) as T | null
  }
  return null
}
