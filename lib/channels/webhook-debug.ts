import type { MessengerType } from '@/lib/channels/registry'

/**
 * In-memory ring buffer of raw webhook payloads, for live debugging.
 *
 * When an Instagram/WhatsApp/etc. inbound "isn't being read", the first
 * question is always: "did the platform actually deliver it?" This module
 * captures the last N raw JSON bodies per channel type so an admin can inspect
 * exactly what arrived — no database migration needed, no log grepping.
 *
 * Storage is process-local and volatile (lost on restart). That's intentional:
 * it's a debugging aid, not an audit trail. Cap is low to bound memory.
 */

interface CapturedPayload {
        id: string
        ts: number // epoch ms
        type: string // channel type
        tokenHint: string // first 8 chars of the webhook path token, for correlation
        size: number // body byte length
        body: unknown // the parsed JSON body
        parsedCount: number // how many InboundMessages the adapter extracted
        /**
         * Human-readable categorization. MAY EMBED A MESSAGE-TEXT PREVIEW, so it
         * is admin-only — never return it on a tenant-facing surface.
         */
        eventType: string
        /** Same categorization WITHOUT any customer text — safe for tenants. */
        eventKind: string
}

/**
 * A tenant-safe view of a captured payload: routing ids only, no customer
 * message text, no webhook-token hint, no raw body.
 */
export interface RedactedWebhookPayload {
        ts: number
        eventKind: string
        parsedCount: number
        entryIds: string[]
        recipientIds: string[]
        allSentIds: string[]
}

const MAX_PER_TYPE = 50
const buffer = new Map<string, CapturedPayload[]>()

function key(type: string): string {
        return type
}

/**
 * Categorize a raw webhook body into a human-readable event type, so the admin
 * can see at a glance whether a payload was a real message (worth replying to)
 * or a non-reply-able event (delivery receipt, read receipt, edit, etc.).
 *
 * This is purely for display — it doesn't affect processing. The adapter's
 * parseUpdate() already decides what to extract; this just labels the payload
 * so "parsedCount: 0" isn't ambiguous.
 */
function categorizePayload(body: unknown): string {
        if (!body || typeof body !== 'object') return 'unknown'
        const b = body as Record<string, unknown>
        const entries = (b.entry as Array<Record<string, unknown>>) ?? []
        if (!entries.length) return 'empty'

        const entry = entries[0] as Record<string, unknown>
        // Instagram / Messenger messaging events
        const messaging = (entry.messaging as Array<Record<string, unknown>>) ?? []
        if (messaging.length) {
                const m = messaging[0] as Record<string, unknown>
                // Cast message once so TS doesn't complain about property access on `unknown`.
                const msg = (m.message as Record<string, unknown> | undefined) ?? undefined
                if (m.message_edit) return 'message_edit (ویرایش پیام — بدون متن، قابل‌پاسخ نیست)'
                if (msg?.is_echo) return 'echo (پیام ارسالی خودمان — نادیده گرفته می‌شود)'
                if (typeof msg?.text === 'string')
                        return `message (پیام جدید: "${msg.text.slice(0, 50)}")`
                if (m.delivery) return 'delivery_receipt (رسید تحویل — بدون متن)'
                if (m.read) return 'read_receipt (رسید خوانده‌شدن — بدون متن)'
                if (m.postback) return 'postback (کلیک دکمه — بدون متن)'
                if (m.referral) return 'referral (ارجاع — بدون متن)'
                if (m.message) return 'message (پیام بدون متن — احتمالاً مدیا/استیکر)'
                return 'messaging_event (نوع نامشخص)'
        }
        // Instagram comment/change events. The `messages` field's TEST button sends
        // a synthetic payload in this changes[] shape with placeholder ids — detect
        // it so the admin doesn't confuse it with a real inbound message.
        const changes = (entry.changes as Array<Record<string, unknown>>) ?? []
        if (changes.length) {
                const c = changes[0] as Record<string, unknown>
                const v = (c.value as Record<string, unknown> | undefined) ?? undefined
                const msg = (v?.message as Record<string, unknown> | undefined) ?? undefined
                // Test payloads use id "0" and literal "random_*" placeholders.
                const isTestPayload =
                        entry.id === '0' ||
                        (typeof msg?.mid === 'string' && msg.mid === 'random_mid') ||
                        (typeof msg?.text === 'string' && msg.text === 'random_text')
                if (isTestPayload) {
                        return 'TEST payload (دکمه Test در پنل Meta — پیام واقعی نیست)'
                }
                if (c.field === 'comments') return 'comment (کامنت روی پست/ریلز)'
                if (c.field === 'messages' && msg?.text) {
                        return `message_via_changes (پیام در فرمت changes: "${String(msg.text).slice(0, 50)}")`
                }
                return `change:${String(c.field ?? 'unknown')}`
        }
        return 'unknown'
}

/**
 * Strip any quoted message preview that categorizePayload embedded, so the
 * label can be shown to a tenant without leaking another workspace's customer
 * text. `message (پیام جدید: "سلام…")` → `message`.
 */
function redactEventLabel(eventType: string): string {
        const head = eventType.split(' (')[0]
        return head || 'unknown'
}

/** Record a raw inbound webhook body for later inspection. */
export function logWebhookPayload(
        type: MessengerType | string,
        token: string,
        body: unknown,
        parsedCount: number,
): void {
        const arr = buffer.get(key(type)) ?? []
        const eventType = categorizePayload(body)
        arr.unshift({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                ts: Date.now(),
                type,
                tokenHint: token.slice(0, 8),
                size: JSON.stringify(body ?? '').length,
                body,
                parsedCount,
                eventType,
                eventKind: redactEventLabel(eventType),
        })
        if (arr.length > MAX_PER_TYPE) arr.length = MAX_PER_TYPE
        buffer.set(key(type), arr)
}

/** Owner-side ids in a Meta payload (never sender/commenter ids). */
function payloadOwnerIds(body: unknown): { entryIds: string[]; recipientIds: string[] } {
        const parsed = body as {
                entry?: Array<{
                        id?: string | number
                        messaging?: Array<{ recipient?: { id?: string | number } }>
                        changes?: Array<{
                                value?: {
                                        to?: { id?: string | number }
                                        recipient?: { id?: string | number }
                                }
                        }>
                }>
        } | null
        const entryIds: string[] = []
        const recipientIds: string[] = []
        const push = (list: string[], v: string | number | undefined | null) => {
                if (v !== undefined && v !== null) list.push(String(v))
        }
        for (const e of parsed?.entry ?? []) {
                push(entryIds, e?.id)
                for (const m of e?.messaging ?? []) push(recipientIds, m?.recipient?.id)
                for (const c of e?.changes ?? []) {
                        push(recipientIds, c?.value?.to?.id)
                        push(recipientIds, c?.value?.recipient?.id)
                }
        }
        return { entryIds, recipientIds }
}

/**
 * Tenant-safe webhook diagnostics.
 *
 * The buffer is process-global and holds payloads for EVERY workspace, so a
 * tenant surface must never see it raw (that leaked other tenants' customer DM
 * text, Instagram account ids and webhook-token prefixes). A payload is
 * visible to this caller only when it is:
 *   - theirs   → an owner id matches one of `ownedIds`, or
 *   - orphan   → none of its owner ids is claimed by ANY channel
 *                (`claimedIds`), which is exactly the Meta id-mismatch case
 *                this diagnostics screen exists to debug.
 * Payloads owned by another workspace are counted, never described.
 */
export function getScopedWebhookPayloads(
        type: string,
        ownedIds: string[],
        claimedIds: string[],
        limit = 5,
): { payloads: RedactedWebhookPayload[]; otherTenantPayloadCount: number } {
        const owned = new Set(ownedIds)
        const claimed = new Set(claimedIds)
        const all = buffer.get(key(type)) ?? []
        const payloads: RedactedWebhookPayload[] = []
        let otherTenantPayloadCount = 0

        for (const p of all) {
                const { entryIds, recipientIds } = payloadOwnerIds(p.body)
                const allSentIds = Array.from(new Set([...entryIds, ...recipientIds]))
                const isMine = allSentIds.some((id) => owned.has(id))
                const isOrphan = allSentIds.every((id) => !claimed.has(id))
                if (!isMine && !isOrphan) {
                        otherTenantPayloadCount++
                        continue
                }
                if (payloads.length >= limit) continue
                payloads.push({
                        ts: p.ts,
                        eventKind: p.eventKind,
                        parsedCount: p.parsedCount,
                        entryIds,
                        recipientIds,
                        allSentIds,
                })
        }
        return { payloads, otherTenantPayloadCount }
}

/** Return the most recent captured payloads for a channel type (or all). */
export function getWebhookPayloads(
        type?: string,
        limit = 20,
): CapturedPayload[] {
        const lists: CapturedPayload[][] = type
                ? [buffer.get(key(type)) ?? []]
                : Array.from(buffer.values())
        const merged = lists.flat()
        return merged.slice(0, limit)
}

/** Clear captured payloads (e.g. after the operator has inspected them). */
export function clearWebhookPayloads(type?: string): number {
        if (type) {
                const n = (buffer.get(key(type)) ?? []).length
                buffer.delete(key(type))
                return n
        }
        const total = Array.from(buffer.values()).reduce((s, a) => s + a.length, 0)
        buffer.clear()
        return total
}
