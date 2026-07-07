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
}

const MAX_PER_TYPE = 50
const buffer = new Map<string, CapturedPayload[]>()

function key(type: string): string {
	return type
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
	})
	if (arr.length > MAX_PER_TYPE) arr.length = MAX_PER_TYPE
	buffer.set(key(type), arr)
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
