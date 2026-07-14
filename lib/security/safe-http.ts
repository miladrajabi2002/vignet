import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_REDIRECTS = 3

export class UnsafeHttpTargetError extends Error {
  constructor(message = 'UNSAFE_HTTP_TARGET') {
    super(message)
    this.name = 'UnsafeHttpTargetError'
  }
}

export interface SafeHttpResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
  url: string
}

export interface SafeHttpOptions {
  headers?: Record<string, string>
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  allowedContentTypes?: string[]
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isBlockedIp(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (net.isIPv4(normalized)) return isBlockedIpv4(normalized)
  if (!net.isIPv6(normalized)) return true
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  if (normalized.startsWith('ff')) return true
  if (normalized.startsWith('::ffff:')) {
    const tail = normalized.slice('::ffff:'.length)
    if (net.isIPv4(tail)) return isBlockedIpv4(tail)
    const groups = tail.split(':')
    if (groups.length === 2) {
      const high = Number.parseInt(groups[0], 16)
      const low = Number.parseInt(groups[1], 16)
      if (Number.isFinite(high) && Number.isFinite(low)) {
        return isBlockedIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
      }
    }
    return true
  }
  return false
}

function parseHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeHttpTargetError('INVALID_URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeHttpTargetError('INVALID_PROTOCOL')
  }
  if (url.username || url.password) throw new UnsafeHttpTargetError('URL_CREDENTIALS_FORBIDDEN')
  if (!url.hostname) throw new UnsafeHttpTargetError('INVALID_HOST')
  return url
}

function hostnameWithoutBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  if (!records.length || records.some((record) => isBlockedIp(record.address))) {
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_HTTP_TARGETS === '1' && records[0]) {
      return { address: records[0].address, family: records[0].family as 4 | 6 }
    }
    throw new UnsafeHttpTargetError()
  }
  const record = records[0]
  return { address: record.address, family: record.family as 4 | 6 }
}

/** Validate a tenant-controlled URL without issuing a request. */
export async function assertSafeHttpUrl(raw: string): Promise<URL> {
  const url = parseHttpUrl(raw)
  await resolvePublicAddress(hostnameWithoutBrackets(url.hostname))
  return url
}

/**
 * GET a tenant-controlled URL while pinning the already-validated DNS result.
 * Redirect destinations are independently resolved and validated, preventing
 * redirects and DNS rebinding from reaching loopback/private/link-local hosts.
 */
export async function safeHttpGet(raw: string, options: SafeHttpOptions = {}): Promise<SafeHttpResponse> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  return request(raw, options, 0, maxRedirects)
}

async function request(
  raw: string,
  options: SafeHttpOptions,
  redirectCount: number,
  maxRedirects: number,
): Promise<SafeHttpResponse> {
  const url = parseHttpUrl(raw)
  const originalHostname = hostnameWithoutBrackets(url.hostname)
  const target = await resolvePublicAddress(originalHostname)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const transport = url.protocol === 'https:' ? https : http

  const response = await new Promise<SafeHttpResponse>((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: target.address,
        family: target.family,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        servername: net.isIP(originalHostname) ? undefined : originalHostname,
        headers: {
          Host: url.host,
          Accept: '*/*',
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            req.destroy(new Error('HTTP_RESPONSE_TOO_LARGE'))
            return
          }
          chunks.push(Buffer.from(chunk))
        })
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
            url: url.toString(),
          })
        })
      },
    )
    req.setTimeout(timeoutMs, () => req.destroy(new Error('HTTP_REQUEST_TIMEOUT')))
    req.on('error', reject)
    req.end()
  })

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.location
    if (!location || redirectCount >= maxRedirects) throw new Error('HTTP_REDIRECT_LIMIT')
    return request(new URL(location, url).toString(), options, redirectCount + 1, maxRedirects)
  }

  const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
  if (
    options.allowedContentTypes?.length &&
    !options.allowedContentTypes.some((allowed) => contentType.startsWith(allowed.toLowerCase()))
  ) {
    throw new Error('HTTP_CONTENT_TYPE_NOT_ALLOWED')
  }
  return response
}
