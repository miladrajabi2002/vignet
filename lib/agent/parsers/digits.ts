/**
 * Persian ↔ Latin digit conversion, shared by server code and UI.
 *
 * Use them with String.prototype.replace, which restarts a global regex on
 * every call, so the shared /g patterns are safe there (never pass them to
 * .test() or .exec(), which keep lastIndex between calls):
 *
 *   text.replace(PERSIAN_DIGIT_RE, persianDigitToLatin)   // '۱۲۳' → '123'
 *   text.replace(LATIN_DIGIT_RE, latinDigitToPersian)     // '123' → '۱۲۳'
 *
 * Arabic-Indic digits (٠-٩) are not touched; callers that accept them keep
 * their own wider patterns.
 */
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export const PERSIAN_DIGIT_RE = /[۰-۹]/g
export const LATIN_DIGIT_RE = /\d/g

export function persianDigitToLatin(digit: string): string {
	return String(PERSIAN_DIGITS.indexOf(digit))
}

export function latinDigitToPersian(digit: string): string {
	return PERSIAN_DIGITS[Number(digit)]
}
