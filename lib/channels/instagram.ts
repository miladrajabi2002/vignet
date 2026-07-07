import type { InboundMessage, MessengerAdapter, SendOptions } from '@/lib/channels/types'
import { GRAPH_BASE } from '@/lib/channels/whatsapp'

/**
 * Instagram Messaging adapter (Meta Graph APIs).
 *
 * Instagram access tokens come in two, host-incompatible flavors — both are
 * accepted here:
 *
 *  1. Page Access Token (graph.facebook.com) — issued from a Facebook Page that
 *     is linked to the Instagram professional account. This is the "full"
 *     token: it can both send/receive DMs (Messenger Platform /me/messages) AND
 *     reply publicly to post/reel comments.
 *
 *  2. Instagram User Access Token (graph.instagram.com, commonly prefixed
 *     "IGAA" or "IGQ") — issued by the Instagram Graph API Explorer / login
 *     flow. It can read the account profile and reply to comments, but it
 *     CANNOT send arbitrary DMs: the Messenger Platform /me/messages endpoint
 *     only exists on graph.facebook.com and requires a Page token.
 *
 * {@link resolveInstagramHost} probes both hosts so either token type connects
 * successfully. The inbound webhook is configured in the Meta App dashboard,
 * using the channel's webhookToken as the verify token.
 *
 * Two inbound kinds are handled:
 *   - Direct messages   (entry[].messaging[])      → reply as a DM
 *   - Post/Reel comments (entry[].changes[] field 'comments') → reply publicly
 *
 * Comment replies are routed by encoding the target in the chatId as
 * `comment:<commentId>`; {@link sendText} detects that prefix and posts a public
 * reply instead of a DM. This keeps the shared inbound pipeline untouched.
 *
 * Message-request folder: Instagram routes DMs from non-followers into a
 * "Message Requests" folder; the recipient must accept (move to primary) before
 * the conversation is considered active. Meta still delivers these via webhook
 * (field `message` with `is_unsupported_message: true` on some payloads, or
 * with `tag: "folder"` / a `delivery` field carrying the `folder` value). They
 * are parsed here so the dashboard can surface them; {@link sendText} will
 * surface a clear error if a reply is attempted with an IG-user token.
 */
const COMMENT_PREFIX = 'comment:'

/** Facebook Graph API base — used by Page Access Tokens (DMs + comments). */
const FB_BASE = GRAPH_BASE // https://graph.facebook.com/v21.0
/** Instagram Graph API base — used by Instagram User Access Tokens ("IGAA…"). */
const IG_BASE = 'https://graph.instagram.com/v21.0'

type IgHost = 'facebook' | 'instagram'

interface ResolvedHost {
        host: IgHost
        base: string
        username: string
}

/**
 * Detect which Meta Graph host a given Instagram token works against, and read
 * the linked account's display name. Returns null when the token is rejected by
 * both hosts (i.e. truly invalid).
 *
 * The probe order is biased by the token prefix so the likely-correct host is
 * tried first, keeping the happy path to a single network request:
 *   - tokens starting with "IGAA"/"IGQ" → try graph.instagram.com first
 *   - anything else                     → try graph.facebook.com first
 */
export async function resolveInstagramHost(token: string): Promise<ResolvedHost | null> {
        if (!token) return null

        const looksLikeIgToken = /^(IGAA|IGQ)/i.test(token)
        const order: IgHost[] = looksLikeIgToken ? ['instagram', 'facebook'] : ['facebook', 'instagram']

        for (const host of order) {
                const base = host === 'facebook' ? FB_BASE : IG_BASE
                try {
                        const res = await fetch(`${base}/me?fields=username,name`, {
                                headers: { Authorization: `Bearer ${token}` },
                        })
                        if (!res.ok) continue
                        const json = (await res.json()) as { username?: string; name?: string }
                        const username = json.username || json.name
                        if (username) return { host, base, username }
                } catch {
                        /* network / transient error — fall through to the other host */
                }
        }
        return null
}

export function instagramAdapter(token: string): MessengerAdapter {
        // Lazily resolve the working host on the first outbound call, then cache it
        // for the adapter's lifetime so we don't re-probe /me on every message.
        let resolved: ResolvedHost | null | undefined

        async function host(): Promise<ResolvedHost | null> {
                if (resolved !== undefined) return resolved
                resolved = await resolveInstagramHost(token)
                return resolved
        }

        return {
                channel: 'INSTAGRAM',

                parseUpdate(body: unknown): InboundMessage[] {
                        const entries = (body as IgWebhook)?.entry
                        if (!entries?.length) return []
                        const out: InboundMessage[] = []
                        for (const entry of entries) {
                                // For Instagram, entry.id is the connected account's own id — used to
                                // skip echoes of our own DMs and our own comment replies (loop guard).
                                const selfId = entry.id

                                for (const m of entry.messaging ?? []) {
                                        if (m.message?.is_echo) continue

                                        // Meta can deliver a `delivery` or `read` or `postback`/`referral`
                                        // event instead of a real message; only `message` with text is a
                                        // reply-able inbound. Empty text → skip, but it is NOT an error.
                                        const text = m.message?.text
                                        const senderId = m.sender?.id
                                        if (!senderId || !text) continue

                                        // Message-request / pending folder. Meta flags a DM from a
                                        // non-follower (not yet accepted) in a few ways depending on API
                                        // version:
                                        //   - m.message.is_unsupported_message === true
                                        //   - m.message.tag === 'folder' with m.message.folder = 'pending'/'request'
                                        //   - m.delivery?.folder ('pending'/'request')
                                        // When we detect this, we still surface the inbound so the operator
                                        // can see it in the conversations inbox; the reply (if attempted)
                                        // will fail with a clear reason from sendText below.
                                        const isPending =
                                                m.message?.is_unsupported_message === true ||
                                                (m.message as { tag?: string })?.tag === 'folder' ||
                                                m.delivery?.folder === 'pending' ||
                                                m.delivery?.folder === 'request' ||
                                                // Some API versions expose the folder at the message level.
                                                (m.message as { folder?: string })?.folder === 'pending' ||
                                                (m.message as { folder?: string })?.folder === 'request'

                                        out.push({
                                                chatId: senderId,
                                                senderId,
                                                text,
                                                // Carry the pending flag through the shared pipeline so the
                                                // handler can skip a doomed auto-reply and instead surface the
                                                // inbound for an operator to accept manually.
                                                pendingFolder: isPending || undefined,
                                        })
                                }

                                for (const change of entry.changes ?? []) {
                                        if (change.field !== 'comments') continue
                                        const v = change.value
                                        const commentId = v?.id
                                        const text = v?.text
                                        if (!commentId || !text) continue
                                        // Skip the account's own comments/replies to avoid an answer loop.
                                        if (v?.from?.id && selfId && v.from.id === selfId) continue
                                        out.push({
                                                chatId: `${COMMENT_PREFIX}${commentId}`,
                                                senderId: v?.from?.id ?? commentId,
                                                senderName: v?.from?.username,
                                                text,
                                        })
                                }
                        }
                        return out
                },

                async sendText(chatId: string, text: string, opts?: SendOptions): Promise<void> {
                        if (!token) throw new Error('INSTAGRAM invalid credentials')
                        const h = await host()
                        if (!h) {
                                throw new Error('INSTAGRAM invalid credentials (token rejected by both Meta Graph hosts)')
                        }

                        // Public reply to a post/reel comment. Both hosts expose
                        // `/{comment-id}/replies`, so comment replies work with either token type.
                        if (chatId.startsWith(COMMENT_PREFIX)) {
                                const commentId = chatId.slice(COMMENT_PREFIX.length)
                                const res = await fetch(`${h.base}/${commentId}/replies`, {
                                        method: 'POST',
                                        headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({ message: text }),
                                })
                                if (!res.ok) {
                                        const detail = await res.text().catch(() => '')
                                        throw new Error(`INSTAGRAM comment reply failed (${res.status}): ${detail}`)
                                }
                                return
                        }

                        // Direct message reply. `/me/messages` exists only on graph.facebook.com
                        // and requires a Page Access Token. An Instagram User token
                        // (graph.instagram.com) cannot send arbitrary DMs — surface a clear,
                        // actionable error instead of an opaque failure from the IG host.
                        if (h.host === 'instagram') {
                                throw new Error(
                                        'INSTAGRAM_DM_UNAVAILABLE: این توکن از نوع Instagram User Access Token (graph.instagram.com) است ' +
                                                'که نمی‌تواند دایرکت ارسال کند. برای پاسخ به دایرکت، کانال را با یک Page Access Token ' +
                                                '(صادرشده از صفحه فیسبوک متصل به اکانت اینستاگرام) دوباره وصل کنید. ' +
                                                'پاسخ به کامنت‌ها با همین توکن کار می‌کند.',
                                )
                        }

                        // Facebook host (Page token) — full DM support. Quick replies (tappable
                        // suggestion chips) are supported on IG DMs; tapping one sends its title
                        // as a normal message. Platform limits: max 13 replies, titles ≤20 chars.
                        const message: Record<string, unknown> = { text }
                        if (opts?.quickReplies?.length) {
                                message.quick_replies = opts.quickReplies.slice(0, 13).map((q, i) => ({
                                        content_type: 'text',
                                        title: q.slice(0, 20),
                                        payload: `qr_${i}`,
                                }))
                        }
                        const res = await fetch(`${h.base}/me/messages`, {
                                method: 'POST',
                                headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                        recipient: { id: chatId },
                                        message,
                                        messaging_type: 'RESPONSE',
                                }),
                        })
                        if (!res.ok) {
                                const detail = await res.text().catch(() => '')
                                // 10 (permission), 200-299 (permission/rate), 613 (capability) — the
                                // most common causes of a "valid token but reply refused" failure.
                                throw new Error(
                                        `INSTAGRAM sendText failed (${res.status}): ${detail}. ` +
                                                'علل رایج: گیرنده هنوز مکالمه را accept نکرده، توکن دسترسی instagram_manage_messages ندارد، ' +
                                                'یا پنجرهٔ ۲۴ساعتهٔ پاسخ‌دهی بسته شده است.',
                                )
                        }
                },

                async sendTyping(chatId: string): Promise<void> {
                        // Comments have no typing state, and typing_on is a Messenger Platform
                        // sender action that only exists on graph.facebook.com.
                        if (!token || chatId.startsWith(COMMENT_PREFIX)) return
                        const h = await host()
                        if (!h || h.host === 'instagram') return
                        await fetch(`${h.base}/me/messages`, {
                                method: 'POST',
                                headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                        recipient: { id: chatId },
                                        sender_action: 'typing_on',
                                }),
                        })
                },
        }
}

/**
 * Validate an Instagram token by reading the linked account username from
 * whichever Meta Graph host accepts it — graph.facebook.com for Page Access
 * Tokens, graph.instagram.com for Instagram User Access Tokens (e.g. "IGAA…").
 * Returns null when neither host recognizes the token.
 */
export async function getInstagramInfo(
        token: string,
): Promise<{ username: string } | null> {
        const resolved = await resolveInstagramHost(token)
        return resolved ? { username: resolved.username } : null
}

/**
 * Return which Meta host a token resolved to (for diagnostics: the dashboard
 * uses this to show the operator whether DMs will work or only comments will).
 */
export async function getInstagramTokenDiagnostics(
        token: string,
): Promise<{ host: IgHost | null; username: string | null; canSendDms: boolean }> {
        const r = await resolveInstagramHost(token)
        return {
                host: r?.host ?? null,
                username: r?.username ?? null,
                canSendDms: r?.host === 'facebook',
        }
}

/**
 * Instagram webhooks are registered in the Meta App dashboard, not via API.
 * No-op so the shared create flow can still call it uniformly.
 */
export async function setInstagramWebhook(): Promise<boolean> {
        return true
}

interface IgWebhook {
        entry?: {
                id?: string
                messaging?: {
                        sender?: { id?: string }
                        recipient?: { id?: string }
                        message?: {
                                text?: string
                                mid?: string
                                is_echo?: boolean
                                is_unsupported_message?: boolean
                                tag?: string
                                folder?: string
                        }
                        delivery?: { folder?: string }
                }[]
                changes?: {
                        field?: string
                        value?: {
                                id?: string
                                text?: string
                                from?: { id?: string; username?: string }
                                media?: { id?: string; media_product_type?: string }
                        }
                }[]
        }[]
}
