import { NextResponse } from 'next/server'
import { isInstagramMediaHost } from '@/lib/instagram/media-proxy'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instagram/media-image?u=<encoded CDN url>
 *
 * Streaming image relay for Instagram CDN thumbnails.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Instagram's media CDN hostnames (scontent*.cdninstagram.com, *.fbcdn.net)
 * are unreachable from Iranian IPs, so a browser without a VPN renders the
 * visual post/story pickers as empty boxes. Instead of pointing <img> at the
 * CDN, the dashboard points it HERE — same origin as the app — and this route
 * fetches the bytes server-side (the server sits outside Iran) and pipes
 * them straight back to the browser.
 *
 * DESIGN CONSTRAINTS (operator request: «بدون فشار و ذخیره‌سازی»)
 * ──────────────────────────────────────────────────────────────
 *   - NO disk storage, NO shared memory cache: the body is streamed through
 *     as it arrives (constant memory, nothing persisted anywhere).
 *   - The BROWSER caches each URL for 1h (Cache-Control: public, max-age=3600,
 *     stale-while-revalidate) — toggling a VPN on/off never re-downloads an
 *     image the tab already showed, and re-opening the picker is instant.
 *   - Strict allow-list: only Instagram/Meta CDN hostnames are relayed, so
 *     this can never be abused as a generic open proxy.
 *   - Hard bounds: 10s upstream timeout + 20MB size cap (covers full-res
 *     posts/stories with room to spare, stops anything pathological).
 *   - When the upstream URL has expired (Instagram signatures live only a
 *     few days) or errors, we answer 200 with a tiny gradient SVG placeholder
 *     instead of a broken image, so saved-scenario cards never look broken.
 */

const MAX_BYTES = 20 * 1024 * 1024

/** Hostnames we are willing to relay — the ONE shared allow-list from
 * lib/instagram/media-proxy.ts (same list as the avatar proxies). */
const isInstagramCdnHost = isInstagramMediaHost

/** Minimal inline SVG shown when the upstream image is gone/unreachable. */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#f58529"/><stop offset="0.5" stop-color="#dd2a7b"/><stop offset="1" stop-color="#8134af"/>
</linearGradient></defs>
<rect width="200" height="200" fill="url(#g)" opacity="0.18"/>
<g fill="none" stroke="#dd2a7b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
<rect x="45" y="45" width="110" height="110" rx="16"/>
<circle cx="100" cy="92" r="18"/>
<path d="M63 140l30-30 22 22 15-15 17 17"/>
</g>
</svg>`

function placeholderResponse(): NextResponse {
  return new NextResponse(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Expired CDN URLs stay expired — cache the placeholder a while so a
      // grid of dead thumbnails doesn't hammer the upstream on every render.
      'Cache-Control': 'public, max-age=600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/** Zero-buffering pass-through with a hard byte cap on unbounded streams. */
function boundedStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  let received = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      received += value.byteLength
      if (received > MAX_BYTES) {
        try {
          await reader.cancel()
        } catch {
          /* upstream already closed */
        }
        controller.error(new Error('PAYLOAD_TOO_LARGE'))
        return
      }
      controller.enqueue(value)
    },
    cancel() {
      void reader.cancel().catch(() => undefined)
    },
  })
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('u')
  if (!raw) return NextResponse.json({ error: 'MISSING_URL' }, { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
  }
  if (target.protocol !== 'https:' || !isInstagramCdnHost(target.hostname)) {
    return NextResponse.json({ error: 'HOST_NOT_ALLOWED' }, { status: 400 })
  }

  // A browser-ish UA keeps some CDN edges from rejecting datacenter requests.
  const upstream = await fetch(target.toString(), {
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!upstream?.ok || !upstream.body) return placeholderResponse()

  const contentType = upstream.headers.get('content-type') ?? ''
  const length = Number(upstream.headers.get('content-length') ?? '0')
  if (!contentType.startsWith('image/')) return placeholderResponse()
  if (length > MAX_BYTES) return placeholderResponse()

  return new NextResponse(boundedStream(upstream.body), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // 1h browser/CDN cache + 24h stale-while-revalidate: the same image
      // never hits the upstream twice inside a session, so VPN toggling is
      // completely invisible to the operator.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
