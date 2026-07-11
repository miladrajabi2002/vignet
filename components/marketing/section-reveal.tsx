'use client'

import { useEffect } from 'react'

const SELECTOR = '.marketing-story-section'

/** A single observer gives every homepage section the same restrained entrance. */
export function SectionRevealController() {
	useEffect(() => {
		const root = document.documentElement
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (reduce || !('IntersectionObserver' in window)) return

		root.classList.add('marketing-motion-ready')

		const reveal = (section: Element) => section.classList.add('is-visible')
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue
					reveal(entry.target)
					observer.unobserve(entry.target)
				}
			},
			{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
		)

		document.querySelectorAll(SELECTOR).forEach((section) => observer.observe(section))

		return () => {
			observer.disconnect()
			root.classList.remove('marketing-motion-ready')
		}
	}, [])

	return null
}
