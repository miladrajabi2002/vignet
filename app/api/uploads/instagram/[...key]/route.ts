import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { hasWorkspacePermission } from '@/lib/workspace-permissions'

/**
 * Instagram automation media — GET (serve from local disk) + DELETE.
 *
 * Files are stored on the LOCAL DISK under `public/uploads/instagram/`
 * (same pattern as the blog poster upload). This route serves them to:
 *   - the operator's browser (for the live iPhone preview + dashboard)
 *   - Meta's Instagram API crawler (which fetches the media URL server-side
 *     to send it as a DM attachment — the URL must be public HTTPS)
 *
 * GET is PUBLIC (no login) because Meta's crawler can't authenticate, and
 * because <img src="..."> tags can't send auth headers. The filename is
 * unguessable enough (timestamp + 8-char UUID) for the threat model.
 *
 * DELETE requires auth (operator only).
 *
 * Safety: only paths under `public/uploads/instagram/` are servable/deletable,
 * so this route can't be abused to read arbitrary files from the server.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ key?: string[] }> }

/** MIME map from file extension — so images render inline instead of downloading.
 *
 * Note on `.webm`: in this project, `.webm` files in the instagram/ folder are
 * ALWAYS voice recordings (the voice recorder outputs WebM/Opus). Video files
 * use `.mp4` / `.mov`. So we serve `.webm` as `audio/webm` — NOT `video/webm` —
 * so Meta accepts it as an audio attachment. (The upload route also renames
 * new voice uploads to `.weba`, but this handles legacy `.webm` files too.)
 */
const EXT_TO_MIME: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        avif: 'image/avif',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        // `.weba` and `.webm` both serve as audio/webm — voice recordings only.
        weba: 'audio/webm',
        webm: 'audio/webm',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
}

/**
 * Resolve the catch-all `key` segments into a safe local file path.
 * Returns null when the path is invalid or escapes the uploads directory.
 *
 * Note: this route lives at `app/api/uploads/instagram/[...key]/route.ts`, so
 * the catch-all `key` starts AFTER `/api/uploads/instagram/`. For a URL like
 * `/api/uploads/instagram/2026/07/file.png`, `key` = `['2026', '07', 'file.png']`.
 * The `instagram/` folder is always prepended on disk — it's NOT part of `key`.
 */
function resolveFilePath(keySegments: string[] | undefined): string | null {
        if (!keySegments || keySegments.length === 0) return null
        // Reject path-traversal attempts in any single segment (e.g. `..`).
        if (keySegments.some((seg) => seg === '..' || seg.includes('\\'))) return null
        // Reject anything that looks like an absolute/relative path escape.
        if (keySegments.some((seg) => seg.startsWith('/') || seg.startsWith('~'))) return null
        // Build the absolute path on disk. The `instagram/` folder is always
        // prepended because the route is already scoped to /api/uploads/instagram/.
        return join(process.cwd(), 'public', 'uploads', 'instagram', ...keySegments)
}

/** Handle CORS preflight requests from Meta's crawler. */
export async function OPTIONS() {
        return new NextResponse(null, {
                status: 204,
                headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                        'Access-Control-Allow-Headers': '*',
                        'Access-Control-Max-Age': '86400',
                },
        })
}

/** Stream an uploaded media file from disk to the browser (public). */
export async function GET(_req: Request, props: Params) {
        const { key: keySegments } = await props.params
        const filePath = resolveFilePath(keySegments)
        if (!filePath) {
                return NextResponse.json({ error: 'INVALID_KEY' }, { status: 400 })
        }

        if (!existsSync(filePath)) {
                return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
        }

        const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
        const contentType = EXT_TO_MIME[ext] || 'application/octet-stream'

        try {
                const buf = await readFile(filePath)
                // Meta's Instagram API crawler fetches media URLs server-side and
                // REQUIRES an explicit Content-Length header. Without it, Meta treats
                // the file as 0 bytes and returns "Upload failed (code=100)".
                // NextResponse doesn't auto-set Content-Length for Buffer bodies, so
                // we set it explicitly here.
                return new NextResponse(buf, {
                        headers: {
                                'Content-Type': contentType,
                                'Content-Length': String(buf.byteLength),
                                // Cache for a year — uploaded media is immutable (timestamp + UUID key).
                                'Cache-Control': 'public, max-age=31536000, immutable',
                                'Access-Control-Allow-Origin': '*',
                                // Allow Meta's crawler to fetch with cross-origin requests.
                                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                                'Access-Control-Allow-Headers': '*',
                        },
                })
        } catch {
                return NextResponse.json({ error: 'READ_FAILED' }, { status: 500 })
        }
}

/** Delete an uploaded media file from disk (operator only). */
export async function DELETE(_req: Request, props: Params) {
        const { key: keySegments } = await props.params

        const user = await getCurrentUser()
        if (!user) {
                return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
        }
        if (!hasWorkspacePermission(user.role, 'catalog:manage')) {
                return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
        }

        // New uploads are namespaced by workspace. Legacy unscoped objects stay
        // publicly readable for Meta delivery but cannot be deleted by tenants.
        if (!keySegments || keySegments[0] !== user.workspaceId) {
                return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
        }

        const filePath = resolveFilePath(keySegments)
        if (!filePath) {
                return NextResponse.json(
                        { error: 'INVALID_KEY or forbidden (only instagram/ allowed)' },
                        { status: 400 },
                )
        }

        if (!existsSync(filePath)) {
                // Already deleted — treat as success (idempotent).
                return NextResponse.json({ ok: true, key: keySegments?.join('/') })
        }

        try {
                await unlink(filePath)
        } catch (e) {
                return NextResponse.json(
                        { error: `DELETE_FAILED: ${(e as Error).message}` },
                        { status: 500 },
                )
        }

        return NextResponse.json({ ok: true, key: keySegments?.join('/') })
}
