import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'
import { BLOG_UPLOAD_DIR, ensureBlogImageVariant } from '@/lib/blog/image-processing'
import { parseBlogImageVariant } from '@/lib/blog/image-variants'

export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.avif': 'image/avif',
}

// File names are unique timestamp+uuid values and never rewritten, so a
// year-long immutable cache is safe for originals and variants alike.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

export async function GET(req: Request, props: { params: Promise<{ file: string }> }) {
    const params = await props.params;
    const file = params.file
    // جلوگیری از path traversal
    if (!/^[\w.-]+\.(png|jpe?g|webp|gif|avif)$/i.test(file)) {
		return new NextResponse('Not found', { status: 404 })
	}

    let path: string | null = join(BLOG_UPLOAD_DIR, file)
    if (!existsSync(path)) {
		// Responsive variant (<base>-w960.webp …) that doesn't exist yet: build
		// it from the original once, then serve it from disk from then on.
		const variant = parseBlogImageVariant(file)
		path = variant
			? await ensureBlogImageVariant(variant.baseName, variant.width).catch((error) => {
					console.error('[blog-image] variant generation failed', file, error)
					return null
				})
			: null
		if (!path) {
			return new NextResponse('Not found', { status: 404 })
		}
	}

    const info = await stat(path)
    const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`
    if (req.headers.get('if-none-match') === etag) {
		return new NextResponse(null, {
			status: 304,
			headers: { ETag: etag, 'Cache-Control': CACHE_CONTROL },
		})
	}

    const buf = await readFile(path)
    const ext = '.' + (file.split('.').pop() || '').toLowerCase()
    const contentType = MIME[ext] || 'application/octet-stream'

    return new NextResponse(buf, {
		headers: {
			'Content-Type': contentType,
			'Content-Length': String(buf.length),
			'Cache-Control': CACHE_CONTROL,
			ETag: etag,
			'X-Content-Type-Options': 'nosniff',
		},
	})
}
