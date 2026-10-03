'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

const REVEAL = '.vg-rv, .vg-rv-group'
/* Everything that loops: demo blocks plus the standalone loops (pill borders,
   button sheens, status pings) that used to run forever, even off-screen. */
const LOOPS = '.vg-anim, .vg-sp, .vg-hp, .vg-sheen, .vg-ping'
const ENTRANCE_MS = 1400
/* Phone motion budget (public site): only the hero keeps looping; any other
   loop plays one cycle the first time it is seen and then rests on its
   finished frame. Pill borders are exempt: a frozen orbit reads as a broken
   outline, and one composited rotation is cheap, so they keep running while
   on screen. The user panel is exempt too: its loops are live data (the
   overview flow, empty states), and a flow that stops after one pass reads
   as frozen. They still pause off-screen and under reduced motion. */
const PHONE = '(max-width: 1023px)'
const HERO = '[data-vg-hero], #dashboard-main'
const PILLS = '.vg-sp, .vg-hp'
const REST_AT = 0.9
const MAX_CYCLE_MS = 14_000
/* Where a loop rests. Sequenced scenes are complete at 90% of their clock;
   sweeps (sheens) and pulses (rings, taps) rest where they are invisible, so
   no highlight or half-faded ring is frozen on screen. */
const REST_OVERRIDES: Record<string, number> = {
	'vg-sheen': 0,
	'vg-sheen-x': 0,
	'vg-ring': 0.999,
	'vg-tap': 0.999,
}

/** A pill border's orbit, which never rests (see PILLS). */
function inPill(animation: Animation): boolean {
	const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null
	return Boolean(target?.closest(PILLS))
}

/** Freeze a block's loops on a readable frame. */
function rest(block: Element) {
	for (const animation of block.getAnimations({ subtree: true })) {
		const timing = animation.effect?.getTiming()
		if (!timing || timing.iterations !== Infinity || typeof timing.duration !== 'number' || inPill(animation)) continue
		const name = 'animationName' in animation ? String(animation.animationName) : ''
		animation.pause()
		animation.currentTime = (timing.delay ?? 0) + timing.duration * (REST_OVERRIDES[name] ?? REST_AT)
	}
	block.classList.add('vg-done')
}

/** Length of the block's longest loop, so the rest lands after one cycle. */
function cycleMs(block: Element): number {
	let longest = 0
	for (const animation of block.getAnimations({ subtree: true })) {
		const timing = animation.effect?.getTiming()
		if (timing?.iterations === Infinity && typeof timing.duration === 'number' && !inPill(animation)) longest = Math.max(longest, timing.duration)
	}
	return Math.min(longest, MAX_CYCLE_MS)
}

/**
 * The public site's single motion controller.
 *
 * 1. Loops: every decorative `.vg-anim` block (and each standalone loop in
 *    LOOPS) starts paused (site.css) and only runs while near the viewport,
 *    so off-screen demos cost no frames. On phones only the hero, the pill
 *    borders and the user panel loop; every other block plays one cycle,
 *    then rests.
 * 2. Entrances: `.vg-rv` blocks and `.vg-rv-group` children fade/rise in the
 *    first time they scroll into view. Content is server-rendered visible;
 *    this effect arms the hidden state (`html.vg-rv-ready`) only after
 *    hydration and only when reduced motion is off, and anything already on
  *    screen is revealed in the same frame, so nothing flashes. Sections that
  *    stream in later (Suspense) are picked up by a MutationObserver.
  *    Older public pages (blog, pricing, legal, status, docs) carry no
  *    `.vg-rv` markup; there the innermost <section>/<article> blocks below
  *    the fold get the same entrance automatically.
  */
export function MotionPauser() {
	const pathname = usePathname()

	// Layout effect: on client-side navigation the new page's on-screen blocks
	// must be marked before the first paint, or they would flash hidden.
	useLayoutEffect(() => {
		const root = document.documentElement
		const supportsIO = 'IntersectionObserver' in window

		// ── Loops ──
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const timers = new Set<number>()
		const once = window.matchMedia(PHONE).matches
		const resting = new WeakSet<Element>()
		const scheduleRest = (block: Element) => {
			if (resting.has(block) || block.matches(PILLS) || block.closest(HERO)) return
			resting.add(block)
			// Measured after `.vg-on` so the block's CSS animations exist.
			const timer = window.setTimeout(() => {
				timers.delete(timer)
				rest(block)
				loops?.unobserve(block)
			}, cycleMs(block) * REST_AT)
			timers.add(timer)
		}
		const loops = supportsIO
			? new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (entry.target.classList.contains('vg-done')) continue
							entry.target.classList.toggle('vg-on', entry.isIntersecting)
							if (entry.isIntersecting && once && !reduce) scheduleRest(entry.target)
						}
					},
					{ rootMargin: '120px 0px' },
				)
			: null

		// ── Entrances ──
		const settle = (element: Element) => {
			const timer = window.setTimeout(() => {
				element.classList.remove('vg-rv', 'vg-rv-group')
				timers.delete(timer)
			}, ENTRANCE_MS)
			timers.add(timer)
		}
		const reveal = (element: Element) => {
			element.classList.add('vg-in')
			settle(element)
		}
		const entrances = supportsIO && !reduce
			? new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (!entry.isIntersecting) continue
							reveal(entry.target)
							entrances?.unobserve(entry.target)
						}
					},
					{ rootMargin: '0px 0px -10% 0px', threshold: 0 },
				)
			: null

		const register = (element: Element) => {
			if (element.matches(LOOPS)) loops?.observe(element)
			if (!element.matches(REVEAL) || element.classList.contains('vg-in')) return
			if (!entrances) {
				element.classList.add('vg-in')
				return
			}
			const rect = element.getBoundingClientRect()
			if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
				element.classList.add('vg-in')
				element.classList.remove('vg-rv', 'vg-rv-group')
				return
			}
			entrances.observe(element)
		}
		const scan = (node: Element | Document) => node.querySelectorAll(`${LOOPS}, ${REVEAL}`).forEach(register)

		if (!supportsIO) document.querySelectorAll(LOOPS).forEach((block) => block.classList.add('vg-on'))
		const main = document.getElementById('marketing-main')
		if (entrances && main && !main.querySelector(REVEAL)) {
			for (const block of Array.from(main.querySelectorAll<HTMLElement>('section, article'))) {
				if (block.querySelector('section, article') || block.closest('.prose')) continue
				const rect = block.getBoundingClientRect()
				if (rect.height > 0 && rect.top >= window.innerHeight * 0.9) block.classList.add('vg-rv')
			}
		}
		scan(document)
		if (entrances) root.classList.add('vg-rv-ready')

		const mutations = new MutationObserver((records) => {
			for (const record of records) {
				record.addedNodes.forEach((node) => {
					if (!(node instanceof Element)) return
					if (node.matches(`${LOOPS}, ${REVEAL}`)) register(node)
					scan(node)
				})
			}
		})
		mutations.observe(document.body, { childList: true, subtree: true })

		return () => {
			loops?.disconnect()
			entrances?.disconnect()
			mutations.disconnect()
			for (const timer of timers) window.clearTimeout(timer)
		}
	}, [pathname])

	return null
}
