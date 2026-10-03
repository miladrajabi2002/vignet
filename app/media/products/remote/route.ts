import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { metaSafeUrl } from '@/lib/instagram/media'
import { cacheWorkspaceThumbnail, findWorkspaceThumbnail } from '@/lib/products/remote-image'

/**
 * GET /media/products/remote?u=<shop image URL>
 *
 * Fallback for product photos the viewer's browser could not load from the
 * shop itself (see components/products/product-image.tsx). The photo is
 * downloaded once — through the Iran relay when the shop refuses our server —
 * shrunk to a webp thumbnail inside the owning workspace's cache quota, and
 * the viewer is redirected to that immutable file. Only URLs that belong to a
 * catalog product are fetched, so this is not an open proxy. If the shop
 * cannot be reached at all, the viewer is redirected to the original URL.
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

/** Workspace that owns `raw` as a product (or variation) photo. */
async function owningWorkspace(raw: string, safe: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ workspaceId: string }>>`
    SELECT "workspaceId" FROM "Product"
    WHERE "deletedAt" IS NULL
      AND ("images" && ${[raw, safe]}::text[]
        OR strpos(COALESCE("attributes"::text, ''), ${raw}) > 0)
    LIMIT 1`
  return rows[0]?.workspaceId ?? null
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u')?.trim() ?? ''
  if (!raw || raw.length > MAX_URL_LENGTH || !/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
  }
  const safe = metaSafeUrl(raw)

  const workspaceId = await owningWorkspace(raw, safe)
  if (!workspaceId) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  try {
    const key =
      (await findWorkspaceThumbnail(safe, workspaceId)) ??
      (await cacheWorkspaceThumbnail(safe, workspaceId, { evict: true }))
    // Short-lived: an evicted thumbnail is rebuilt on the next request.
    return redirect(`/media/products/${key}`, 3_600)
  } catch (e) {
    console.warn(
      `[product-image] thumbnail failed for ${safe.slice(0, 140)}: ${(e as Error).message}`,
    )
    // Short-lived so a temporary shop outage is retried soon.
    return redirect(safe, 300)
  }
}
