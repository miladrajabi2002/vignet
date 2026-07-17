/**
 * CUSTOMER IDENTIFICATION (F3)
 * =============================
 *
 * Collects the customer's name + phone at the START of a conversation (per the
 * user's decision: "همون اولش بگیری کاربر"). The agent — guided by an injected
 * instruction — asks for these details before proceeding to substantive answers.
 *
 * Strategy:
 *   1. When a new conversation opens AND the agent has requireCustomerInfo=true,
 *      the conversation is marked customerInfoState='pending'.
 *   2. While 'pending', an extra system instruction is injected telling the LLM
 *      to first politely ask for name + phone, and to not answer substantive
 *      questions until it has at least a name.
 *   3. A lightweight extractor scans each incoming user message for an Iranian
 *      phone pattern + a likely-name; when found, the contact row is updated
 *      and the conversation is marked 'collected'.
 *   4. Messenger channels (Telegram/Bale/Rubika/WhatsApp/Instagram) already
 *      carry a trusted platform identity, so for those channels we default to
 *      customerInfoState='skipped' unless the agent explicitly opts in.
 */

import { prisma } from '@/lib/prisma'
import { recordConversationActivity } from '@/lib/conversations/activity'
import { toEnglishDigits, normalizePhone } from '@/lib/phone'

export interface ExtractedIdentity {
	name: string | null
	phone: string | null
}

// ── Phone extraction ──────────────────────────────────────────────
//
// We convert Persian/Arabic digits to ASCII first (a very common bug source —
// users type ۰۹۱۲… and the old regex only matched ASCII 9\d{9}). Then we use
// matchAll to grab every phone-like run, and pick the first that normalizes
// to a valid Iranian mobile (+989XXXXXXXXX) via lib/phone.normalizePhone.
const PHONE_CANDIDATE_RE = /(\+?98|0098|0)?9\d{9}/g

/**
 * Best-effort extraction of a name and phone from a free-form user message.
 * The phone is normalized to E.164 (+98XXXXXXXXXX). The name is detected via
 * lightweight Persian + English cues.
 *
 * Handles:
 *  - Persian/Arabic digits in the phone ("۰۹۱۲۳۴۵۶۷۸۹")
 *  - Multiple phone candidates (picks the first valid Iranian mobile)
 *  - Inputs with no separator ("میلاد رجبی 09123456789")
 *  - Bare names after common Persian cues ("اسم علی", "من سارا")
 *  - English intros ("my name is John", "I'm Jane")
 */
export function extractIdentity(text: string): ExtractedIdentity {
	if (!text || typeof text !== 'string') return { name: null, phone: null }

	// Convert Persian/Arabic digits to ASCII so the phone regex matches.
	const normalized = toEnglishDigits(text)

	// ── Phone ──
	let phone: string | null = null
	for (const m of normalized.matchAll(PHONE_CANDIDATE_RE)) {
		const candidate = m[0]
		const p = normalizePhone(candidate)
		if (p) {
			phone = p
			break
		}
	}
	// Fallback: try the whole stripped text (handles inputs like "09123456789")
	if (!phone) {
		const stripped = normalized.replace(/[\s\-()]/g, '')
		const p = normalizePhone(stripped)
		if (p) phone = p
	}

	// ── Name ──
	// Remove the phone substring from the text so the name extractor doesn't
	// accidentally pick up digit fragments.
	const textForName = phone
		? normalized.replace(PHONE_CANDIDATE_RE, ' ').trim()
		: normalized

	let name: string | null = extractPersianName(textForName)
	if (!name) name = extractEnglishName(textForName)

	// ── Fallback: if the message is short (≤ 4 words) and has no digits,
	//    treat the whole thing as a name. Common case: user just types "علی رضایی".
	if (!name && phone) {
		const remainder = textForName
			.replace(/[^\p{L}\s]/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim()
		const words = remainder.split(' ').filter(Boolean)
		if (
			words.length >= 1 &&
			words.length <= 4 &&
			remainder.length >= 2 &&
			remainder.length <= 40
		) {
			// Only accept if it looks like a name (starts with a letter, no digits).
			if (/^[\p{L}]/u.test(remainder)) {
				name = remainder
			}
		}
	}

	return { name, phone }
}

/**
 * Persian name extraction — covers a wide range of real-world phrasings.
 * Returns the first match that yields a 2–30 char name.
 */
function extractPersianName(text: string): string | null {
	// Common Persian cue words that precede a name.
	const cues = [
		/(?:اسمم|اسمی|اسم|من\s+اسمم|نامم|نام\s+من|بنده|من)\s+(?:من\s+)?/u,
		/(?:من\s+هستم\s+|این\s+|من\s+،\s*)/u,
	]

	// Verb suffixes that often follow the name.
	const verbs = [
		/(?:هستم|است|می‌باشم|می‌باشم|هست|صحبت\s+می‌کنم|تحدث\s+می‌کنم|می‌خوام|می‌خواهم)/u,
	]

	// Pattern 1: "اسمم X هستم" / "نام من X است" / "من X می‌باشم"
	for (const cue of cues) {
		for (const verb of verbs) {
			const re = new RegExp(
				cue.source + '\\s*([\\p{L}\\s]{2,30}?)\\s*(?:' + verb.source + ')',
				'u',
			)
			const m = text.match(re)
			if (m && m[1]) {
				const candidate = m[1].trim().replace(/\s+/g, ' ')
				if (candidate.length >= 2 && candidate.length <= 30) return candidate
			}
		}
	}

	// Pattern 2: "اسم X" / "نام X" / "من X" followed by end, comma, period, or newline.
	// This is the most common real-world form — no verb needed.
	const barePatterns = [
		/(?:اسمم|اسمی|اسم|نامم|نام)\s+(?:من\s+)?([\p{L}][\p{L}\s]{1,29}?)(?=$|[،.,\n؛!؟])/u,
		/(?:بنده|من)\s+([\p{L}][\p{L}\s]{1,29}?)(?=$|[،.,\n؛!؟])/u,
		/(?:من\s+هستم\s+|این\s+|اینجا\s+)([\p{L}][\p{L}\s]{1,29}?)(?=$|[،.,\n؛!؟])/u,
	]
	for (const re of barePatterns) {
		const m = text.match(re)
		if (m && m[1]) {
			const candidate = m[1].trim().replace(/\s+/g, ' ')
			if (candidate.length >= 2 && candidate.length <= 30) return candidate
		}
	}

	return null
}

/**
 * English name extraction — "my name is John", "I'm Jane", "name: Bob".
 */
function extractEnglishName(text: string): string | null {
	const patterns = [
		/(?:my\s+name\s+is|i\s*am|i'm|name:?)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?=$|[.,!\n])/i,
		/\bthis\s+is\s+([A-Za-z][A-Za-z\s]{1,30}?)(?=$|[.,!\n])/i,
	]
	for (const re of patterns) {
		const m = text.match(re)
		if (m && m[1]) {
			const candidate = m[1].trim().replace(/\s+/g, ' ')
			if (candidate.length >= 2 && candidate.length <= 30) return candidate
		}
	}
	return null
}

/**
 * Persist extracted identity onto the contact + flip the conversation state to
 * 'collected' when we have at least a name OR a phone. Fire-and-forget safe.
 *
 * Note: we now flip to 'collected' as soon as we have EITHER a name OR a phone
 * (previously required a name). This prevents the agent from re-asking for
 * info when the user has already provided their phone, and lets the smart
 * extractor do its job even when only one field is captured.
 */
export async function applyExtractedIdentity(params: {
	conversationId: string
	contactId: string | null
	extracted: ExtractedIdentity
}): Promise<void> {
	const { conversationId, contactId, extracted } = params
	if (!extracted.name && !extracted.phone) return

	if (contactId) {
		const existing = await prisma.contact.findUnique({
			where: { id: contactId },
			select: { id: true, name: true, phone: true },
		})
		if (existing) {
			const data: { name?: string; phone?: string } = {}
			if (extracted.name && !existing.name) data.name = extracted.name
			if (extracted.phone && !existing.phone) data.phone = extracted.phone
			if (Object.keys(data).length) {
				await prisma.contact.update({ where: { id: contactId }, data })
			}
		}
	}

	// Mark conversation as collected once we have a name OR a phone.
	if (extracted.name || extracted.phone) {
		const transition = await prisma.conversation
			.updateMany({
				where: { id: conversationId, customerInfoState: { not: 'collected' } },
				data: { customerInfoState: 'collected', identifiedAt: new Date() },
			})
			.catch(() => ({ count: 0 }))

		// Emit once, only when the state actually transitions. The activity stores
		// field names, not the customer's name/phone value.
		if (transition.count > 0) {
			await recordConversationActivity(prisma, conversationId, {
				kind: 'customer_identified',
				fields: [
					...(extracted.name ? (['name'] as const) : []),
					...(extracted.phone ? (['phone'] as const) : []),
				],
				source: 'agent',
			}).catch(() => {})
		}
	}
}

/**
 * The extra instruction appended to the system prompt while the conversation is
 * still in the 'pending' identification state. Tells the LLM to collect name+phone
 * FIRST, before answering substantive questions.
 *
 * Improved to:
 *  - Be more explicit about extraction from free-form messages
 *  - Add a targeted fallback: if only the phone was captured, ask specifically
 *    for the name (and vice-versa)
 *  - Handle the "no separator" case ("میلاد رجبی 0912...")
 */
export function identificationInstruction(
	isFa: boolean,
	customPrompt?: string | null,
): string {
	if (customPrompt && customPrompt.trim()) {
		return isFa
			? `\n\n### مهم: شناسایی مشتری (الزامی)\n${customPrompt.trim()}`
			: `\n\n### Required: customer identification\n${customPrompt.trim()}`
	}
	return isFa
		? `\n\n### مهم: شناسایی مشتری (الزامی قبل از پاسخ اصلی)
در ابتدای گفتگو، قبل از هر چیز، مودبانه نام و شماره تماس مشتری را بپرس.
قوانین:
• اگر مشتری فقط سلام کرد، خوش‌آمد بگو و نامش را بپرس.
• اگر مشتری مستقیم سؤال فنی پرسید، اول تأیید کن که به زودی پاسخ می‌دهی، بعد نامش را بپرس.
• اگر مشتری همه‌چیز را یک‌جا فرستاد (مثلاً «میلاد رجبی 09123456789»)، نام و شماره را از همان پیام استخراج کن و دوباره نپرس.
• اگر مشتری فقط شماره داد و نام نگفت، فقط نام را بپرس («ممنون! اسم شما چیه؟»). اگر فقط نام داد، فقط شماره را بپرس.
• تا وقتی حداقل نام را نداری، وارد بحث جزئیات محصول/قیمت نشو.
• وقتی نام + شماره را گرفتی، تشکر کن و بعد کامل پاسخ بده.
• اگر مشتری از دادن شماره امتناع کرد، فقط نام کافی است — اصرار نکن.`
		: `\n\n### Required: customer identification (before substantive answers)
At the very start of the conversation, politely ask for the customer's name and phone.
Rules:
• If they only say "hi", greet and ask their name.
• If they ask a technical question right away, acknowledge you'll answer, then ask their name.
• If they send everything at once (e.g. "John Doe 09123456789"), extract the name and phone from that message — do not ask again.
• If they gave only a phone, ask only for the name ("Thanks! What's your name?"). If they gave only a name, ask only for the phone.
• Don't dive into product/price details until you have at least their name.
• Once you have name + phone, thank them and answer fully.
• If they refuse the phone, name alone is enough — don't push.`
}
