'use client'

import { useEffect } from 'react'

const SELECTOR = '.marketing-story-section'

/** A single observer gives every homepage section the same restrained entrance. */
export function SectionRevealController() {
	useEffect(() => {
		const root = document.documentElement
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		root.classList.add('marketing-motion-ready')

		const reveal = (section: Element) => section.classList.add('is-visible')
		const observer = reduce
			? null
			: new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (!entry.isIntersecting) continue
							reveal(entry.target)
							observer?.unobserve(entry.target)
						}
					},
					{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
				)

		const register = (section: Element) => {
			if (reduce) reveal(section)
			else observer?.observe(section)
		}
		document.querySelectorAll(SELECTOR).forEach(register)

		// The demo section replaces a lightweight placeholder when it nears the viewport.
		const mutationObserver = new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (!(node instanceof Element)) continue
					if (node.matches(SELECTOR)) register(node)
					node.querySelectorAll(SELECTOR).forEach(register)
				}
			}
		})
		mutationObserver.observe(document.body, { childList: true, subtree: true })

		return () => {
			observer?.disconnect()
			mutationObserver.disconnect()
			root.classList.remove('marketing-motion-ready')
		}
	}, [])

	return null
}
