import type { Prisma } from '@prisma/client'
import { readPageToken } from '@/lib/instagram/config'
import { GRAPH_BASE } from '@/lib/instagram/oauth'
import { captureError } from '@/lib/errors/capture'

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
async function throwIfError(
        res: Response,
        context: string,
        mediaUrl?: string,
): Promise<void> {
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
                hint = ' [راه‌حل: اکانت اینستاگرام قابلیت پاسخ‌دهی از طریق API را ندارد — Business/Creator باشد.]'
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
async function preflightMedia(
        url: string,
        kind: 'IMAGE' | 'AUDIO' | 'VIDEO',
): Promise<void> {
        const kindLabel = kind.toLowerCase()
        const maxBytes =
                kind === 'IMAGE' ? 8 * 1024 * 1024 : kind === 'AUDIO' ? 8 * 1024 * 1024 : 25 * 1024 * 1024
        const allowedPrefixes =
                kind === 'IMAGE'
                        ? ['image/']
                        : kind === 'AUDIO'
                                ? ['audio/']
                                : ['video/']

        console.log(`[ig-preflight] ${kind} → HEAD ${url}`)
        try {
                // HEAD first (cheap) — some servers don't support HEAD, so fall back to GET.
                let res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
                if (res.status === 405 || res.status === 501) {
                        console.log(`[ig-preflight] HEAD not supported (${res.status}), trying GET`)
                        res = await fetch(url, { redirect: 'follow' })
                }
                if (!res.ok) {
                        throw new Error(
                                `URL returned HTTP ${res.status} ${res.statusText}. ` +
                                        `Meta's crawler will not be able to fetch this ${kindLabel}. ` +
                                        `Make sure the URL is publicly accessible over HTTPS without auth.`,
                        )
                }
                const ct = res.headers.get('content-type') || ''
                const cl = Number(res.headers.get('content-length') || 0)
                console.log(
                        `[ig-preflight] ${kind} → ${res.status} content-type="${ct}" content-length=${cl}`,
                )
                if (ct && !allowedPrefixes.some((p) => ct.startsWith(p))) {
                        throw new Error(
                                `URL returned content-type "${ct}" but expected ${allowedPrefixes.join('/')}. ` +
                                        `Meta will reject this ${kindLabel}. Check the file extension / upload route.`,
                        )
                }
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
                if (cl > 0 && cl > maxBytes) {
                        throw new Error(
                                `File is ${(cl / 1024 / 1024).toFixed(2)} MB — max for ${kindLabel} is ${maxBytes / 1024 / 1024} MB. ` +
                                        `Meta will reject it.`,
                        )
                }
        } catch (e) {
                // Network error (DNS, timeout, SSL) — Meta will definitely fail too.
                throw new Error(
                        `Pre-flight fetch of ${kindLabel} URL failed: ${(e as Error).message}. ` +
                                `Meta's crawler cannot reach this URL. [URL: ${url}]`,
                )
        }
}

/**
 * Send an image attachment. The URL must be HTTPS-reachable by Meta's crawler.
 * Caption is optional and ships as the `text` field next to the attachment.
 */
export async function sendImage(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        imageUrl: string,
        caption?: string,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendImage: missing access token')

        // Pre-flight: verify the URL is fetchable before Meta's crawler tries.
        // This turns Meta's opaque "code=100, Upload failed" into a clear error.
        await preflightMedia(imageUrl, 'IMAGE')

        const message: Record<string, unknown> = {
                attachment: {
                        type: 'image',
                        payload: { url: imageUrl, is_reusable: false },
                },
        }
        if (caption) message.text = caption

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: { id: chatId },
                        message,
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        await throwIfError(res, 'sendImage', imageUrl)
}

/**
 * Send an audio attachment (voice note).
 *
 * THREE strategies, tried in order. Each is a different way to get the audio
 * bytes to Meta — we try the most reliable first.
 *
 * 1. **Two-step message_attachments** (RECOMMENDED) — upload the file to
 *    `/me/message_attachments` as multipart (filedata), get an `attachment_id`
 *    back, then send a normal JSON message referencing that id. This is Meta's
 *    official two-step flow and the most reliable for audio.
 *
 * 2. **Direct filedata in /me/messages** — POST recipient + message + filedata
 *    as THREE separate flat form fields (NOT nested). Falls back here if the
 *    two-step flow fails.
 *
 * 3. **URL payload** — send just the URL and let Meta's crawler fetch it.
 *    Last resort (requires the URL to be publicly fetchable + correct moov atom).
 *
 * The audio file must be AAC (m4a) or WAV. MP3 and Opus-in-mp4 are rejected.
 */
export async function sendAudio(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        audioUrl: string,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendAudio: missing access token')

        // Pre-flight: verify the URL is reachable + correct content-type.
        await preflightMedia(audioUrl, 'AUDIO')

        // Download the audio file once — all three strategies need the bytes
        // (strategies 1+2) or at least benefit from confirming the URL works.
        let audioBuf: Buffer | null = null
        try {
                const fileRes = await fetch(audioUrl, { redirect: 'follow' })
                if (fileRes.ok) {
                        audioBuf = Buffer.from(await fileRes.arrayBuffer())
                        console.log(`[ig-audio] downloaded ${audioBuf.byteLength} bytes from ${audioUrl}`)
                }
        } catch (e) {
                console.warn(`[ig-audio] download failed: ${(e as Error).message}`)
        }

        const ext = audioUrl.split('.').pop()?.toLowerCase() ?? 'm4a'
        const mime =
                ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4'

        // ── Strategy 1: Two-step message_attachments (RECOMMENDED) ──
        if (audioBuf && audioBuf.byteLength > 0) {
                try {
                        // Step 1: upload to /me/message_attachments → get attachment_id
                        const attachmentId = await uploadAttachment(token, audioBuf, mime, ext)
                        if (attachmentId) {
                                console.log(`[ig-audio] ✓ uploaded, attachment_id=${attachmentId}`)
                                // Step 2: send message referencing the attachment_id
                                const res = await fetch(messagesUrl(), {
                                        method: 'POST',
                                        headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({
                                                recipient: { id: chatId },
                                                message: {
                                                        attachment: {
                                                                type: 'audio',
                                                                payload: { attachment_id: attachmentId },
                                                        },
                                                },
                                                messaging_type: MESSAGING_TYPE_RESPONSE,
                                        }),
                                })
                                if (res.ok) {
                                        console.log('[ig-audio] ✓ two-step send succeeded')
                                        return
                                }
                                const errText = await res.text().catch(() => '')
                                console.warn(
                                        `[ig-audio] two-step send failed (${res.status}): ${errText.slice(0, 300)}`,
                                )
                        }
                } catch (e) {
                        console.warn(`[ig-audio] two-step flow failed: ${(e as Error).message}`)
                }
        }

        // ── Strategy 2: Direct filedata in /me/messages (flat fields) ──
        if (audioBuf && audioBuf.byteLength > 0) {
                try {
                        console.log('[ig-audio] trying direct filedata (flat fields)')
                        const ok = await sendDirectFiledata(token, chatId, audioBuf, mime, ext)
                        if (ok) {
                                console.log('[ig-audio] ✓ direct filedata succeeded')
                                return
                        }
                } catch (e) {
                        console.warn(`[ig-audio] direct filedata failed: ${(e as Error).message}`)
                }
        }

        // ── Strategy 3: URL payload (last resort) ──
        console.log(`[ig-audio] falling back to URL payload → ${audioUrl}`)
        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: { id: chatId },
                        message: {
                                attachment: {
                                        type: 'audio',
                                        payload: { url: audioUrl, is_reusable: false },
                                },
                        },
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        await throwIfError(res, 'sendAudio', audioUrl)
}

/**
 * Step 1 of the two-step flow: upload audio to /me/message_attachments.
 * Returns the attachment_id, or null on failure.
 */
async function uploadAttachment(
        token: string,
        audioBuf: Buffer,
        mime: string,
        ext: string,
): Promise<string | null> {
        const boundary = `----vignet${Date.now()}`
        const filename = `voice.${ext}`
        // The `message` field contains ONLY the attachment type + is_reusable.
        // NOT recipient/messaging_type — those are NOT part of message_attachments.
        const messageJson = JSON.stringify({
                attachment: {
                        type: 'audio',
                        payload: { is_reusable: true },
                },
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
                audioBuf,
                Buffer.from(`\r\n--${boundary}--\r\n`),
        ])
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
                        `[ig-audio] message_attachments upload failed (${res.status}): ${text.slice(0, 300)}`,
                )
                return null
        }
        try {
                const json = JSON.parse(text) as { attachment_id?: string }
                return json.attachment_id ?? null
        } catch {
                return null
        }
}

/**
 * Strategy 2: send recipient + message + filedata as THREE separate flat
 * form fields (NOT nested in one `message` object).
 */
async function sendDirectFiledata(
        token: string,
        chatId: string,
        audioBuf: Buffer,
        mime: string,
        ext: string,
): Promise<boolean> {
        const boundary = `----vignet${Date.now()}`
        const filename = `voice.${ext}`
        // Each field is a SEPARATE top-level form field — NOT nested.
        const recipientJson = JSON.stringify({ id: chatId })
        const messageJson = JSON.stringify({
                attachment: {
                        type: 'audio',
                        payload: { is_reusable: false },
                },
        })
        const body = Buffer.concat([
                // recipient (flat)
                Buffer.from(`--${boundary}\r\n`),
                Buffer.from(`Content-Disposition: form-data; name="recipient"\r\n\r\n`),
                Buffer.from(`${recipientJson}\r\n`),
                // message (flat — only attachment, no recipient/messaging_type inside)
                Buffer.from(`--${boundary}\r\n`),
                Buffer.from(`Content-Disposition: form-data; name="message"\r\n\r\n`),
                Buffer.from(`${messageJson}\r\n`),
                // filedata (the actual audio file)
                Buffer.from(`--${boundary}\r\n`),
                Buffer.from(
                        `Content-Disposition: form-data; name="filedata"; filename="${filename}"\r\n`,
                ),
                Buffer.from(`Content-Type: ${mime}\r\n\r\n`),
                audioBuf,
                Buffer.from(`\r\n--${boundary}--\r\n`),
        ])
        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        Authorization: `Bearer ${token}`,
                },
                body,
        })
        if (res.ok) return true
        const errText = await res.text().catch(() => '')
        console.warn(
                `[ig-audio] direct filedata failed (${res.status}): ${errText.slice(0, 300)}`,
        )
        return false
}

/** Send a video attachment (mp4 recommended, max 25 MB). */
export async function sendVideo(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        videoUrl: string,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendVideo: missing access token')

        await preflightMedia(videoUrl, 'VIDEO')

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: { id: chatId },
                        message: {
                                attachment: {
                                        type: 'video',
                                        payload: { url: videoUrl, is_reusable: false },
                                },
                        },
                        messaging_type: MESSAGING_TYPE_RESPONSE,
                }),
        })
        await throwIfError(res, 'sendVideo', videoUrl)
}

/**
 * Send a generic-template "product card" — image, title, subtitle (price),
 * and a single button labelled "مشاهده محصول" (View product). The button URL
 * is `product.productUrl` (falls back to `product.imageUrl`).
 *
 * Used by the `PRODUCT` rich reply mode in automation scenarios.
 */
export async function sendProductCard(
        channelConfig: Prisma.JsonValue,
        chatId: string,
        product: ProductShowcase,
): Promise<void> {
        const token = resolveToken(channelConfig)
        if (!token) throw new Error('INSTAGRAM sendProductCard: missing access token')

        const subtitle = product.description
                ? product.price != null
                        ? `${product.description} — ${formatPrice(product.price)}`
                        : product.description
                : product.price != null
                        ? formatPrice(product.price)
                        : undefined

        const buttonUrl =
                product.productUrl ?? product.imageUrl ?? undefined

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
                buttons,
        }
        if (product.imageUrl) element.image_url = product.imageUrl
        if (subtitle) element.subtitle = subtitle.slice(0, 80)

        const res = await fetch(messagesUrl(), {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                        recipient: { id: chatId },
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
        await throwIfError(res, 'sendProductCard')
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
        if (!token)
                throw new Error('INSTAGRAM sendButtonMessage: missing access token')
        if (!buttons.length)
                throw new Error('INSTAGRAM sendButtonMessage: no buttons provided')

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
                        recipient: { id: chatId },
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
                type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT'
                text?: string
                mediaUrl?: string
                productId?: string
                buttons?: Array<{ title: string; url?: string } | string>
        },
        /** Called for TEXT entries (which need the adapter's quick-reply support). */
        sendText: (chatId: string, text: string) => Promise<void>,
        /** Called for PRODUCT entries — the caller resolves the product snapshot. */
        resolveProduct?: (
                productId: string,
        ) => Promise<ProductShowcase | null>,
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
                                        await sendImage(channelConfig, chatId, entry.mediaUrl, entry.text)
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
                                        await sendButtonMessage(channelConfig, chatId, entry.text || '', buttons)
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
