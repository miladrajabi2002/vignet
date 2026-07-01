import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { isAdminAuthed } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif',
])
const MAX_BYTES = 6 * 1024 * 1024 // 6 MB

export async function POST(req: Request) {
	if (!isAdminAuthed()) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}

	const form = await req.formData().catch(() => null)
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

	const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5)
	const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
	const dir = join(process.cwd(), 'public', 'uploads', 'blog')
	await mkdir(dir, { recursive: true })
	const buf = Buffer.from(await file.arrayBuffer())
	await writeFile(join(dir, name), buf)

	return NextResponse.json({ url: `/uploads/blog/${name}` })
}
