'use client'

import { useEffect } from 'react'
import { useSitePathname } from './use-site-pathname'

/* While set on <html>, every `.vg-cv` section lays out at its real height
   (site.css). */
const REVEAL_CLASS = 'vg-cv-all'
const RELEASE_MS = 1500

let release = 0

/** Scroll to `#id` with every section at its real height. False if no such id. */
function jumpTo(hash: string, smooth: boolean): boolean {
	const id = decodeURIComponent(hash.replace(/^#/, ''))
	const target = id ? document.getElementById(id) : null
	if (!target) return false
	const root = document.documentElement
	root.classList.add(REVEAL_CLASS)
	void root.offsetHeight // apply the real heights before measuring
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
	target.scrollIntoView({ block: 'start', behavior: smooth && !reduced ? 'smooth' : 'auto' })
	window.clearTimeout(release)
	release = window.setTimeout(() => root.classList.remove(REVEAL_CLASS), RELEASE_MS)
	return true
}

/**
 * In-page jumps (#pricing, #capabilities…) that land on the right section the
 * first time.
 *
 * `.vg-cv` sections use `content-visibility:auto`, so a section that has never
 * been on screen counts as a 900px placeholder. The first jump to #pricing
 * was measured against those placeholders and stopped inside "راه‌اندازی در
 * ۵ قدم"; the second worked because the browser had remembered the real
 * heights by then. Before each jump this lays every section out once, scrolls,
 * and then hands the sections back to content-visibility — `auto` in
 * contain-intrinsic-size keeps the measured heights, so nothing shifts later.
 */
export function HashScroll() {
	const pathname = useSitePathname()

	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
			const anchor = (event.target as Element | null)?.closest?.('a[href*="#"]')
			if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return
			const url = new URL(anchor.href, window.location.href)
			const samePage =
				url.origin === window.location.origin &&
				url.pathname.replace(/\/$/, '') === window.location.pathname.replace(/\/$/, '')
			if (!samePage || !url.hash || !jumpTo(url.hash, true)) return
			// Next's <Link> skips its own navigation once the click is prevented.
			event.preventDefault()
			if (url.hash !== window.location.hash) window.history.pushState(window.history.state, '', url.hash)
		}
		const onHashChange = () => jumpTo(window.location.hash, false)

		document.addEventListener('click', onClick, true)
		window.addEventListener('hashchange', onHashChange)
		return () => {
			document.removeEventListener('click', onClick, true)
			window.removeEventListener('hashchange', onHashChange)
			window.clearTimeout(release)
			document.documentElement.classList.remove(REVEAL_CLASS)
		}
	}, [])

	// Arriving with a hash (a direct link, or /#pricing from another page): the
	// browser's own jump used the placeholders too, so correct it once.
	useEffect(() => {
		if (window.location.hash) jumpTo(window.location.hash, false)
	}, [pathname])

	return null
}
