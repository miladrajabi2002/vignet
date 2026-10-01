import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { isAdminAuthed } from '@/lib/admin/auth'
import { BLOG_UPLOAD_DIR, writeBlogImageVariants } from '@/lib/blog/image-processing'
import { matchesImageSignature } from '@/lib/security/file-signatures'
import {
	readBoundedRequestBody,
	RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif',
])
const MAX_BYTES = 6 * 1024 * 1024 // 6 MB
const MAX_FORM_BYTES = MAX_BYTES + 256 * 1024
const EXTENSION: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
}

export async function POST(req: Request) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}

	let rawBody: Buffer
	try {
		rawBody = await readBoundedRequestBody(req, MAX_FORM_BYTES)
	} catch (error) {
		if (error instanceof RequestBodyTooLargeError) {
			return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
		}
		throw error
	}
	const form = await new Response(new Uint8Array(rawBody), {
		headers: { 'Content-Type': req.headers.get('content-type') ?? '' },
	}).formData().catch(() => null)
	const file = form?.get('file')
	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
	}
	if (!ALLOWED.has(file.type)) {
		return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 415 })
	}
	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
	}
	if (file.size === 0) {
		return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 })
	}

	const buf = Buffer.from(await file.arrayBuffer())
	if (!matchesImageSignature(buf, file.type)) {
		return NextResponse.json({ error: 'INVALID_FILE_CONTENT' }, { status: 415 })
	}
	const ext = EXTENSION[file.type]
	const baseName = `${Date.now()}-${randomUUID()}`
	const name = `${baseName}.${ext}`

	// The original is kept untouched (Open Graph / social previews use it).
	const dir = BLOG_UPLOAD_DIR
	await mkdir(dir, { recursive: true })
	await writeFile(join(dir, name), buf)

	// Mobile / tablet / desktop WebP copies the public pages serve via srcset.
	// GIFs keep only the original (a resized WebP would lose the animation).
	// A failure here must not fail the upload: the image route regenerates any
	// missing variant from the original on first request.
	if (ext !== 'gif') {
		try {
			await writeBlogImageVariants(buf, baseName, dir)
		} catch (error) {
			console.error('[blog-upload] variant generation failed', error)
		}
	}

	return NextResponse.json({ url: `/api/uploads/blog/${name}` })
}
