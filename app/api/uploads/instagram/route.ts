import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Multipart upload endpoint for Instagram automation media.
 *
 * Files are written to the LOCAL DISK under `public/uploads/instagram/`
 * (same pattern as the blog poster upload). No S3/MinIO dependency —
 * simpler and more reliable for single-server deployments.
 *
 * Accepts `multipart/form-data` with one or more files under the `files` field,
 * writes each to `public/uploads/instagram/{YYYY}/{MM}/{timestamp}-{rand}.{ext}`,
 * and returns the ABSOLUTE public URL the client should store against the
 * automation scenario (so `lib/instagram/media.ts` can later pass it to the
 * Instagram Messaging API as `attachment.payload.url`).
 *
 * The absolute URL is built from `S3_PUBLIC_URL` (e.g. `https://vigent.ir`) +
 * `/api/uploads/instagram/` + path. Meta's crawler fetches this URL server-side,
 * so it must be publicly reachable over HTTPS — a relative URL won't work.
 *
 * Allowed types: image/*, audio/*, video/*.
 * Max size per file: 25 MB. Max files per request: 10.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_PREFIXES = ['image/', 'audio/', 'video/'] as const
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const MAX_FILES_PER_REQUEST = 10

/** MIME → file extension map for generating safe filenames. */
const MIME_TO_EXT: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/avif': 'avif',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/wave': 'wav',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/webm': 'weba',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
}

interface UploadedFile {
        url: string
        key: string
        size: number
        contentType: string
        originalName: string
}

/** Resolve the public base URL for constructing absolute media URLs. */
function publicBaseUrl(): string {
        // S3_PUBLIC_URL is reused here (even though we're not using S3) because it's
        // already the canonical "public origin" env var (e.g. https://vigent.ir).
        const base = process.env.S3_PUBLIC_URL
        if (base) return base.replace(/\/+$/, '')
        // Fallback: no env var — the URL will be relative (works for the operator's
        // browser preview, but NOT for Meta's crawler). Log once.
        console.warn(
                '[uploads/instagram] S3_PUBLIC_URL is not set — media URLs will be relative. ' +
                        'Set S3_PUBLIC_URL=https://vigent.ir in .env so Instagram can fetch them.',
        )
        return ''
}

export async function POST(req: Request) {
        const user = await getCurrentUser()
        if (!user) {
                return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
        }

        let form: FormData
        try {
                form = await req.formData()
        } catch {
                return NextResponse.json(
                        { error: 'INVALID_FORM: expected multipart/form-data' },
                        { status: 400 },
                )
        }

        const raw = form.getAll('files')
        const files = raw.filter((f): f is File => f instanceof File)
        if (files.length === 0) {
                return NextResponse.json(
                        { error: 'NO_FILES: provide one or more files in the "files" field' },
                        { status: 400 },
                )
        }
        if (files.length > MAX_FILES_PER_REQUEST) {
                return NextResponse.json(
                        { error: `TOO_MANY_FILES: max ${MAX_FILES_PER_REQUEST} per request` },
                        { status: 400 },
                )
        }

        // Validate every file BEFORE writing any — a bad file should 400, not leave
        // half an upload behind on disk.
        for (const f of files) {
                if (!ALLOWED_PREFIXES.some((p) => f.type.startsWith(p))) {
                        return NextResponse.json(
                                {
                                        error: `INVALID_TYPE: "${f.name}" has type "${f.type}" — only image/*, audio/*, video/* are allowed`,
                                },
                                { status: 400 },
                        )
                }
                if (f.size === 0) {
                        return NextResponse.json({ error: `EMPTY_FILE: "${f.name}" is empty` }, { status: 400 })
                }
                if (f.size > MAX_BYTES) {
                        return NextResponse.json(
                                {
                                        error: `TOO_LARGE: "${f.name}" is ${(f.size / 1024 / 1024).toFixed(2)} MB — max ${MAX_BYTES / 1024 / 1024} MB`,
                                },
                                { status: 400 },
                        )
                }
        }

        const base = publicBaseUrl()
        const uploaded: UploadedFile[] = []

        for (const f of files) {
                try {
                        const now = new Date()
                        const yyyy = now.getUTCFullYear().toString()
                        const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0')
                        const ts = now.getTime()
                        const rand = randomUUID().slice(0, 8)
                        const nameExt = (f.name.split('.').pop() || '').toLowerCase()
                        const ext = nameExt || MIME_TO_EXT[f.type] || 'bin'
                        const filename = `${ts}-${rand}.${ext}`
                        // key = relative path on disk (also the URL path after /uploads/)
                        const key = `instagram/${yyyy}/${mm}/${filename}`

                        // Write to public/uploads/instagram/{YYYY}/{MM}/
                        const dir = join(process.cwd(), 'public', 'uploads', 'instagram', yyyy, mm)
                        await mkdir(dir, { recursive: true })
                        const buf = Buffer.from(await f.arrayBuffer())
                        await writeFile(join(dir, filename), buf)

                        // Absolute URL served through the /api/uploads/instagram/[...key]
                        // route handler (which streams the file from disk with the correct
                        // Content-Type). This is the canonical public path the operator
                        // sees in the browser AND the URL Meta's crawler fetches.
                        const url = `${base}/api/uploads/instagram/${yyyy}/${mm}/${filename}`

                        uploaded.push({
                                url,
                                key,
                                size: buf.byteLength,
                                contentType: f.type || 'application/octet-stream',
                                originalName: f.name,
                        })
                } catch (e) {
                        return NextResponse.json(
                                {
                                        error: `UPLOAD_FAILED for "${f.name}": ${(e as Error).message}`,
                                        uploaded,
                                },
                                { status: 500 },
                        )
                }
        }

        return NextResponse.json({ files: uploaded })
}
