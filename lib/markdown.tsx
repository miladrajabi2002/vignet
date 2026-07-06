/**
 * Minimal, safe Markdown renderer (no external deps).
 *
 * Supports the subset an AI assistant realistically emits in a chat bubble:
 *   - **bold** and __bold__
 *   - *italic* and _italic_
 *   - `inline code`
 *   - # / ## / ### headings (rendered as bold paragraphs to avoid layout shift)
 *   - - / * unordered lists
 *   - 1. ordered lists
 *   - line breaks (preserved via the container's whitespace-pre-wrap OR <br>)
 *
 * Everything is returned as React nodes — never uses dangerouslySetInnerHTML,
 * so it is XSS-safe by construction (the browser treats all text as literal).
 */
import React from 'react'

/** Convert a single line of inline markdown into an array of React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = []
	// Regex captures: **bold** | __bold__ | *italic* | _italic_ | `code`
	const re = /(\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*]+?)\*|_([^_]+?)_|`([^`]+?)`)/g
	let last = 0
	let m: RegExpExecArray | null
	let i = 0
	while ((m = re.exec(text)) !== null) {
		if (m.index > last) nodes.push(text.slice(last, m.index))
		const k = `${keyPrefix}-${i++}`
		if (m[2] !== undefined) {
			nodes.push(<strong key={k} className="font-bold">{m[2]}</strong>)
		} else if (m[3] !== undefined) {
			nodes.push(<strong key={k} className="font-bold">{m[3]}</strong>)
		} else if (m[4] !== undefined) {
			nodes.push(<em key={k}>{m[4]}</em>)
		} else if (m[5] !== undefined) {
			nodes.push(<em key={k}>{m[5]}</em>)
		} else if (m[6] !== undefined) {
			nodes.push(
				<code
					key={k}
					className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] font-mono"
				>
					{m[6]}
				</code>,
			)
		}
		last = re.lastIndex
	}
	if (last < text.length) nodes.push(text.slice(last))
	return nodes
}

/** Block-level markdown parser → array of React elements. */
export function Markdown({ children }: { children: string }) {
	const text = typeof children === 'string' ? children : String(children ?? '')
	const lines = text.replace(/\r\n/g, '\n').split('\n')

	const blocks: React.ReactNode[] = []
	let listItems: React.ReactNode[] = []
	let listType: 'ul' | 'ol' | null = null
	let key = 0

	const flushList = () => {
		if (listItems.length === 0) return
		if (listType === 'ol') {
			blocks.push(
				<ol key={`b${key++}`} className="my-1 list-decimal space-y-0.5 ps-5">
					{listItems}
				</ol>,
			)
		} else {
			blocks.push(
				<ul key={`b${key++}`} className="my-1 list-disc space-y-0.5 ps-5">
					{listItems}
				</ul>,
			)
		}
		listItems = []
		listType = null
	}

	for (let idx = 0; idx < lines.length; idx++) {
		const line = lines[idx]
		const trimmed = line.trim()

		// Empty line — flush any open list.
		if (trimmed === '') {
			flushList()
			continue
		}

		// Heading: # / ## / ### / #### / ##### / ######
		const h = trimmed.match(/^(#{1,6})\s+(.+)$/)
		if (h) {
			flushList()
			const level = h[1].length
			const content = renderInline(h[2], `h${key}`)
			const sizeCls =
				level <= 1
					? 'text-[1.05em] font-bold my-1.5'
					: level === 2
						? 'text-[1em] font-bold my-1'
						: 'text-[0.95em] font-semibold my-0.5'
			blocks.push(
				<p key={`b${key++}`} className={sizeCls}>
					{content}
				</p>,
			)
			continue
		}

		// Unordered list item: - / * / •
		const ul = trimmed.match(/^[-*•]\s+(.+)$/)
		if (ul) {
			if (listType && listType !== 'ul') flushList()
			listType = 'ul'
			listItems.push(
				<li key={`li${key++}`}>{renderInline(ul[1], `li${key}`)}</li>,
			)
			continue
		}

		// Ordered list item: 1. / 2. / ...
		const ol = trimmed.match(/^\d+[.)]\s+(.+)$/)
		if (ol) {
			if (listType && listType !== 'ol') flushList()
			listType = 'ol'
			listItems.push(
				<li key={`li${key++}`}>{renderInline(ol[1], `li${key}`)}</li>,
			)
			continue
		}

		// Blockquote: > text
		const bq = trimmed.match(/^>\s?(.*)$/)
		if (bq) {
			flushList()
			blocks.push(
				<p
					key={`b${key++}`}
					className="my-1 border-s-2 border-current/30 ps-3 opacity-90"
				>
					{renderInline(bq[1], `bq${key}`)}
				</p>,
			)
			continue
		}

		// Regular paragraph
		flushList()
		blocks.push(
			<p key={`b${key++}`} className="my-0.5 leading-7">
				{renderInline(trimmed, `p${key}`)}
			</p>,
		)
	}
	flushList()

	return <>{blocks}</>
}

export default Markdown
