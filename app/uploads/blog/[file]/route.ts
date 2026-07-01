import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.avif': 'image/avif',
}

export async function GET(_req: Request, { params }: { params: { file: string } }) {
	const file = params.file
	// جلوگیری از path traversal
	if (!/^[\w.-]+\.(png|jpe?g|webp|gif|avif)$/i.test(file)) {
		return new NextResponse('Not found', { status: 404 })
	}

	const path = join(process.cwd(), 'public', 'uploads', 'blog', file)
	if (!existsSync(path)) {
		return new NextResponse('Not found', { status: 404 })
	}

	const buf = await readFile(path)
	const ext = '.' + (file.split('.').pop() || '').toLowerCase()
	const contentType = MIME[ext] || 'application/octet-stream'

	return new NextResponse(buf, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	})
}
