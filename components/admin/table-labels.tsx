'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Responsive table pattern (ط۱۵). On phones `.ui-rtable` stacks every row
 * into a card and prints each cell's column name before its value (CSS in
 * app/ui-system.css). The column names come from the table's own <th> row,
 * copied onto each cell as `data-label` after mount, so existing tables
 * need no markup changes.
 */
export function TableLabels({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)

	useLayoutEffect(() => {
		const root = ref.current
		if (!root) return
		const label = () => {
			const table = root.querySelector('table')
			if (!table) return
			const heads = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '')
			table.querySelectorAll('tbody tr').forEach((row) => {
				Array.from(row.children).forEach((cell, index) => {
					const name = heads[index]
					if (name && !cell.hasAttribute('data-label')) cell.setAttribute('data-label', name)
				})
			})
		}
		label()
		const observer = new MutationObserver(label)
		observer.observe(root, { childList: true, subtree: true })
		return () => observer.disconnect()
	}, [])

	return <div ref={ref} className="contents">{children}</div>
}
