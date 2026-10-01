/**
 * Persian-aware search (ط۱۴).
 *
 * The same word reaches the database in several spellings: Arabic «ي/ك»
 * from some keyboards and imports, Persian «ی/ک» from others, and digits in
 * Persian, Arabic-Indic or Latin form («۰۹۱۲», «٠٩١٢», «0912»). A plain
 * `contains` misses every variant but the one typed. `searchVariants` turns
 * one query into the few spellings worth trying, so server-side filters can
 * OR over them; `normalizePersian` folds text for client-side matching.
 */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function toLatinDigits(text: string): string {
	return text.replace(/[۰-۹٠-٩]/g, (d) => {
		const fa = FA_DIGITS.indexOf(d)
		return String(fa >= 0 ? fa : AR_DIGITS.indexOf(d))
	})
}

function toPersianDigits(text: string): string {
	return text.replace(/[0-9٠-٩]/g, (d) => {
		const ar = AR_DIGITS.indexOf(d)
		return FA_DIGITS[ar >= 0 ? ar : Number(d)]
	})
}

function toPersianLetters(text: string): string {
	return text.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه')
}

function toArabicLetters(text: string): string {
	return text.replace(/ی/g, 'ي').replace(/ک/g, 'ك')
}

/** Folds letter variants, digits, diacritics, tatweel and ZWNJ for matching. */
export function normalizePersian(text: string): string {
	return toLatinDigits(toPersianLetters(text.toLowerCase()))
		.replace(/[ً-ٰٟـ‌]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

/** Up to four spellings of one query, original first, duplicates removed. */
export function searchVariants(query: string): string[] {
	const base = query.trim()
	if (!base) return []
	const persian = toPersianLetters(base)
	const variants = [
		base,
		toLatinDigits(persian),
		toPersianDigits(persian),
		toLatinDigits(toArabicLetters(base)),
	]
	return [...new Set(variants)].slice(0, 4)
}
