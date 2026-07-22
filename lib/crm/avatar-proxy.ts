const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 7_000

const TRUSTED_HOST_SUFFIXES = [
  'cdninstagram.com',
  'fbcdn.net',
  'fbsbx.com',
  'akamaihd.net',
] as const

const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface ProxiedAvatar {
  bytes: Uint8Array
  contentType: string
}

/**
 * Instagram profile pictures are short-lived signed CDN URLs. They must never
 * become a general-purpose server-side fetch primitive, so every initial URL
 * and redirect is restricted to Meta-controlled HTTPS hosts.
 */
export function isTrustedInstagramAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    if (url.port && url.port !== '443') return false

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    return TRUSTED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
  } catch {
    return false
  }
}

async function readLimitedBody(response: Response): Promise<Uint8Array | null> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AVATAR_BYTES) {
    return null
  }

  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_AVATAR_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }

  if (total === 0) return null
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function fetchTrustedInstagramAvatar(
  sourceUrl: string,
): Promise<ProxiedAvatar | null> {
  if (!isTrustedInstagramAvatarUrl(sourceUrl)) return null

  let currentUrl = new URL(sourceUrl)
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response: Response
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
          'User-Agent': 'Vigento-Avatar-Proxy/1.0',
        },
      })
    } catch {
      return null
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirectCount === MAX_REDIRECTS) return null
      const nextUrl = new URL(location, currentUrl)
      if (!isTrustedInstagramAvatarUrl(nextUrl.toString())) return null
      currentUrl = nextUrl
      continue
    }

    if (!response.ok) return null
    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) return null

    const bytes = await readLimitedBody(response)
    return bytes ? { bytes, contentType } : null
  }

  return null
}
