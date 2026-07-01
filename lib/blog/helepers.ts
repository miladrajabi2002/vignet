/**
 * Blog helpers — slug generation, reading-time estimate, SEO defaults,
 * markdown rendering (very small subset for SEO-friendly HTML), and
 * SEO analysis for the dashboard editor.
 *
 * Markdown renderer: minimal but safe — supports headings, bold, italic,
 * inline code, code blocks, links, images, lists, blockquote, hr, paragraphs.
 * Output is HTML-escaped; XSS-safe.
 */

const STOP_WORDS_FA = new Set([
	'و',
	'در',
	'به',
	'از',
	'که',
	'این',
	'را',
	'با',
	'است',
	'برای',
	'آن',
	'یک',
	'تا',
	'بر',
	'یا',
	'هم',
	'نیز',
	'اما',
	'اگر',
	'چه',
	'هر',
	'شما',
	'ما',
	'من',
	'او',
	'آنها',
	'خود',
	'بود',
	'شد',
	'شده',
	'می',
	'های',
	'ها',
])
const STOP_WORDS_EN = new Set([
	'the',
	'a',
	'an',
	'and',
	'or',
	'but',
	'if',
	'in',
	'on',
	'at',
	'to',
	'of',
	'for',
	'is',
	'are',
	'was',
	'were',
	'be',
	'been',
	'with',
	'as',
	'by',
	'this',
	'that',
	'it',
	'from',
	'you',
	'we',
	'they',
	'i',
	'he',
	'she',
])

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Convert ASCII digits in a string to Persian digits (for display). */
export function toPersianDigits(s: string | number): string {
	return String(s).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)])
}

/** Convert any string to a URL-safe slug. Persian chars preserved where possible. */
export function slugify(input: string): string {
	let s = input.trim().toLowerCase()
	// Map a few common Persian letters to ASCII equivalents for portability.
	s = s
		.replace(/[\u0622\u0623\u0625]/g, 'ا')
		.replace(/\u0629/g, 'ه')
		.replace(/\u064a/g, 'ی')
		.replace(/\u0643/g, 'ک')
	// Strip non word chars (Persian + ASCII letters + digits + dashes).
	s = s.replace(/[^\u0600-\u06FFa-z0-9\s-]/g, '')
	// Replace whitespace with single dash.
	s = s.replace(/\s+/g, '-')
	// Collapse dashes.
	s = s.replace(/-+/g, '-')
	// Trim leading/trailing dashes.
	s = s.replace(/^-+|-+$/g, '')
	return s.slice(0, 80) || 'post'
}

/** Reading time in minutes — ~220 wpm for Persian, ~250 wpm for English. */
export function readingMinutes(markdown: string): number {
	if (!markdown) return 1
	const text = markdown.replace(/```[\s\S]*?```/g, ' ')
	const words = text.split(/\s+/).filter(Boolean).length
	const isFa = /[\u0600-\u06FF]/.test(text)
	const wpm = isFa ? 220 : 250
	return Math.max(1, Math.round(words / wpm))
}

/** Strip Markdown to plain text (for excerpt / SEO description). */
export function stripMarkdown(markdown: string): string {
	const s = markdown
		// Remove code blocks
		.replace(/```[\s\S]*?```/g, ' ')
		// Remove inline code
		.replace(/`([^`]+)`/g, '$1')
		// Remove images
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		// Remove links, keep text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		// Remove headings markers
		.replace(/^#{1,6}\s*/gm, '')
		// Remove bold/italic markers
		.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
		// Remove blockquote markers
		.replace(/^>\s*/gm, '')
		// Remove horizontal rules
		.replace(/^---+$/gm, ' ')
		// Remove list markers
		.replace(/^[\s]*[-*+]\s+/gm, '')
		.replace(/^[\s]*\d+\.\s+/gm, '')
		// Collapse whitespace
		.replace(/\n{2,}/g, '\n')
		.replace(/\s+/g, ' ')
		.trim()
	return s
}

/** Auto-generate excerpt from content if not set (first ~160 chars). */
export function deriveExcerpt(content: string, max = 160): string {
	const text = stripMarkdown(content)
	if (text.length <= max) return text
	// Cut at last space before max.
	const slice = text.slice(0, max)
	const lastSpace = slice.lastIndexOf(' ')
	return slice.slice(0, lastSpace > 60 ? lastSpace : max).trim() + '…'
}

/** Auto-generate SEO title (≤ 60 chars). */
export function deriveSeoTitle(title: string): string {
	return title.length > 60 ? title.slice(0, 57).trim() + '…' : title
}

/** Auto-generate SEO description (≤ 160 chars). */
export function deriveSeoDescription(excerpt: string | null, content: string): string {
	const source = (excerpt && excerpt.trim()) || deriveExcerpt(content)
	return source.length > 160 ? source.slice(0, 157).trim() + '…' : source
}

/** Extract top keywords by frequency, ignoring stop-words. */
export function extractKeywords(text: string, limit = 10): string[] {
	const cleaned = stripMarkdown(text).toLowerCase()
	// Tokenize: Persian + ASCII words, ≥3 chars.
	const tokens = cleaned.match(/[\u0600-\u06FF]{2,}|[a-z]{3,}/g) || []
	const freq = new Map<string, number>()
	for (const tok of tokens) {
		if (STOP_WORDS_FA.has(tok) || STOP_WORDS_EN.has(tok)) continue
		freq.set(tok, (freq.get(tok) ?? 0) + 1)
	}
	return [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([w]) => w)
}

/** Render minimal Markdown → HTML. Safe (escapes user input). */
export function renderMarkdown(markdown: string): string {
	if (!markdown) return ''
	const lines = markdown.split('\n')
	const out: string[] = []
	let inCode = false
	let inList = false
	let inOrdered = false
	let paragraph: string[] = []

	function esc(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function inline(s: string): string {
		let t = esc(s)
		// images
		t = t.replace(
			/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
			(_m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" />`,
		)
		// links
		t = t.replace(
			/\[([^\]]+)\]\(([^)\s]+)\)/g,
			(_m, text, url) =>
				`<a href="${url}" rel="noopener nofollow" target="_blank">${text}</a>`,
		)
		// bold
		t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		// italic
		t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		// inline code
		t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
		return t
	}

	function flushParagraph() {
		if (paragraph.length) {
			out.push(`<p>${inline(paragraph.join(' '))}</p>`)
			paragraph = []
		}
	}
	function closeList() {
		if (inList) {
			out.push(inOrdered ? '</ol>' : '</ul>')
			inList = false
		}
	}

	for (const raw of lines) {
		const line = raw
		// Code fence
		if (line.trim().startsWith('```')) {
			flushParagraph()
			closeList()
			if (inCode) {
				out.push('</code></pre>')
				inCode = false
			} else {
				out.push('<pre><code>')
				inCode = true
			}
			continue
		}
		if (inCode) {
			out.push(esc(line))
			continue
		}
		// Blank line → flush
		if (!line.trim()) {
			flushParagraph()
			closeList()
			continue
		}
		// Heading
		const h = line.match(/^(#{1,6})\s+(.*)$/)
		if (h) {
			flushParagraph()
			closeList()
			const level = h[1].length
			out.push(`<h${level}>${inline(h[2])}</h${level}>`)
			continue
		}
		// Blockquote
		if (line.startsWith('> ')) {
			flushParagraph()
			closeList()
			out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`)
			continue
		}
		// HR
		if (/^---+$/.test(line.trim())) {
			flushParagraph()
			closeList()
			out.push('<hr />')
			continue
		}
		// Ordered list
		const ol = line.match(/^\s*(\d+)\.\s+(.*)$/)
		if (ol) {
			flushParagraph()
			if (!inList || !inOrdered) {
				closeList()
				out.push('<ol>')
				inList = true
				inOrdered = true
			}
			out.push(`<li>${inline(ol[2])}</li>`)
			continue
		}
		// Unordered list
		const ul = line.match(/^\s*[-*+]\s+(.*)$/)
		if (ul) {
			flushParagraph()
			if (!inList || inOrdered) {
				closeList()
				out.push('<ul>')
				inList = true
				inOrdered = false
			}
			out.push(`<li>${inline(ul[1])}</li>`)
			continue
		}
		// Paragraph
		closeList()
		paragraph.push(line)
	}
	flushParagraph()
	closeList()
	if (inCode) out.push('</code></pre>')
	return out.join('\n')
}

export interface SeoAnalysis {
	score: number // 0-100
	checks: { label: string; status: 'pass' | 'warn' | 'fail'; hint?: string }[]
}

/** Run SEO checks on a draft post. Returns a 0-100 score + per-check status. */
export function analyzeSeo(input: {
	title: string
	slug: string
	excerpt: string | null
	content: string
	seoTitle: string | null
	seoDescription: string | null
	seoKeywords: string[]
	coverImage: string | null
}): SeoAnalysis {
	const checks: SeoAnalysis['checks'] = []
	const wordCount = stripMarkdown(input.content).split(/\s+/).filter(Boolean).length

	// Title length 30-60
	if (input.title.length >= 30 && input.title.length <= 60) {
		checks.push({ label: 'عنوان: ۳۰–۶۰ کاراکتر', status: 'pass' })
	} else if (input.title.length > 0) {
		checks.push({
			label: 'عنوان: ۳۰–۶۰ کاراکتر',
			status: 'warn',
			hint: `الان ${input.title.length} کاراکتر`,
		})
	} else {
		checks.push({ label: 'عنوان: ۳۰–۶۰ کاراکتر', status: 'fail' })
	}

	// SEO title
	const st = input.seoTitle ?? input.title
	if (st.length >= 30 && st.length <= 60) {
		checks.push({ label: 'متا عنوان سئو', status: 'pass' })
	} else {
		checks.push({ label: 'متا عنوان سئو', status: 'warn', hint: `${st.length} کاراکتر` })
	}

	// Meta description
	const sd = input.seoDescription ?? deriveSeoDescription(input.excerpt, input.content)
	if (sd.length >= 70 && sd.length <= 160) {
		checks.push({ label: 'متا توضیحات (۷۰–۱۶۰)', status: 'pass' })
	} else if (sd.length > 0) {
		checks.push({
			label: 'متا توضیحات (۷۰–۱۶۰)',
			status: 'warn',
			hint: `${sd.length} کاراکتر`,
		})
	} else {
		checks.push({ label: 'متا توضیحات (۷۰–۱۶۰)', status: 'fail' })
	}

	// Slug
	if (
		input.slug &&
		/^[\u0600-\u06FFa-z0-9-]+$/.test(input.slug) &&
		input.slug.length >= 3
	) {
		checks.push({ label: 'نامک (slug) سالم', status: 'pass' })
	} else {
		checks.push({ label: 'نامک (slug) سالم', status: 'fail' })
	}

	// Word count >= 300
	if (wordCount >= 300) {
		checks.push({ label: `طول محتوا (${wordCount} کلمه)`, status: 'pass' })
	} else if (wordCount >= 150) {
		checks.push({
			label: `طول محتوا (${wordCount} کلمه)`,
			status: 'warn',
			hint: 'حداقل ۳۰۰ کلمه توصیه می‌شود',
		})
	} else {
		checks.push({ label: `طول محتوا (${wordCount} کلمه)`, status: 'fail' })
	}

	// Heading structure
	const h2count = (input.content.match(/^##\s/gm) || []).length
	if (h2count >= 2) {
		checks.push({ label: `زیرعنوان‌ها (${h2count} H2)`, status: 'pass' })
	} else if (h2count >= 1) {
		checks.push({ label: `زیرعنوان‌ها (${h2count} H2)`, status: 'warn' })
	} else {
		checks.push({ label: 'زیرعنوان‌ها', status: 'fail' })
	}

	// Keywords present
	if (input.seoKeywords.length >= 3) {
		checks.push({ label: `کلمات کلیدی (${input.seoKeywords.length})`, status: 'pass' })
	} else if (input.seoKeywords.length > 0) {
		checks.push({ label: `کلمات کلیدی (${input.seoKeywords.length})`, status: 'warn' })
	} else {
		checks.push({ label: 'کلمات کلیدی', status: 'fail' })
	}

	// Cover image
	if (input.coverImage) {
		checks.push({ label: 'تصویر شاخص', status: 'pass' })
	} else {
		checks.push({ label: 'تصویر شاخص', status: 'warn' })
	}

	// Compute score
	const weights = { pass: 1, warn: 0.5, fail: 0 }
	const total = checks.reduce((acc, c) => acc + weights[c.status], 0)
	const score = Math.round((total / checks.length) * 100)
	return { score, checks }
}
