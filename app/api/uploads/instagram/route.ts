import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Check if ffmpeg is available on the server (cached after first call). */
let ffmpegAvailable: boolean | null = null
async function hasFfmpeg(): Promise<boolean> {
	if (ffmpegAvailable !== null) return ffmpegAvailable
	try {
		await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 })
		ffmpegAvailable = true
		console.log('[uploads/instagram] ffmpeg detected — voice transcoding enabled')
	} catch {
		ffmpegAvailable = false
		console.warn(
			'[uploads/instagram] ffmpeg NOT found — voice notes will stay as WebM and ' +
				'Instagram may reject them. Install ffmpeg: apt install ffmpeg',
		)
	}
	return ffmpegAvailable
}

/**
 * Transcode a WebM/Opus audio buffer to MP3 using ffmpeg. Instagram accepts
 * MP3, AAC (m4a), OGG, WAV for audio attachments — but NOT Opus-in-mp4.
 *
 * We use MP3 (not m4a/AAC) because:
 *  1. `libmp3lame` is bundled with virtually every ffmpeg build — always works.
 *  2. AAC encoder sometimes produces Opus-in-mp4 on misconfigured servers.
 *  3. Instagram accepts MP3 universally with no codec ambiguity.
 *
 * Returns { buf, ext, mime } or null when ffmpeg is unavailable / fails.
 */
async function transcodeWebmToMp3(
	webmBuffer: Buffer,
): Promise<{ buf: Buffer; ext: string; mime: string } | null> {
	if (!(await hasFfmpeg())) return null
	const tmpIn = join(
		process.cwd(),
		'public',
		'uploads',
		'instagram',
		`_tmp-${Date.now()}.webm`,
	)
	const tmpOut = tmpIn.replace(/\.webm$/, '.mp3')
	try {
		await writeFile(tmpIn, webmBuffer)
		await execFileAsync(
			'ffmpeg',
			[
				'-i',
				tmpIn,
				'-vn', // strip any video track
				'-c:a',
				'libmp3lame', // MP3 codec (always available)
				'-b:a',
				'128k', // 128 kbps — clear voice
				'-ar',
				'44100', // 44.1 kHz sample rate
				'-ac',
				'1', // mono
				'-y', // overwrite output
				tmpOut,
			],
			{ timeout: 30000 },
		)
		const buf = await readFile(tmpOut)
		if (buf.byteLength === 0) {
			console.error('[uploads/instagram] ffmpeg produced empty MP3')
			return null
		}
		console.log(
			`[uploads/instagram] ✓ webm→mp3 (${webmBuffer.byteLength}→${buf.byteLength} bytes)`,
		)
		return { buf, ext: 'mp3', mime: 'audio/mpeg' }
	} catch (e) {
		console.error(
			'[uploads/instagram] ffmpeg MP3 transcode failed:',
			(e as Error).message,
		)
		return null
	} finally {
		await unlink(tmpIn).catch(() => {})
		await unlink(tmpOut).catch(() => {})
	}
}

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
			return NextResponse.json(
				{ error: `EMPTY_FILE: "${f.name}" is empty` },
				{ status: 400 },
			)
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
			// Normalize the MIME type: strip the codec specifier (e.g.
			// "audio/webm;codecs=opus" → "audio/webm") so MIME_TO_EXT lookup
			// succeeds. Without this, the voice recorder's blob (which carries
			// the codecs suffix) would miss the map and fall back to the
			// filename extension ".webm" — the GET route would then serve it
			// as "video/webm" and Meta rejects that for audio attachments.
			const normalizedMime = (f.type || '').split(';')[0].trim().toLowerCase()
			// For audio files, prefer the MIME-derived extension over the
			// filename extension. This avoids the webm content-type trap:
			// the voice recorder uploads a File named "voice.webm" with MIME
			// "audio/webm", but ".webm" is a VIDEO container — the GET route
			// would serve it as "video/webm" and Meta rejects that for audio
			// attachments. MIME_TO_EXT maps "audio/webm" → "weba" which the
			// GET route serves as "audio/webm" (correct).
			const mimeExt = MIME_TO_EXT[normalizedMime]
			// For audio/webm, we transcode to m4a (Instagram-compatible) using
			// ffmpeg when available. The extension + contentType reflect the
			// ACTUAL stored file so the GET route serves the right Content-Type.
			let actualBuf: Buffer = Buffer.from(await f.arrayBuffer())
			let actualExt: string
			let actualMime: string
			if (normalizedMime === 'audio/webm') {
				const transcoded = await transcodeWebmToMp3(actualBuf)
				if (transcoded) {
					actualBuf = transcoded.buf
					actualExt = transcoded.ext
					actualMime = transcoded.mime
				} else {
					// ffmpeg unavailable or failed — keep webm but use .weba
					// extension so the GET route serves audio/webm (not video/webm).
					// Instagram may still reject it, but the preflight check will
					// surface a clear error explaining that ffmpeg is needed.
					actualExt = 'weba'
					actualMime = 'audio/webm'
				}
			} else {
				actualExt =
					(normalizedMime.startsWith('audio/') && mimeExt) || mimeExt || nameExt || 'bin'
				actualMime = normalizedMime || f.type || 'application/octet-stream'
			}
			const filename = `${ts}-${rand}.${actualExt}`
			// key = relative path on disk (also the URL path after /api/uploads/instagram/)
			const key = `instagram/${yyyy}/${mm}/${filename}`

			// Write to public/uploads/instagram/{YYYY}/{MM}/
			const dir = join(process.cwd(), 'public', 'uploads', 'instagram', yyyy, mm)
			await mkdir(dir, { recursive: true })
			await writeFile(join(dir, filename), actualBuf)

			// Absolute URL served through the /api/uploads/instagram/[...key]
			// route handler (which streams the file from disk with the correct
			// Content-Type). This is the canonical public path the operator
			// sees in the browser AND the URL Meta's crawler fetches.
			const url = `${base}/api/uploads/instagram/${yyyy}/${mm}/${filename}`

			uploaded.push({
				url,
				key,
				size: actualBuf.byteLength,
				contentType: actualMime,
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
