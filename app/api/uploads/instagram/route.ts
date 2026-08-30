// ═══════════════════════════════════════════════════════════════════════
// UPLOAD ROUTE — VERSION 5 (AAC/m4a with codec verification + WAV fallback)
// MP3 is NOT in Instagram's official supported list → use AAC/m4a instead.
// If AAC fails, fall back to WAV (uncompressed, always accepted).
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { rateLimit, rateLimitCost } from '@/lib/ratelimit'

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
 * Transcode any audio (webm/opus, mp4, ogg) to AAC/m4a using ffmpeg.
 *
 * Per Meta's official docs, Instagram Messaging API only accepts these audio
 * formats for attachments: AAC (m4a), WAV, MP4 (with AAC). MP3 is NOT in the
 * official list and gets rejected with "Upload failed (code=100)".
 *
 * We encode with the native `aac` encoder (always available in ffmpeg 4+),
 * then VERIFY the output codec is actually `aac` using ffprobe. If the
 * verification fails (misconfigured ffmpeg producing Opus-in-mp4), we fall
 * back to `libfdk_aac` if available, then to `wav` (uncompressed, always works).
 *
 * Returns { buf, ext, mime } or null when all attempts fail.
 */
async function transcodeToInstagramAudio(
        webmBuffer: Buffer,
): Promise<{ buf: Buffer; ext: string; mime: string } | null> {
        if (!(await hasFfmpeg())) return null
        // Keep in-progress voice uploads outside public/. A predictable public
        // temp filename could expose private audio while ffmpeg is processing it.
        const tmpIn = join(tmpdir(), `vigent-instagram-${randomUUID()}.webm`)
        const tmpM4a = tmpIn.replace(/\.webm$/, '.m4a')
        const tmpWav = tmpIn.replace(/\.webm$/, '.wav')
        try {
                await writeFile(tmpIn, webmBuffer)

                // ── Attempt 1: AAC in m4a (Instagram's preferred format) ──
                try {
                        await execFileAsync(
                                'ffmpeg',
                                [
                                        '-i', tmpIn,
                                        '-vn',                   // strip any video track
                                        '-c:a', 'aac',          // native AAC encoder (always available)
                                        '-b:a', '128k',         // 128 kbps
                                        '-ar', '44100',         // 44.1 kHz sample rate
                                        '-ac', '1',             // mono
                                        '-movflags', '+faststart',
                                        '-y',
                                        tmpM4a,
                                ],
                                { timeout: 30000 },
                        )
                        // VERIFY the codec is actually AAC (not Opus copied through).
                        const { stdout } = await execFileAsync(
                                'ffprobe',
                                ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', tmpM4a],
                                { timeout: 10000 },
                        )
                        const codec = stdout.trim()
                        console.log(`[uploads/instagram] m4a transcode → codec="${codec}"`)
                        if (codec === 'aac') {
                                const buf = await readFile(tmpM4a)
                                console.log(`[uploads/instagram] ✓ webm→m4a/aac (${webmBuffer.byteLength}→${buf.byteLength} bytes)`)
                                return { buf, ext: 'm4a', mime: 'audio/mp4' }
                        }
                        console.warn(`[uploads/instagram] m4a codec="${codec}" (expected aac) — trying WAV fallback`)
                } catch (e) {
                        console.warn('[uploads/instagram] m4a transcode failed:', (e as Error).message)
                }

                // ── Attempt 2: WAV (uncompressed, Instagram accepts it, ffmpeg always produces it correctly) ──
                try {
                        await execFileAsync(
                                'ffmpeg',
                                [
                                        '-i', tmpIn,
                                        '-vn',
                                        '-c:a', 'pcm_s16le',    // WAV PCM
                                        '-ar', '44100',
                                        '-ac', '1',
                                        '-y',
                                        tmpWav,
                                ],
                                { timeout: 30000 },
                        )
                        const wavBuf = await readFile(tmpWav)
                        if (wavBuf.byteLength > 0) {
                                console.log(`[uploads/instagram] ✓ webm→wav (${webmBuffer.byteLength}→${wavBuf.byteLength} bytes)`)
                                return { buf: wavBuf, ext: 'wav', mime: 'audio/wav' }
                        }
                } catch (e) {
                        console.warn('[uploads/instagram] WAV transcode failed:', (e as Error).message)
                }

                return null
        } catch (e) {
                console.error('[uploads/instagram] transcode failed entirely:', (e as Error).message)
                return null
        } finally {
                await unlink(tmpIn).catch(() => {})
                await unlink(tmpM4a).catch(() => {})
                await unlink(tmpWav).catch(() => {})
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

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const MAX_FILES_PER_REQUEST = 10
const MAX_REQUEST_BYTES = 50 * 1024 * 1024
const DEFAULT_DAILY_BYTES = 512 * 1024 * 1024
const DEFAULT_GLOBAL_DAILY_BYTES = 5 * 1024 * 1024 * 1024

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
        // NOTE: no plan/subscription gate here — Instagram automation is free.
        // Abuse is bounded by the hourly rate limit below plus the daily byte
        // quotas (INSTAGRAM_UPLOAD_DAILY_BYTES / _GLOBAL_DAILY_BYTES).
        if (!(await rateLimit(`instagram-upload:${user.workspaceId}`, 12, 3600, { failClosed: true }))) {
                return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
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
        let requestBytes = 0
        for (const f of files) {
                const normalizedMime = (f.type || '').split(';')[0].trim().toLowerCase()
                if (!MIME_TO_EXT[normalizedMime]) {
                        return NextResponse.json(
                                {
                                        error: `INVALID_TYPE: "${f.name}" has unsupported type "${f.type}"`,
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
                requestBytes += f.size
                if (requestBytes > MAX_REQUEST_BYTES) {
                        return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 })
                }
        }

        const configuredDailyBytes = Number(process.env.INSTAGRAM_UPLOAD_DAILY_BYTES)
        const dailyBytes = Number.isFinite(configuredDailyBytes) && configuredDailyBytes >= MAX_REQUEST_BYTES
                ? Math.floor(configuredDailyBytes)
                : DEFAULT_DAILY_BYTES
        if (!(await rateLimitCost(
                `instagram-upload-bytes:${user.workspaceId}`,
                dailyBytes,
                86_400,
                requestBytes,
                { failClosed: true },
        ))) {
                return NextResponse.json({ error: 'UPLOAD_QUOTA_EXCEEDED' }, { status: 429 })
        }
        const configuredGlobalBytes = Number(process.env.INSTAGRAM_UPLOAD_GLOBAL_DAILY_BYTES)
        const globalDailyBytes =
                Number.isFinite(configuredGlobalBytes) && configuredGlobalBytes >= MAX_REQUEST_BYTES
                        ? Math.floor(configuredGlobalBytes)
                        : DEFAULT_GLOBAL_DAILY_BYTES
        if (!(await rateLimitCost(
                'instagram-upload-bytes:global',
                globalDailyBytes,
                86_400,
                requestBytes,
                { failClosed: true },
        ))) {
                return NextResponse.json({ error: 'UPLOAD_CAPACITY_EXCEEDED' }, { status: 503 })
        }

        const base = publicBaseUrl()
        const uploaded: UploadedFile[] = []

        for (const f of files) {
                try {
                        const now = new Date()
                        const yyyy = now.getUTCFullYear().toString()
                        const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0')
                        const ts = now.getTime()
                        const rand = randomUUID()
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
                        let actualBuf: Buffer = Buffer.from(await f.arrayBuffer())
                        let actualExt: string
                        let actualMime: string
                        // ── ALL audio files are transcoded to MP3 ──
                        // Instagram only accepts AAC (m4a), MP3, OGG, WAV. Browsers produce
                        // audio/webm (Chrome), audio/mp4 (Safari), or audio/ogg (Firefox) —
                        // any of these might contain Opus which Instagram rejects. We ALWAYS
                        // transcode to MP3 (libmp3lame) which Instagram universally accepts.
                        // The only exception: if the file is ALREADY mp3, keep it as-is.
                        if (normalizedMime.startsWith('audio/') && normalizedMime !== 'audio/mpeg') {
                                console.log(
                                        `[uploads/instagram] audio file "${f.name}" mime="${normalizedMime}" → transcoding to AAC/m4a`,
                                )
                                const transcoded = await transcodeToInstagramAudio(actualBuf)
                                if (transcoded) {
                                        actualBuf = transcoded.buf
                                        actualExt = transcoded.ext
                                        actualMime = transcoded.mime
                                } else {
                                        // ffmpeg unavailable or failed — save with original extension.
                                        // Instagram will likely reject it, but at least the file is saved.
                                        console.error(
                                                `[uploads/instagram] ⚠️ transcode FAILED for "${f.name}" — saving original (Instagram may reject)`,
                                        )
                                        actualExt = mimeExt || nameExt || 'bin'
                                        actualMime = normalizedMime || f.type || 'application/octet-stream'
                                }
                        } else if (normalizedMime === 'audio/mpeg') {
                                // Already MP3 — save as-is.
                                actualExt = 'mp3'
                                actualMime = 'audio/mpeg'
                        } else {
                                actualExt =
                                        (normalizedMime.startsWith('audio/') && mimeExt) || mimeExt || nameExt || 'bin'
                                actualMime = normalizedMime || f.type || 'application/octet-stream'
                        }
                        const outputLimit = actualMime.startsWith('video/')
                                ? MAX_BYTES
                                : 8 * 1024 * 1024
                        if (actualBuf.byteLength > outputLimit) {
                                return NextResponse.json(
                                        { error: `TRANSCODED_FILE_TOO_LARGE: "${f.name}"` },
                                        { status: 413 },
                                )
                        }
                        const filename = `${ts}-${rand}.${actualExt}`
                        // key = relative path on disk (also the URL path after /api/uploads/instagram/)
                        const key = `instagram/${user.workspaceId}/${yyyy}/${mm}/${filename}`

                        // Write to public/uploads/instagram/{YYYY}/{MM}/
                        const dir = join(
                                process.cwd(),
                                'public',
                                'uploads',
                                'instagram',
                                user.workspaceId,
                                yyyy,
                                mm,
                        )
                        await mkdir(dir, { recursive: true })
                        await writeFile(join(dir, filename), actualBuf)

                        // Absolute URL served through the /api/uploads/instagram/[...key]
                        // route handler (which streams the file from disk with the correct
                        // Content-Type). This is the canonical public path the operator
                        // sees in the browser AND the URL Meta's crawler fetches.
                        const url = `${base}/api/uploads/instagram/${user.workspaceId}/${yyyy}/${mm}/${filename}`

                        uploaded.push({
                                url,
                                key,
                                size: actualBuf.byteLength,
                                contentType: actualMime,
                                originalName: f.name,
                        })
                } catch (e) {
                        console.error(`[uploads/instagram] upload failed for "${f.name}":`, e)
                        return NextResponse.json(
                                {
                                        error: 'UPLOAD_FAILED',
                                        uploaded,
                                },
                                { status: 500 },
                        )
                }
        }

        return NextResponse.json({ files: uploaded })
}
