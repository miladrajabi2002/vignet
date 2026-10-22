import { NextResponse } from 'next/server'

/** Minimal inline SVG shown when an Instagram image is gone/unreachable. */
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

/**
 * 200 + gradient placeholder instead of a broken image, shared by the CDN
 * relay and the per-media thumbnail route so dead thumbnails look the same.
 */
export function placeholderResponse(): NextResponse {
  return new NextResponse(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Expired CDN URLs stay expired — cache the placeholder a while so a
      // grid of dead thumbnails doesn't hammer the upstream on every render.
      'Cache-Control': 'private, max-age=600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
