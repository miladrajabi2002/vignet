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
	eventType: string // human-readable categorization of what this payload is
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
function categorizePayload(type: string, body: unknown): string {
	if (!body || typeof body !== 'object') return 'unknown'
	const b = body as Record<string, unknown>
	const entries = (b.entry as Array<Record<string, unknown>>) ?? []
	if (!entries.length) return 'empty'

	const entry = entries[0]
	// Instagram / Messenger messaging events
	const messaging = (entry.messaging as Array<Record<string, unknown>>) ?? []
	if (messaging.length) {
		const m = messaging[0]
		if (m.message_edit) return 'message_edit (ویرایش پیام — بدون متن، قابل‌پاسخ نیست)'
		if (m.message?.is_echo) return 'echo (پیام ارسالی خودمان — نادیده گرفته می‌شود)'
		if (m.message?.text)
			return `message (پیام جدید: "${String(m.message.text).slice(0, 50)}")`
		if (m.delivery) return 'delivery_receipt (رسید تحویل — بدون متن)'
		if (m.read) return 'read_receipt (رسید خوانده‌شدن — بدون متن)'
		if (m.postback) return 'postback (کلیک دکمه — بدون متن)'
		if (m.referral) return 'referral (ارجاع — بدون متن)'
		if (m.message) return 'message (پیام بدون متن — احتمالاً مدیا/استیکر)'
		return 'messaging_event (نوع نامشخص)'
	}
	// Instagram comment events
	const changes = (entry.changes as Array<Record<string, unknown>>) ?? []
	if (changes.length) {
		const c = changes[0]
		if (c.field === 'comments') return 'comment (کامنت روی پست/ریلز)'
		return `change:${c.field ?? 'unknown'}`
	}
	return 'unknown'
}

/** Record a raw inbound webhook body for later inspection. */
export function logWebhookPayload(
	type: MessengerType | string,
	token: string,
	body: unknown,
	parsedCount: number,
): void {
	const arr = buffer.get(key(type)) ?? []
	arr.unshift({
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		ts: Date.now(),
		type,
		tokenHint: token.slice(0, 8),
		size: JSON.stringify(body ?? '').length,
		body,
		parsedCount,
		eventType: categorizePayload(type, body),
	})
	if (arr.length > MAX_PER_TYPE) arr.length = MAX_PER_TYPE
	buffer.set(key(type), arr)
}

/** Return the most recent captured payloads for a channel type (or all). */
export function getWebhookPayloads(type?: string, limit = 20): CapturedPayload[] {
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
