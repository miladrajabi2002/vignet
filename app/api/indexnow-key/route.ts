import { NextResponse } from 'next/server'

// IndexNow key file — required by IndexNow API to verify domain ownership.
// The same key value must also be present at the URL passed as `keyLocation`
// in the IndexNow submission. We serve it dynamically to avoid rebuilds when
// the key changes (e.g. rotating keys for security).
//
// The actual key value is loaded from an env var so the public source code
// does not contain it. Falls back to a static value if env var is missing.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'd1b86b39399df7538051e1acaa4859a4'

export async function GET() {
  return new NextResponse(INDEXNOW_KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
