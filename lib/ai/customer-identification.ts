/**
 * CUSTOMER IDENTIFICATION (F3) — v2
 * =============================
 *
 * Collects the customer's name + phone at the START of a conversation (per the
 * user's decision: "همون اولش بگیری کاربر"). The agent — guided by an injected
 * instruction — asks for these details before proceeding to substantive answers.
 *
 * Strategy (v2, post production-audit):
 *   1. When a new conversation opens AND the agent has requireCustomerInfo=true,
 *      the conversation is marked customerInfoState='pending'.
 *   2. While 'pending', an extra system instruction is injected telling the LLM
 *      to first politely ask for name + phone, and to not answer substantive
 *      questions until both required fields are available.
 *   3. TWO extraction layers run on each inbound user message while the
 *      identification flow is active:
 *        a) A high-precision REGEX extractor (below) that only trusts
 *           unambiguous self-introduction formulas.
 *        b) An LLM extractor (lib/ai/ai-identity-extractor.ts) as the rescue
 *           layer for prose the regex can never parse safely.
 *   4. Messenger channels (Telegram/Bale/Rubika/WhatsApp/Instagram) already
 *      carry a trusted platform identity, so for those channels we default to
 *      customerInfoState='skipped' unless the agent explicitly opts in.
 *
 * v1 → v2 (why the rewrite): the v1 regex mined names out of ordinary prose on
 * EVERY inbound message — even when identification was disabled — and produced
 * real junk CRM contacts on production:
 *      «من دیروز درخواست دادم…»      → contact «دیروز درخو»   (verb «است» matched INSIDE «درخواست»)
 *      «من تازه استریم رو شروع کردم» → contact «تازه»        (same mid-word «است» in «استریم»)
 *      «چطور به نام والدینم بزنم»    → contact «والدینم بزنم» (cue «نام» inside «به نام …»)
 *      «هزینه ثبت نام چقدره؟»        → contact «چقدره»       (cue «نام» inside «ثبت نام»)
 *      «اینجا ریال بگیریم؟»          → contact «ریال بگیریم»  (cue «اینجا»)
 * Two structural fixes:
 *      A) Persian word boundaries — JS \b is ASCII-only, so «است» happily
 *         matched mid-word inside «درخواست»/«استریم». Every cue/verb token is
 *         now wrapped in a letter-class lookaround (standalone()).
 *      B) Strong cues only — the bare «من X هستم» / «اسم X» / «نام X» /
 *         «اینجا X» patterns are GONE. «من X هستم» describes a state («من در
 *         کشوری هستم») far more often than it introduces a name. Prose names
 *         like «من علی هستم» are the LLM extractor's job now.
 */

import { prisma } from '@/lib/prisma'
import { recordConversationActivity } from '@/lib/conversations/activity'
import { toEnglishDigits, normalizePhone } from '@/lib/phone'
import { applyContactIdentity } from '@/lib/crm/contact-identity'

export interface ExtractedIdentity {
	name: string | null
	phone: string | null
}

export function hasCompleteCustomerIdentity(identity: ExtractedIdentity): boolean {
	return Boolean(identity.name?.trim() && identity.phone?.trim())
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
 * high-precision Persian + English self-introduction cues ONLY — see the
 * module header for why looser v1 patterns were removed.
 *
 * Handles:
 *  - Persian/Arabic digits in the phone ("۰۹۱۲۳۴۵۶۷۸۹")
 *  - Multiple phone candidates (picks the first valid Iranian mobile)
 *  - Inputs with no separator ("میلاد رجبی 09123456789")
 *  - «اسمم X هستم» / «نام من X است» / «بنده X می‌باشم» / «اسمم X، …»
 *  - English intros ("my name is John", "I'm Jane", "name: Bob")
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
			words.length <= 3 &&
			remainder.length >= 2 &&
			remainder.length <= 40
		) {
			// Only accept if it looks like a name (starts with a letter, no
			// digits, no purchase-intent words, no telecom/function words —
			// v1 turned «شماره تلفن من 0916…» into contact «شماره تلفن من»).
			if (/^[\p{L}]/u.test(remainder) && looksLikePersonName(remainder)) {
				name = remainder
			}
		}
	}

	return { name, phone }
}

// Words that signal a "name" candidate is actually a request/intent phrase,
// not a person's name. Without this filter, everyday Persian openers like
// «من دنبال یه گوشی هستم» became CRM contacts named «دنبال یه گوشی» — junk
// contacts, a corrupted {customer_name} greeting, and a prematurely
// 'collected' identification state.
//
// v2 additions (each one observed in, or one edit away from, the production
// audit): pronouns & verbs («هستم», «من», «رو»…), telecom nouns («شماره»,
// «تلفن», «موبایل» — «شماره تلفن من 0916…»), and marginal-participle fillers
// («شده», «فراموش»). A real person's name never contains any of these.
const NAME_STOPWORDS = new Set(
	[
		// purchase/intent (v1)
		'دنبال', 'لازم', 'میخوام', 'میخواهم', 'میخام', 'خواهم', 'بخوام',
		'قیمت', 'محصول', 'سفارش', 'خرید', 'بخرم', 'فروش', 'موجود', 'موجودی',
		'سوال', 'سؤال', 'مشکل', 'کمک', 'راهنمایی', 'اطلاعات', 'درباره',
		'لطفا', 'لطفاً', 'هزینه', 'تخفیف', 'ارسال', 'میشه', 'چطور', 'چطوری',
		'چنده', 'چقدر', 'کدوم', 'کدام', 'یه', 'یک', 'این', 'اون', 'چند',
		// pronouns / function words
		'من', 'منم', 'ما', 'شما', 'اون', 'اونا', 'ایشون', 'خودم', 'خودتون',
		'رو', 'را', 'رام', 'هم', 'همه', 'دیگه', 'فقط', 'خیلی', 'البته',
		'از', 'با', 'برای', 'که', 'تا', 'همین', 'اینجا', 'انجام',
		// verbs / copulas
		'هستم', 'هستی', 'هست', 'هستیم', 'هستید', 'است', 'استم', 'ام',
		'بودم', 'بودی', 'بود', 'بودیم', 'باشه', 'باشم', 'شدم', 'شدیم',
		'شده', 'دارم', 'داریم', 'ندارم', 'نداریم', 'میگم', 'بگم', 'بگیر',
		'بدید', 'بدیم', 'بفرست', 'فراموش',
		// telecom / identity nouns
		'شماره', 'تلفن', 'موبایل', 'همراه', 'ایمیل', 'کد', 'مدارک',
		// question words
		'چیه', 'کی', 'کجا', 'چرا', 'چه', 'کجای', 'چی',
		// English (v1 + additions)
		'want', 'looking', 'need', 'price', 'buy', 'order', 'help', 'question',
		'interested', 'searching', 'from', 'the', 'your', 'my', 'this', 'that',
		'is', 'am', 'are', 'name', 'number', 'phone', 'email',
	].map((w) => w.replace(/‌/g, '')),
)

/**
 * Stopwords that are ALSO common given names: «هستی» is "you are" and a
 * girl's name. The regex layer cannot tell the two apart, so it keeps
 * rejecting them («هستی؟» must not become a contact). The LLM layer reads
 * the sentence and may accept them — otherwise a customer called هستی could
 * never be identified and the agent would ask for her name forever.
 */
const AMBIGUOUS_GIVEN_NAMES = new Set(['هستی'])

/**
 * A candidate looks like a real person's name: 1–3 words, none of them intent
 * words. `contextual` is for callers that understood the sentence (the LLM
 * extractor): words that double as given names are then allowed.
 */
export function looksLikePersonName(
	candidate: string,
	options: { contextual?: boolean } = {},
): boolean {
	const words = candidate.split(/\s+/).filter(Boolean)
	if (!words.length || words.length > 3) return false
	return !words.some((w) => {
		const word = w.toLowerCase().replace(/‌/g, '')
		if (options.contextual && AMBIGUOUS_GIVEN_NAMES.has(word)) return false
		return NAME_STOPWORDS.has(word)
	})
}

// ── Persian-aware word boundaries ─────────────────────────────────
//
// JS `\b` is ASCII-only and NEVER matches between two Persian letters, so a
// bare «است» in a pattern happily matched inside «درخواست», «استریم»,
// «دریاست»… — the #1 source of junk CRM names in the v1 audit. `standalone()`
// wraps a token so no letter/digit may touch it on either side. ZWNJ/ZWJ
// count as joiners: they block the boundary exactly like a letter, so «است»
// can't hide inside «درخواست‌ام» either.
function standalone(token: string): string {
	return `(?<![\\p{L}\\p{N}\\u200c\\u200d])${token}(?![\\p{L}\\p{N}\\u200c\\u200d])`
}

/** Self-introduction cues strong enough to trust without a verb.
 *  Possessive forms ONLY («اسمم/اسمی/نامم», «اسم من/نام من») — the bare
 *  «اسم X»/«نام X» cues were removed because they live inside everyday
 *  phrases («به نام والدینم بزنم», «هزینه ثبت نام چقدره؟», «نام کاربری…»). */
const PERSIAN_POSSESSIVE_CUES = [
	`(?:${['اسمم', 'اسمی', 'نامم'].map(standalone).join('|')})`,
	`${standalone('اسم')}\\s+من`,
	`${standalone('نام')}\\s+من`,
].join('|')

/** All trusted cues (possessive forms + the formal «بنده»). The bare «من»
 *  cue is deliberately absent: «من X هستم» describes a state («من در کشوری
 *  هستم») far more often than it introduces a name. Prose names are the LLM
 *  extractor's job (lib/ai/ai-identity-extractor.ts). */
const PERSIAN_CUES = [
	PERSIAN_POSSESSIVE_CUES,
	standalone('بنده'),
].join('|')

/** Copula/verb tokens, word-bounded. Longest first so «هستم» wins over «هست»
 *  and the dangerous short «است» is tried last. */
const PERSIAN_VERBS = [
	'هستیم', 'هستید', 'هستم', 'هستی', 'هست', 'می‌باشم', 'میباشم', 'است',
].map(standalone).join('|')

/**
 * Persian name extraction — v2: explicit self-introductions only.
 * Returns the first match that yields a 2–30 char name that also passes the
 * intent-stopword filter.
 */
function extractPersianName(text: string): string | null {
	// Pattern 1: «اسمم X هستم» / «نام من X است» / «بنده X می‌باشم» — a cue
	// followed by a copula. The word-bounded verb is what makes this safe:
	// «من دیروز درخواست دادم» can't match because «است» inside «درخواست» is
	// no longer a standalone token.
	const re1 = new RegExp(
		`(?:${PERSIAN_CUES})\\s+(?:من\\s+)?([\\p{L}\\s]{2,30}?)\\s*(?:${PERSIAN_VERBS})`,
		'u',
	)
	const m1 = text.match(re1)
	if (m1 && m1[1]) {
		const candidate = m1[1].trim().replace(/\s+/g, ' ')
		if (
			candidate.length >= 2 &&
			candidate.length <= 30 &&
			looksLikePersonName(candidate)
		)
			return candidate
	}

	// Pattern 2: «اسمم X» / «نامم X» / «اسم من X» followed by end-of-string,
	// a comma, a period, a semicolon or a newline («اسمم علی، شماره‌ام…»).
	// Possessive cues only — see PERSIAN_POSSESSIVE_CUES.
	const re2 = new RegExp(
		`(?:${PERSIAN_POSSESSIVE_CUES})\\s+([\\p{L}][\\p{L}\\s]{1,29}?)(?=$|[،.,؛:!؟\\n])`,
		'u',
	)
	const m2 = text.match(re2)
	if (m2 && m2[1]) {
		const candidate = m2[1].trim().replace(/\s+/g, ' ')
		if (
			candidate.length >= 2 &&
			candidate.length <= 30 &&
			looksLikePersonName(candidate)
		)
			return candidate
	}

	return null
}

/**
 * English name extraction — "my name is John", "I'm Jane", "name: Bob".
 * Word-bounded so the cues can't match inside other words.
 */
function extractEnglishName(text: string): string | null {
	const patterns = [
		/\b(?:my\s+name\s+is|i\s+am|i'm)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?=$|[.,!\n])/i,
		/\bname\s*:\s*([A-Za-z][A-Za-z\s]{1,30}?)(?=$|[.,!\n])/i,
		/\bthis\s+is\s+([A-Za-z][A-Za-z\s]{1,30}?)(?=$|[.,!\n])/i,
	]
	for (const re of patterns) {
		const m = text.match(re)
		if (m && m[1]) {
			const candidate = m[1].trim().replace(/\s+/g, ' ')
			if (
				candidate.length >= 2 &&
				candidate.length <= 30 &&
				looksLikePersonName(candidate)
			)
				return candidate
		}
	}
	return null
}

/**
 * Persist extracted identity onto the contact + flip the conversation state to
 * 'collected' only after the resulting CRM contact has BOTH name and phone.
 * The two fields may arrive in separate messages, so completion is checked on
 * the merged contact rather than only on the current message.
 */
export async function applyExtractedIdentity(params: {
	workspaceId: string
	conversationId: string
	contactId: string | null
	extracted: ExtractedIdentity
}): Promise<string | null> {
	const { workspaceId, conversationId, contactId, extracted } = params
	if (!extracted.name && !extracted.phone) return contactId

	const resolvedContactId = await applyContactIdentity({
		workspaceId,
		conversationId,
		contactId,
		name: extracted.name,
		phone: extracted.phone,
	})

	const completeIdentity = resolvedContactId
		? await prisma.contact.findFirst({
			where: { id: resolvedContactId, workspaceId },
			select: { name: true, phone: true },
		})
		: null

	// The enabled setting is a real gate: both fields are required.
	if (completeIdentity && hasCompleteCustomerIdentity(completeIdentity)) {
		const transition = await prisma.conversation
			.updateMany({
				where: { id: conversationId, customerInfoState: { not: 'collected' } },
				data: { customerInfoState: 'collected', identifiedAt: new Date() },
			})
			.catch(() => ({ count: 0 }))

		// Emit once, only when the state actually transitions. The activity stores
		// field names, never the customer's personal values.
		if (transition.count > 0) {
			await recordConversationActivity(prisma, conversationId, {
				kind: 'customer_identified',
				fields: ['name', 'phone'],
				source: 'agent',
			}).catch(() => {})
		}
	}

	return resolvedContactId
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
	const preferredWording = customPrompt?.trim()
		? isFa
			? `\nمتن ترجیحی برای درخواست اطلاعات: «${customPrompt.trim()}»`
			: `\nPreferred wording for the request: “${customPrompt.trim()}”`
		: ''
	return isFa
		? `\n\n### مهم: شناسایی مشتری (الزامی قبل از پاسخ اصلی)
در ابتدای گفتگو، قبل از هر چیز، مودبانه نام و شماره تماس مشتری را بپرس.
قوانین:
• اگر مشتری فقط سلام کرد، خوش‌آمد بگو و نامش را بپرس.
• اگر مشتری مستقیم سؤال فنی پرسید، اول تأیید کن که به زودی پاسخ می‌دهی، بعد نامش را بپرس.
• اگر مشتری همه‌چیز را یک‌جا فرستاد (مثلاً «میلاد رجبی 09123456789»)، نام و شماره را از همان پیام استخراج کن و دوباره نپرس.
• اگر مشتری فقط شماره داد و نام نگفت، فقط نام را بپرس («ممنون! اسم شما چیه؟»). اگر فقط نام داد، فقط شماره را بپرس.
• تا وقتی هم نام و هم شماره معتبر را نداری، وارد بحث جزئیات محصول/قیمت نشو.
• وقتی نام + شماره را گرفتی، تشکر کن و بعد کامل پاسخ بده.
• اگر مشتری یکی از موارد را وارد نکرد، کوتاه و محترمانه فقط همان مورد ناقص را دوباره درخواست کن.${preferredWording}`
		: `\n\n### Required: customer identification (before substantive answers)
At the very start of the conversation, politely ask for the customer's name and phone.
Rules:
• If they only say "hi", greet and ask their name.
• If they ask a technical question right away, acknowledge you'll answer, then ask their name.
• If they send everything at once (e.g. "John Doe 09123456789"), extract the name and phone from that message — do not ask again.
• If they gave only a phone, ask only for the name ("Thanks! What's your name?"). If they gave only a name, ask only for the phone.
• Don't dive into product/price details until you have both a valid name and phone.
• Once you have name + phone, thank them and answer fully.
• If one field is missing, briefly and politely ask only for that missing field again.${preferredWording}`
}
