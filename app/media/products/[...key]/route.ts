import {
  DELETE as deleteProductMedia,
  GET as serveProductMedia,
  OPTIONS as productMediaOptions,
} from '@/app/api/uploads/products/[...key]/route'

/**
 * Crawler-facing alias for public product media.
 *
 * This stays outside `/api` so Meta can fetch Instagram Generic Template
 * images even while robots.txt keeps the application's API endpoints private.
 * Both routes use the same path validation, MIME headers and disk location.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ key?: string[] }> }

export const OPTIONS = productMediaOptions

export async function GET(request: Request, props: Params) {
  return serveProductMedia(request, props)
}

export async function DELETE(request: Request, props: Params) {
  return deleteProductMedia(request, props)
}
