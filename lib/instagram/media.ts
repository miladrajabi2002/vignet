import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readPageToken } from '@/lib/instagram/config'
import { GRAPH_BASE } from '@/lib/instagram/oauth'
import { captureError } from '@/lib/errors/capture'
import { safeHttpGet } from '@/lib/security/safe-http'
import { BUCKETS, fileExists, isStorageConfigured, uploadFile } from '@/lib/storage'
import { cleanDescriptionForChat } from '@/lib/products/description'
import { igRecipient } from '@/lib/instagram/private-reply'

/**
 * Rich-media send helpers for the Instagram Messaging API.
 *
 * The base adapter (`lib/channels/instagram.ts`) only implements `sendText`
 * (with optional quick-reply chips). Vardast's automation engine can reply
 * with images, voice, video, product showcase cards, and up-to-3 button
 * templates — these helpers extend that surface without monkey-patching the
 * adapter interface.
 *
 * All helpers POST to `{GRAPH_BASE}/me/messages` with the IG (or Page) access
 * token, using the Messenger Platform message envelope shape:
 *
 *     { recipient: { id }, message: { attachment | text }, messaging_type }
 *
 * The IG token must have `instagram_business_manage_messages` (Instagram Login)
 * or `pages_messaging` (legacy FB Login). For URLs to be accepted as media
 * attachments they MUST be served over HTTPS and reachable by Meta's crawler.
 */

/** A product snapshot used to render a catalog/showcase card. */
export interface ProductShowcase {
        id: string
        name: string
        description?: string | null
        price?: number | null
        imageUrl?: string | null
        /** Optional deep-link URL the button opens (e.g. website product page). */
        productUrl?: string | null
}

/** A tappable button on a button-template message. */
export interface ButtonAction {
        /** Button title (max 20 chars; truncated if longer). */
        title: string
        /** URL the button opens, OR the postback payload sent back when tapped. */
        url?: string
        payload?: string
}

/** Resolve a working IG/Page access token from a channel config blob. */
function resolveToken(channelConfig: Prisma.JsonValue): string | null {
        return readPageToken(channelConfig)
}

// ── Meta-safe image URL helpers (v3.1) ─────────────────────────────────────────
// WooCommerce product images frequently break Instagram's Generic Template in
// two ways, both of which show up as "the card renders without a photo":
//   1. `.webp` files — Meta's template renderer only supports JPG/PNG/GIF, so
//      webp URLs are silently dropped.
//   2. Non-ASCII (Persian) path segments — the crawler needs a percent-encoded
//      URL; raw unicode in `image_url` fails intermittently.

/** True when the URL points at a Generic-Template-supported image format. */
function isTemplateSupportedImage(url: string): boolean {
        return /\.(jpe?g|png|gif)(?:[?#]|$)/i.test(url)
}

/** True when the URL points at a webp (unsupported by the template renderer). */
function isWebpUrl(url: string): boolean {
        return /\.webp(?:[?#]|$)/i.test(url)
}

/**
 * Percent-encode a URL for Meta payloads: keeps the reserved ASCII structure
 * intact, encodes non-ASCII (Persian) path segments. `encodeURI` semantics are
 * exactly what a browser address bar does, and Meta's crawler accepts it.
 *
 * IDEMPOTENT (v3.3): callers upstream (`pickTemplateImageUrl`, `safeProductUrl`)
 * frequently pass an ALREADY percent-encoded URL. Naively re-encoding would
 * escape the percent signs themselves (%D8 → %25D8 — double encoding), which
 * made Meta's crawler 404 on Persian product-image URLs and drop the image.
 * We only encode when the URL contains no percent-escapes yet.
 */
export function metaSafeUrl(url: string): string {
        try {
                if (/%[0-9A-Fa-f]{2}/.test(url)) return url
                return encodeURI(url)
        } catch {
                return url
        }
}

/**
 * Pick the best image URL for a Meta Generic Template card from a product's
 * image list: the first JPG/PNG/GIF beats any webp; a webp is used only as a
 * last resort (better a maybe-broken image than none). Returns a percent-
 * encoded URL, or null when the list is empty.
 */
export function pickTemplateImageUrl(images: string[] | null | undefined): string | null {
        if (!images?.length) return null
        const supported = images.find((u) => typeof u === 'string' && isTemplateSupportedImage(u))
        const fallback = images.find((u) => typeof u === 'string' && !isWebpUrl(u))
        const chosen = supported ?? fallback ?? images.find((u) => typeof u === 'string')
        return chosen ? metaSafeUrl(chosen) : null
}

// ─── v3.3: SERVER-SIDE IMAGE PROXY FOR TEMPLATE CARDS ────────────────────
//
// Meta's Generic Template `image_url` is fetched SERVER-SIDE by Meta's
// crawler (User-Agent "facebookexternalhit/*"). Many WooCommerce shops —
// including the tenants' own (e.g. ceeports.ir) — return 403 to that
// crawler (hotlink protection / WAF rules), even though the same URL is
// perfectly reachable from our server with a normal User-Agent. The result:
// product cards arrived in the DM with NO image while the panel preview
// looked fine.
//
// Fix: before handing an image URL to Meta, download it ourselves (our
// egress is not blocked), cache the bytes in shared object storage keyed by
// SHA-1 of the source URL, and give Meta a URL on OUR origin served by the public route
// `app/media/products/[...key]` (GET /media/products/proxy/…). Keeping the
// crawler-facing path outside `/api` also avoids stale robots.txt denials.
// URLs already on our own origin are passed through untouched.

const IMAGE_PROXY_DIR = join(process.cwd(), 'public', 'uploads', 'products', 'proxy')
const PUBLIC_PRODUCT_MEDIA_PATH = '/media/products/'
const LEGACY_PRODUCT_MEDIA_PATHS = ['/api/uploads/products/', '/uploads/products/'] as const
const PROXY_IMAGE_EXTS = ['jpg', 'png', 'webp', 'gif', 'avif'] as const
const PROXY_MIME_EXT: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/avif': 'avif',
}

let warnedNoPublicBase = false

/** The public origin Meta's crawler can reach (S3_PUBLIC_URL / NEXT_PUBLIC_APP_URL). */
function publicBaseUrl(): string {
        const base =
                process.env.S3_PUBLIC_URL ??
                process.env.NEXT_PUBLIC_APP_URL ??
                process.env.NEXT_PUBLIC_SITE_URL
        return base ? base.replace(/\/+$/, '') : ''
}

/** True when the URL is already hosted on our own origin (nothing to proxy). */
function isOwnOriginUrl(url: string): boolean {
        const base = publicBaseUrl()
        if (!base) return false
        try {
                return new URL(url).hostname === new URL(base).hostname
        } catch {
                return false
        }
}

/**
 * Return an own-origin image through the crawler-facing public media route.
 * Existing catalog rows can still contain either the old API URL or the old
 * runtime-static URL, so normalize both at send time without a data migration.
 */
function publicOwnOriginImageUrl(url: string): string {
        const safe = metaSafeUrl(url)
        const base = publicBaseUrl()
        if (!base) return safe

        try {
                const parsed = new URL(safe)
                const legacyPrefix = LEGACY_PRODUCT_MEDIA_PATHS.find((prefix) =>
                        parsed.pathname.startsWith(prefix),
                )
                if (!legacyPrefix) return safe

                const key = parsed.pathname.slice(legacyPrefix.length)
                return `${base}${PUBLIC_PRODUCT_MEDIA_PATH}${key}${parsed.search}${parsed.hash}`
        } catch {
                return safe
        }
}

/**
 * Resolve an image URL for a Meta Generic Template element.
 *
 * - own-origin URLs → percent-encoded as-is
 * - external URLs → downloaded server-side, cached under
 *   products/proxy/{sha1}.{ext}, and served from OUR origin
 *   so Meta's crawler never talks to the (possibly blocking) source host
 * - on failure → falls back to the legacy disk cache, then the original URL
 *
 * Never throws.
 */
export async function templateImageUrl(rawUrl: string): Promise<string> {
        // rawUrl usually arrives ALREADY percent-encoded (pickTemplateImageUrl
        // output). metaSafeUrl is idempotent, so this encodes exactly once —
        // never double-escapes.
        const safe = metaSafeUrl(rawUrl)
        if (isOwnOriginUrl(rawUrl)) return publicOwnOriginImageUrl(safe)

        const base = publicBaseUrl()
        if (!base) {
                if (!warnedNoPublicBase) {
                        warnedNoPublicBase = true
                        console.warn(
                                '[ig-product] no public base URL env (S3_PUBLIC_URL / NEXT_PUBLIC_APP_URL) — ' +
                                        'cannot proxy external product images for Meta',
                        )
                }
                return safe
        }

        let localCacheFallback: string | null = null
        try {
                const hash = createHash('sha1').update(safe).digest('hex')
                // Cache hit? (extension unknown until first download — probe all)
                for (const ext of PROXY_IMAGE_EXTS) {
                        const filename = `${hash}.${ext}`
                        if (existsSync(join(IMAGE_PROXY_DIR, filename))) {
                                localCacheFallback = `${base}${PUBLIC_PRODUCT_MEDIA_PATH}proxy/${filename}`
                                if (!isStorageConfigured()) return localCacheFallback
                        }
                        if (
                                isStorageConfigured() &&
                                (await fileExists(BUCKETS.products, `proxy/${filename}`))
                        ) {
                                return `${base}${PUBLIC_PRODUCT_MEDIA_PATH}proxy/${hash}.${ext}`
                        }
                }

                const res = await safeHttpGet(safe, {
                        timeoutMs: 15_000,
                        maxBytes: 8 * 1024 * 1024,
                        maxRedirects: 3,
                        allowedContentTypes: ['image/'],
                })
                if (res.status < 200 || res.status >= 300) {
                        throw new Error(`source returned HTTP ${res.status}`)
                }
                const ct = String(res.headers['content-type'] ?? '')
                        .split(';')[0]
                        .trim()
                        .toLowerCase()
                const ext = PROXY_MIME_EXT[ct]
                if (!ext) throw new Error(`unsupported content-type "${ct}"`)

                const filename = `${hash}.${ext}`
                if (isStorageConfigured()) {
                        // Deterministic keys make concurrent writes harmless and keep
                        // the cache shared when the app runs on multiple instances.
                        await uploadFile({
                                bucket: BUCKETS.products,
                                path: `proxy/${filename}`,
                                body: res.body,
                                contentType: ct,
                                cacheControl: 'public, max-age=31536000, immutable',
                        })
                } else {
                        await mkdir(IMAGE_PROXY_DIR, { recursive: true })
                        try {
                                await writeFile(join(IMAGE_PROXY_DIR, filename), res.body, {
                                        flag: 'wx',
                                })
                        } catch (e) {
                                // Two sends racing on the same image: the loser gets EEXIST —
                                // the cache file is already there, which is success.
                                if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
                        }
                }
                console.log(
                        `[ig-product] proxied image ${res.body.byteLength}B → ${filename} (src: ${safe.slice(0, 120)})`,
                )
                return `${base}${PUBLIC_PRODUCT_MEDIA_PATH}proxy/${filename}`
        } catch (e) {
                console.warn(
                        `[ig-product] image proxy failed for ${safe.slice(0, 140)}: ${(e as Error).message} ` +
                                (localCacheFallback
                                        ? '— using the legacy local cache'
                                        : '— falling back to the direct URL (Meta may not be able to fetch it)'),
                )
                return localCacheFallback ?? safe
        }
}

/** Build the absolute /me/messages URL for the configured Graph version. */
function messagesUrl(): string {
        return `${GRAPH_BASE}/me/messages`
}

/** The 24h messaging window tag for replies to user-initiated messages. */
const MESSAGING_TYPE_RESPONSE = 'RESPONSE'

interface MetaErrorBody {
        error?: {
                message?: string
                code?: number
                type?: string
                fbtrace_id?: string
        }
}

/** Throw a uniform, code-tagged error for a non-2xx Graph API response. */
async function throwIfError(res: Response, context: string, mediaUrl?: string): Promise<void> {
        if (res.ok) return
        const detail = await res.text().catch(() => '')
        let parsed: MetaErrorBody | null = null
        try {
                parsed = JSON.parse(detail) as MetaErrorBody
        } catch {
                /* not JSON */
        }
        const code = parsed?.error?.code ?? res.status
        const message = parsed?.error?.message ?? detail

        // Add actionable hints for the most common failure modes.
        let hint = ''
        if (code === 100 && /upload failed/i.test(message)) {
                // Context-specific hints — the same "Upload failed" error means
                // different things for images vs audio.
                if (context === 'sendAudio') {
                        hint =
                                ' [راه‌حل: متا نتوانست فایل صوتی را پردازش کند. ' +
                                'Instagram فقط AAC (m4a), MP3, OGG, WAV قبول می‌کند. ' +
                                'اگر فایل m4a هست ولی codec آن Opus است (نه AAC)، متا رد می‌کند. ' +
                                'ffmpeg باید با `-c:a aac` تبدیل کند (نه `-c copy`). ' +
                                'برای تست: `ffprobe file.m4a` — codec_name باید aac باشد.]'
                } else if (context === 'sendVideo') {
                        hint =
                                ' [راه‌حل: متا نتوانست ویدیو را پردازش کند. ' +
                                'Instagram فقط MP4 (H.264 + AAC) قبول می‌کند. ' +
                                'حداکثر حجم ۲۵ مگابایت.]'
                } else {
                        hint =
                                ' [راه‌حل: کرالر متا نتوانست فایل را از URL دانلود کند. ' +
                                'مطمئن شوید URL به‌صورت عمومی و از طریق HTTPS در دسترس است. ' +
                                'حداکثر حجم عکس ۸ مگابایت است و فقط فرمت‌های JPEG/PNG/GIF/WebP پشتیبانی می‌شوند.]'
                }
        } else if (code === 10 || /permission/i.test(message)) {
                hint =
                        ' [راه‌حل: توکن دسترسی لازم را ندارد. اپ باید App Review بگیرد برای instagram_manage_messages.]'
        } else if (code === 613) {
                hint =
                        ' [راه‌حل: اکانت اینستاگرام قابلیت پاسخ‌دهی از طریق API را ندارد — Business/Creator باشد.]'
        }

        throw new Error(
                `INSTAGRAM ${context} failed (${res.status}, code=${code}): ${message}${hint}` +
                        (mediaUrl ? ` [URL: ${mediaUrl}]` : ''),
        )
}

/**
 * Pre-flight check: fetch the media URL server-side to verify it's publicly
 * accessible and returns the expected content-type BEFORE sending it to Meta.
 *
 * Meta's crawler fetches media URLs server-side. When it fails, Meta returns
 * an opaque `code=100, Upload failed` error with no detail. This pre-flight
 * check surfaces the REAL problem (404, wrong content-type, too large, etc.)
 * in our error log so the operator can fix it without guessing.
 *
 * Throws a clear, actionable error when the URL is not fetchable.
 */
interface PreparedMedia {
        body: Buffer
        contentType: string
}

async function preflightMedia(
        url: string,
        kind: 'IMAGE' | 'AUDIO' | 'VIDEO',
): Promise<PreparedMedia> {
        const kindLabel = kind.toLowerCase()
        const maxBytes =
                kind === 'IMAGE'
                        ? 8 * 1024 * 1024
                        : kind === 'AUDIO'
                          ? 8 * 1024 * 1024
                          : 25 * 1024 * 1024
        const allowedPrefixes =
                kind === 'IMAGE' ? ['image/'] : kind === 'AUDIO' ? ['audio/'] : ['video/']

        const parsedUrl = new URL(url)
        if (parsedUrl.protocol !== 'https:') {
                throw new Error(`${kindLabel} URL must use HTTPS`)
        }

        console.log(`[ig-preflight] ${kind} → GET ${url}`)
        try {
                // Resolve and pin a public address for every redirect. This blocks
                // tenant-controlled media URLs from reaching metadata/private hosts.
                const res = await safeHttpGet(url, {
                        timeoutMs: 15_000,
                        maxBytes,
                        maxRedirects: 3,
                        allowedContentTypes: allowedPrefixes,
                })
                if (res.status < 200 || res.status >= 300) {
                        throw new Error(
                                `URL returned HTTP ${res.status}. ` +
                                        `Meta's crawler will not be able to fetch this ${kindLabel}. ` +
                                        `Make sure the URL is publicly accessible over HTTPS without auth.`,
                        )
                }
                const ct = String(res.headers['content-type'] ?? '')
                const cl = res.body.byteLength
                console.log(
                        `[ig-preflight] ${kind} → ${res.status} content-type="${ct}" content-length=${cl}`,
                )
                // Audio-specific format check: Instagram only accepts AAC (m4a),
                // MP3, OGG, and WAV for audio attachments. WebM/Opus (the default
                // output of MediaRecorder in Chrome) is NOT accepted — Meta will
                // return "Upload failed" even though the URL is reachable.
                if (kind === 'AUDIO' && ct.includes('webm')) {
                        throw new Error(
                                `Audio file is WebM ("${ct}") — Instagram only accepts AAC (m4a), MP3, OGG, WAV. ` +
                                        `Meta will reject it. The voice recorder should use audio/mp4; if the browser ` +
                                        `doesn't support it, server-side transcoding (webm → m4a via ffmpeg) is required.`,
                        )
                }
                return { body: res.body, contentType: ct }
        } catch (e) {
                // Network error (DNS, timeout, SSL) — Meta will definitely fail too.
                throw new Error(
                        `Pre-flight fetch of ${kindLabel} URL failed: ${(e as Error).message}. ` +
                                `Meta's crawler cannot reach this URL. [URL: ${url}]`,
                )
        }
}

/**
 * Upload a media file (image/video/audio) to Meta's `/me/message_attachments`
 * endpoint using the two-step flow. Downloads the file from the URL, uploads
 * it as multipart `filedata`, and returns the `attachment_id`.
 *
 * This is the MOST RELIABLE method — Meta doesn't need to fetch the URL itself
 * (which was failing for audio due to moov atom issues). Works for all media
 * types: image, video, audio.
 *
 * Returns null on failure (caller falls back to URL payload).
 */
async function uploadMediaAttachment(
        token: string,
        mediaUrl: string,
        type: 'image' | 'video' | 'audio',
        prepared: PreparedMedia,
): Promise<string | null> {
        const mediaBuf = prepared.body
        if (mediaBuf.byteLength === 0) return null
        console.log(`[ig-media] downloaded ${mediaBuf.byteLength} bytes from ${mediaUrl}`)

        // Derive the multipart filename from the trusted response MIME, never
        // from attacker-controlled URL text (which could inject headers).
        const normalizedMime = prepared.contentType.split(';', 1)[0].trim().toLowerCase()
        const mimeToExt: Record<string, string> = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/avif': 'avif',
                'audio/mp4': 'm4a',
                'audio/mpeg': 'mp3',
                'audio/wav': 'wav',
                'audio/ogg': 'ogg',
                'audio/aac': 'aac',
                'video/mp4': 'mp4',
                'video/quicktime': 'mov',
                'video/webm': 'webm',
        }
        const ext =
                mimeToExt[normalizedMime] ??
                (type === 'image' ? 'jpg' : type === 'audio' ? 'm4a' : 'mp4')
        const mime =
                normalizedMime ||
                (type === 'image' ? 'image/jpeg' : type === 'audio' ? 'audio/mp4' : 'video/mp4')
        const filename = `media.${ext}`

        // Build multipart/form-data: message field + filedata field.
        const boundary = `----vignet${Date.now()}`
        const messageJson = JSON.stringify({
                attachment: { type, payload: { is_reusable: true } },
        })
        const body = Buffer.concat([
                Buffer.from(`--${boundary}\r\n`),
                Buffer.from(`Content-Disposition: form-data; name="message"\r\n\r\n`),
                Buffer.from(`${messageJson}\r\n`),
                Buffer.from(`--${boundary}\r\n`),
                Buffer.from(
                        `Content-Disposition: form-data; name="filedata"; filename="${filename}"\r\n`,
                ),
                Buffer.from(`Content-Type: ${mime}\r\n\r\n`),
                mediaBuf,
                Buffer.from(`\r\n--${boundary}--\r\n`),
        ])

        try {
                const res = await fetch(
                        `https://graph.instagram.com/v21.0/me/message_attachments`,
                        {
                                method: 'POST',
                                headers: {
                                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                                        Authorization: `Bearer ${token}`,
                                },
                                body,
                        },
                )
                const text = await res.text().catch(() => '')
                if (!res.ok) {
                        console.warn(
                                `[ig-media] message_attachments failed (${res.status}): ${text.slice(0, 300)}`,
                        )
                        return null
                }
                const json = JSON.parse(text) as { attachment_id?: string }
                console.log(`[ig-media] ✓ uploaded ${type}, attachment_id=${json.attachment_id}`)
                return json.attachment_id ?? null
        } catch (e) {
                console.warn(`[ig-media] message_attachments error: ${(e as Error).message}`)
                return null
        }
}

/**
 * Send a media message (image/video/audio) using the two-step flow:
 *   1. Upload to /me/message_attachments → get attachment_id
 *   2. Send /me/messages with attachment_id
 *
 * Falls back to URL payload if the upload fails.
 * This is the shared implementation used by sendImage, sendVideo, sendAudio.
 */
async function sendMediaTwoStep(
        token: string,
        chatId: string,
        mediaUrl: string,
        type: 'image' | 'video' | 'audio',
        prepared: PreparedMedia,
        caption?: string,
): Promise<void> {
        // Strategy 1: Two-step (upload → attachment_id → send)
        const attachmentId = await uploadMediaAttachment(token, mediaUrl, type, prepared)
        if (attachmentId) {
                const message: Record<string, unknown> = {
                        attachment: {
                                type,
                                payload: { attachment_id: attachmentId },
                        },
                }
                if (caption && type === 'image') message.text = caption

                const res = await fetch(messagesUrl(), {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                                recipient: igRecipient(chatId),
                                message,
                                messaging_type: MESSAGING_TYPE_RESPONSE,
                        }),
                })
                if (res.ok) {
                        console.log(`[ig-media] ✓ two-step ${type} send succeeded`)
                        return
                }
                const errText = await res.text().catch(() => '')
                console.warn(
                        `[ig-media] two-step send failed (${res.status}): ${errText.slice(0, 300)} — falling back to URL`,
                )
        }

        // Strategy 2: URL payload (fallback)
        console.log(`[ig-media] falling back to URL payload for ${type}`)
        const message: Record<string, unknown> = {
                attachment: {
                        type,
                        payload: { url: mediaUrl, is_reusable: false },
                },
        }
        if (caption && type === 'image') message.text = caption

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: igRecipient(chatId),
                        message,
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        await throwIfError(res, `send${type.charAt(0).toUpperCase()}${type.slice(1)}`, mediaUrl)
}

/**
 * Send an image attachment. Uses the two-step flow (upload → attachment_id → send)
 * for reliability, falling back to URL payload if the upload fails.
 */
export async function sendImage(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        imageUrl: string,
        caption?: string,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendImage: missing access token')

        const prepared = await preflightMedia(imageUrl, 'IMAGE')
        await sendMediaTwoStep(token, chatId, imageUrl, 'image', prepared, caption)
}

/**
 * Send an audio attachment (voice note). Uses the two-step flow
 * (upload → attachment_id → send) for reliability, falling back to URL payload.
 */
export async function sendAudio(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        audioUrl: string,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendAudio: missing access token')

        const prepared = await preflightMedia(audioUrl, 'AUDIO')
        await sendMediaTwoStep(token, chatId, audioUrl, 'audio', prepared)
}

/**
 * Send a video attachment. Uses the two-step flow (upload → attachment_id → send)
 * for reliability, falling back to URL payload.
 */
export async function sendVideo(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        videoUrl: string,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendVideo: missing access token')

        const prepared = await preflightMedia(videoUrl, 'VIDEO')
        await sendMediaTwoStep(token, chatId, videoUrl, 'video', prepared)
}

/**
 * Send a generic-template "product card" — image, title, subtitle (price),
 * and a single button labelled "مشاهده محصول" (View product). The button URL
 * is `product.productUrl` (falls back to `product.imageUrl`).
 *
 * Used by the `PRODUCT` rich reply mode in automation scenarios.
 *
 * The subtitle is sanitized via `cleanDescriptionForChat()` so HTML from
 * WooCommerce product descriptions (e.g. `<ul><li>…</li></ul>` blocks) is
 * stripped to plain text — Meta's Generic Template `subtitle` field does not
 * support HTML and would otherwise render the raw tags.
 */
export async function sendProductCard(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        product: ProductShowcase,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendProductCard: missing access token')

        console.log(
                `[ig-product] sending product card: id=${product.id} name="${product.name}" image=${product.imageUrl ? 'yes' : 'no'} price=${product.price ?? 'n/a'}`,
        )

        const cleanDesc = cleanDescriptionForChat(product.description, 80)
        const subtitle = cleanDesc
                ? product.price != null
                        ? `${cleanDesc} — ${formatPrice(product.price)}`
                        : cleanDesc
                : product.price != null
                  ? formatPrice(product.price)
                  : 'محصول'

        // v3.3: Meta-safe + crawler-reachable URL — external images are proxied
        // through our own origin because Meta's crawler gets 403 from many
        // WooCommerce hosts (hotlink protection) even when our server can fetch
        // the same URL fine.
        const safeImageUrl = product.imageUrl ? await templateImageUrl(product.imageUrl) : null
        const buttonUrl = product.productUrl
                ? metaSafeUrl(product.productUrl)
                : (safeImageUrl ?? undefined)

        const buttons: Array<Record<string, unknown>> = []
        if (buttonUrl) {
                buttons.push({
                        type: 'web_url',
                        url: buttonUrl,
                        title: 'مشاهده محصول',
                })
        } else {
                buttons.push({
                        type: 'postback',
                        title: 'مشاهده محصول',
                        payload: `product:${product.id}`,
                })
        }

        const element: Record<string, unknown> = {
                title: product.name.slice(0, 80),
                subtitle: subtitle.slice(0, 80),
                buttons,
        }
        // image_url is optional in Generic Template but Meta sometimes rejects
        // elements without it. Only set it when we actually have a URL.
        if (safeImageUrl) {
                element.image_url = safeImageUrl
        }

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: igRecipient(chatId),
                        message: {
                                attachment: {
                                        type: 'template',
                                        payload: {
                                                template_type: 'generic',
                                                elements: [element],
                                        },
                                },
                        },
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        if (!res.ok) {
                const errText = await res.text().catch(() => '')
                console.warn(
                        `[ig-product] sendProductCard failed (${res.status}): ${errText.slice(0, 300)}`,
                )
        }
        await throwIfError(res, 'sendProductCard')
}

/**
 * Send a generic-template "carousel" of product cards — up to 10 elements
 * scrollable horizontally in the Instagram DM. Each element has its own image,
 * title, subtitle, and a "مشاهده محصول" button (web_url when `productUrl` is
 * set, otherwise a postback fallback).
 *
 * Meta's Generic Template Carousel limit is 10 elements; this function slices
 * the input to that limit. Callers (e.g. `resolveProducts`) already cap, but
 * this is a defensive guard so a future caller can't blow past the limit.
 *
 * Subtitles are sanitized with `cleanDescriptionForChat()` for the same reason
 * as `sendProductCard` — Meta does not render HTML inside template subtitles.
 */
export async function sendProductCarousel(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        products: ProductShowcase[],
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendProductCarousel: missing access token')

        if (products.length === 0) {
                console.warn('[ig-product] sendProductCarousel called with empty list — skipping')
                return
        }

        const elements = await Promise.all(
                products.slice(0, 10).map(async (product) => {
                        const cleanDesc = cleanDescriptionForChat(product.description, 80)
                        const subtitle = cleanDesc
                                ? product.price != null
                                        ? `${cleanDesc} — ${formatPrice(product.price)}`
                                        : cleanDesc
                                : product.price != null
                                  ? formatPrice(product.price)
                                  : 'محصول'

                        // v3.3: Meta-safe + crawler-reachable URLs — external images are
                        // proxied through our own origin (many shop hosts 403 Meta's
                        // crawler); percent-encode Persian paths for the rest.
                        const safeImageUrl = product.imageUrl
                                ? await templateImageUrl(product.imageUrl)
                                : null
                        const buttonUrl = product.productUrl
                                ? metaSafeUrl(product.productUrl)
                                : (safeImageUrl ?? undefined)

                        const buttons: Array<Record<string, unknown>> = []
                        if (buttonUrl) {
                                buttons.push({
                                        type: 'web_url',
                                        url: buttonUrl,
                                        title: 'مشاهده محصول',
                                })
                        } else {
                                buttons.push({
                                        type: 'postback',
                                        title: 'مشاهده محصول',
                                        payload: `product:${product.id}`,
                                })
                        }

                        const element: Record<string, unknown> = {
                                title: product.name.slice(0, 80),
                                subtitle: subtitle.slice(0, 80),
                                buttons,
                        }
                        if (safeImageUrl) {
                                element.image_url = safeImageUrl
                        }
                        return element
                }),
        )

        console.log(`[ig-product] sending product carousel: count=${elements.length}`)

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: igRecipient(chatId),
                        message: {
                                attachment: {
                                        type: 'template',
                                        payload: {
                                                template_type: 'generic',
                                                elements,
                                        },
                                },
                        },
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        if (!res.ok) {
                const errText = await res.text().catch(() => '')
                console.warn(
                        `[ig-product] sendProductCarousel failed (${res.status}): ${errText.slice(0, 300)}`,
                )
        }
        await throwIfError(res, 'sendProductCarousel')
}

/**
 * Send a button-template message — a text body with up to 3 tappable buttons
 * below it. Buttons can be `web_url` (open a URL) or `postback` (send a
 * payload back as a message). Instagram limits button templates to 3 buttons.
 */
export async function sendButtonMessage(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        text: string,
        buttons: ButtonAction[],
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendButtonMessage: missing access token')
        if (!buttons.length) throw new Error('INSTAGRAM sendButtonMessage: no buttons provided')

        const sanitizedButtons = buttons.slice(0, 3).map((b) => {
                const title = (b.title ?? '').trim().slice(0, 20) || 'انتخاب'
                if (b.url) {
                        return { type: 'web_url', url: b.url, title }
                }
                return {
                        type: 'postback',
                        title,
                        payload: b.payload ?? `btn:${title}`,
                }
        })

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: igRecipient(chatId),
                        message: {
                                attachment: {
                                        type: 'template',
                                        payload: {
                                                template_type: 'button',
                                                text: text.slice(0, 640),
                                                buttons: sanitizedButtons,
                                        },
                                },
                        },
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        await throwIfError(res, 'sendButtonMessage')
}

/**
 * Send a single rich reply described by the `messages[]` entries on a
 * `MULTI_MESSAGE` automation action. Each entry has a `type`:
 *
 *   TEXT        — send `text` via the adapter's sendText
 *   IMAGE       — send `mediaUrl` as image with optional `text` caption
 *   AUDIO       — send `mediaUrl` as audio
 *   VIDEO       — send `mediaUrl` as video
 *   QUICK_REPLY — send `text` as a button template with `buttons` (object form
 *                 {title, url?} or legacy plain strings)
 *   PRODUCT     — look up the product (via `productId`) and send a showcase card
 *
 * Failures on individual entries are captured (not thrown) so a multi-part
 * reply partially delivers when one attachment is bad.
 */
export async function sendRichEntry(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        entry: {
                type:
                        | 'TEXT'
                        | 'IMAGE'
                        | 'AUDIO'
                        | 'VIDEO'
                        | 'QUICK_REPLY'
                        | 'PRODUCT'
                        | 'PRODUCT_LIST'
                text?: string
                mediaUrl?: string
                productId?: string
                productIds?: string[]
                buttons?: Array<{ title: string; url?: string } | string>
                buttonType?: 'button' | 'quick_reply'
        },
        /** Called for TEXT entries (which need the adapter's quick-reply support). */
        sendText: (chatId: string, text: string) => Promise<void>,
        /** Called for PRODUCT entries — the caller resolves the product snapshot. */
        resolveProduct?: (productId: string) => Promise<ProductShowcase | null>,
        /** Called for PRODUCT_LIST entries — the caller resolves a list of product
         *  snapshots. Falls back to calling `resolveProduct` for each id when this
         *  is not provided, so callers that already have a batched lookup can pass
         *  it for efficiency, and callers that don't don't have to. */
        resolveProducts?: (productIds: string[]) => Promise<ProductShowcase[]>,
        workspaceId?: string,
): Promise<void> {
        try {
                switch (entry.type) {
                        case 'TEXT':
                                if (entry.text) await sendText(chatId, entry.text)
                                break
                        case 'IMAGE':
                                if (entry.mediaUrl) {
                                        assertPublicHttps(entry.mediaUrl, 'IMAGE')
                                        await sendImage(
                                                channelConfig,
                                                chatId,
                                                entry.mediaUrl,
                                                entry.text,
                                        )
                                }
                                break
                        case 'AUDIO':
                                if (entry.mediaUrl) {
                                        assertPublicHttps(entry.mediaUrl, 'AUDIO')
                                        await sendAudio(channelConfig, chatId, entry.mediaUrl)
                                }
                                break
                        case 'VIDEO':
                                if (entry.mediaUrl) {
                                        assertPublicHttps(entry.mediaUrl, 'VIDEO')
                                        await sendVideo(channelConfig, chatId, entry.mediaUrl)
                                }
                                break
                        case 'QUICK_REPLY': {
                                const buttons = (entry.buttons ?? [])
                                        .slice(0, 3)
                                        .map((b) =>
                                                typeof b === 'string'
                                                        ? { title: b }
                                                        : { title: b.title, url: b.url },
                                        )
                                if (buttons.length) {
                                        if (entry.buttonType === 'quick_reply') {
                                                // Quick Reply chips — send as text + quick_replies.
                                                await sendText(chatId, entry.text || '')
                                        } else {
                                                // Button Template — inside the bubble (default).
                                                await sendButtonMessage(
                                                        channelConfig,
                                                        chatId,
                                                        entry.text || '',
                                                        buttons,
                                                )
                                        }
                                } else if (entry.text) {
                                        await sendText(chatId, entry.text)
                                }
                                break
                        }
                        case 'PRODUCT': {
                                if (!entry.productId || !resolveProduct) return
                                const product = await resolveProduct(entry.productId)
                                if (product) await sendProductCard(channelConfig, chatId, product)
                                break
                        }
                        case 'PRODUCT_LIST': {
                                const ids = (entry.productIds ?? []).filter(Boolean)
                                if (ids.length === 0) return
                                // Prefer the batched resolver when available — the automation
                                // engine passes `resolveProducts` to skip N+1 agent lookups.
                                const products = resolveProducts
                                        ? await resolveProducts(ids)
                                        : (
                                                  await Promise.all(
                                                          ids
                                                                  .slice(0, 10)
                                                                  .map(
                                                                          (id) =>
                                                                                  resolveProduct?.(
                                                                                          id,
                                                                                  ).catch(
                                                                                          () =>
                                                                                                  null,
                                                                                  ) ??
                                                                                  Promise.resolve(
                                                                                          null,
                                                                                  ),
                                                                  ),
                                                  )
                                          ).filter((p): p is ProductShowcase => p != null)
                                if (products.length === 0) return
                                if (products.length === 1) {
                                        // One product — send as a single card (smaller payload,
                                        // avoids the carousel chrome for the trivial case).
                                        await sendProductCard(channelConfig, chatId, products[0])
                                } else {
                                        await sendProductCarousel(channelConfig, chatId, products)
                                }
                                break
                        }
                }
        } catch (e) {
                // Surface media-send failures to the operator via the error log with
                // the offending URL so "media not sent to user" is debuggable.
                // We capture (not re-throw) so a multi-part reply still partially
                // delivers when one attachment is bad.
                captureError('instagram:media:sendRichEntry', e, {
                        workspaceId,
                        metadata: { chatId, entryType: entry.type, mediaUrl: entry.mediaUrl },
                })
        }
}

/**
 * Guard: Instagram's Graph API fetches media URLs server-side, so the URL must
 * be publicly reachable over HTTPS. Loopback (127.0.0.1/localhost) and non-HTTPS
 * URLs will be silently dropped by Meta. We throw a clear error so the operator
 * sees the root cause in /admin/errors instead of a mysterious "nothing sent".
 */
function assertPublicHttps(url: string, kind: string): void {
        let parsed: URL
        try {
                parsed = new URL(url)
        } catch {
                throw new Error(`[${kind}] media URL is not a valid URL: ${url}`)
        }
        if (parsed.protocol !== 'https:') {
                throw new Error(
                        `[${kind}] media URL must be HTTPS (Meta fetches it server-side). Got: ${url}. ` +
                                `Set S3_PUBLIC_URL to a public HTTPS endpoint in your .env.`,
                )
        }
        const host = parsed.hostname
        if (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0') {
                throw new Error(
                        `[${kind}] media URL is loopback (${host}) — Meta cannot reach it. ` +
                                `Set S3_PUBLIC_URL to a public HTTPS endpoint in your .env.`,
                )
        }
}

/** Format a numeric price with the Persian Toman suffix (matching Vardast). */
function formatPrice(price: number): string {
        // Use the Persian-grouped representation when available.
        try {
                return new Intl.NumberFormat('fa-IR').format(price) + ' تومان'
        } catch {
                return `${price} تومان`
        }
}
