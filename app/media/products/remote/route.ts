import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { metaSafeUrl } from '@/lib/instagram/media'
import { cacheRemoteImage, findCachedRemoteImage } from '@/lib/products/remote-image'

/**
 * GET /media/products/remote?u=<shop image URL>
 *
 * Serves a product photo hosted on a shop domain from our origin (see
 * `lib/products/image-src.ts`). The first request downloads the image into the
 * shared `products/proxy/` cache; every request then redirects to the
 * immutable cached file. Only URLs that belong to a catalog product are
 * fetched, so this is not an open proxy. If the shop cannot be reached from
 * the server either, the viewer is redirected to the original URL.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_URL_LENGTH = 2048

function redirect(location: string, maxAge: number) {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': `public, max-age=${maxAge}`,
      'Referrer-Policy': 'no-referrer',
    },
  })
}

async function isCatalogImage(raw: string, safe: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
    SELECT 1 AS ok FROM "Product"
    WHERE "deletedAt" IS NULL
      AND ("images" && ${[raw, safe]}::text[]
        OR strpos(COALESCE("attributes"::text, ''), ${raw}) > 0)
    LIMIT 1`
  return rows.length > 0
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u')?.trim() ?? ''
  if (!raw || raw.length > MAX_URL_LENGTH || !/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
  }
  const safe = metaSafeUrl(raw)

  const cached = await findCachedRemoteImage(safe).catch(() => null)
  if (cached) return redirect(`/media/products/proxy/${cached.filename}`, 86_400)

  if (!(await isCatalogImage(raw, safe))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  try {
    const stored = await cacheRemoteImage(safe)
    return redirect(`/media/products/proxy/${stored.filename}`, 86_400)
  } catch (e) {
    console.warn(
      `[product-image] remote fetch failed for ${safe.slice(0, 140)}: ${(e as Error).message}`,
    )
    // Short-lived so a temporary shop outage is retried soon.
    return redirect(safe, 300)
  }
}
