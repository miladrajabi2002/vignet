'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject, type TouchEvent } from 'react'
import { cn } from '@/lib/utils'

/*
 * The moving parts of the capabilities section. The scenes themselves are
 * server-rendered CSS timelines (capability-scenes.tsx); this file only
 * decides when one plays:
 * - ReplayGrid (desktop bento) rewinds each card's timeline every PERIOD
 *   while the grid is on screen (MotionPauser's `.vg-on`).
 * - KeyStage / QuietStage (phones) show one scene at a time. A CSS progress
 *   bar times each step and its `animationend` advances the stage, so there
 *   is no timer: off-screen the stage holds (`.cap-run[data-run='0']`), and
 *   under reduced motion nothing animates, so nothing advances. Auto-advance
 *   rests after one lap; a tap starts a new lap.
 */

const PERIOD = 9600
const TICK = 300
const STAGGER = 350

/** Rewinds every card's scene ([data-replay]) once per PERIOD while the grid is visible. */
export function ReplayGrid({ className, children }: { className?: string; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const grid = ref.current
		if (!grid || typeof grid.getAnimations !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-replay]'))
		const elapsed = cards.map((_, i) => -i * STAGGER)
		const timer = window.setInterval(() => {
			if (document.hidden || !grid.classList.contains('vg-on')) return
			cards.forEach((card, i) => {
				elapsed[i] += TICK
				if (elapsed[i] < PERIOD) return
				elapsed[i] = 0
				// The checkout card alternates between its two payment paths.
				if (card.dataset.replay === 'alt') card.dataset.alt = card.dataset.alt === '1' ? '0' : '1'
				for (const animation of card.getAnimations({ subtree: true })) animation.currentTime = 0
			})
		}, TICK)
		return () => window.clearInterval(timer)
	}, [])
	return <div ref={ref} className={className}>{children}</div>
}

/** Marks the stage running only while it is near the viewport. */
function useRunWhileVisible(ref: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		const stage = ref.current
		if (!stage) return
		if (!('IntersectionObserver' in window)) {
			stage.dataset.run = '1'
			return
		}
		const observer = new IntersectionObserver(([entry]) => {
			stage.dataset.run = entry.isIntersecting ? '1' : '0'
		}, { rootMargin: '80px 0px' })
		observer.observe(stage)
		return () => observer.disconnect()
	}, [ref])
}

/** Auto-advance through `count` steps; one lap, then rest until the next tap. */
function useStepper(count: number) {
	const [index, setIndex] = useState(0)
	const [auto, setAuto] = useState(true)
	const played = useRef(0)
	const go = (next: number, byUser = false) => {
		setIndex(((next % count) + count) % count)
		if (byUser) {
			played.current = 0
			setAuto(true)
		}
	}
	const advance = () => {
		played.current += 1
		if (played.current >= count) setAuto(false)
		else go(index + 1)
	}
	return { index, auto, go, advance }
}

/** Swipe toward the reading direction for the next step. */
function useSwipe(ref: RefObject<HTMLDivElement | null>, onStep: (delta: 1 | -1) => void) {
	const startX = useRef<number | null>(null)
	return {
		onTouchStart: (event: TouchEvent) => {
			startX.current = event.touches[0].clientX
		},
		onTouchEnd: (event: TouchEvent) => {
			if (startX.current === null) return
			const dx = event.changedTouches[0].clientX - startX.current
			startX.current = null
			if (Math.abs(dx) < 50) return
			const rtl = ref.current ? getComputedStyle(ref.current).direction === 'rtl' : true
			onStep((dx > 0) === rtl ? 1 : -1)
		},
	}
}

function ProgressBar({ step, auto, duration, onEnd }: { step: number; auto: boolean; duration: string; onEnd: () => void }) {
	return (
		<i aria-hidden className="cap-pbar">
			<b key={step} className={auto ? 'cap-pbar-run' : undefined} style={{ '--dur': duration } as CSSProperties} onAnimationEnd={onEnd} />
		</i>
	)
}

export type StageEntry = { chip: number; title: string; text: string; badge?: string; scene: ReactNode }
export type StageCategory = { name: string; meta: string; icon: ReactNode; chips: { label: string; icon: ReactNode }[]; entries: StageEntry[] }

/** Phones: four category buttons over one live scene; the category's capabilities sit in one row of chips. */
export function KeyStage({ categories, className }: { categories: StageCategory[]; className?: string }) {
	const steps = useMemo(() => categories.flatMap((category, c) => category.entries.map((entry) => ({ c, entry }))), [categories])
	const { index, auto, go, advance } = useStepper(steps.length)
	const root = useRef<HTMLDivElement>(null)
	useRunWhileVisible(root)
	const swipe = useSwipe(root, (delta) => go(index + delta, true))
	const current = steps[index]
	const category = categories[current.c]
	const first = (match: (step: (typeof steps)[number]) => boolean) => steps.findIndex(match)

	return (
		<div ref={root} data-run="0" className={cn('cap-run flex flex-col gap-2.5', className)}>
			<div className="grid grid-cols-4 gap-1.5">
				{categories.map((item, c) => {
					const on = c === current.c
					return (
						<button
							key={item.name}
							type="button"
							aria-pressed={on}
							onClick={() => go(first((step) => step.c === c), true)}
							className={cn('vg-press flex flex-col items-center gap-px rounded-[14px] border px-0.5 pb-1.5 pt-2 text-[12.5px] font-bold', on ? 'border-vg-ink bg-vg-ink text-white' : 'border-vg-line bg-white text-vg-ink')}
						>
							<span aria-hidden className={cn('mb-0.5', on ? 'text-[#b9adff]' : 'text-vg-signal')}>{item.icon}</span>
							{item.name}
							<span className={cn('text-[10px] font-medium', on ? 'text-[#a1a1aa]' : 'text-vg-dim')}>{item.meta}</span>
						</button>
					)
				})}
			</div>
			<div className="vg-lift flex touch-pan-y flex-col gap-2.5 rounded-[22px] border border-vg-line bg-white p-2" {...swipe}>
				{steps.map((step, i) => <div key={i} hidden={i !== index}>{step.entry.scene}</div>)}
				<div key={index} className="cap-swap min-h-[80px] px-1.5">
					<h3 className="flex flex-wrap items-center gap-1.5 text-[16px] font-bold leading-[1.6]">
						{current.entry.title}
						{current.entry.badge ? <span className="rounded-full bg-vg-signal px-2 text-[11px] font-medium leading-5 text-white">{current.entry.badge}</span> : null}
					</h3>
					<p className="mt-0.5 text-[13px] leading-[1.85] text-vg-sub">{current.entry.text}</p>
				</div>
				<div className="flex gap-[5px] px-1 pb-1">
					{category.chips.map((chip, k) => {
						const on = k === current.entry.chip
						return (
							<button
								key={chip.label}
								type="button"
								aria-pressed={on}
								onClick={() => go(first((step) => step.c === current.c && step.entry.chip === k), true)}
								className={cn('vg-press relative flex h-8 min-w-0 flex-auto items-center justify-center gap-[5px] overflow-hidden rounded-[10px] px-2 text-[12px]', on ? 'bg-vg-tint font-semibold text-[#4c2fd0]' : 'bg-vg-bg text-vg-sub')}
							>
								<span aria-hidden className="shrink-0">{chip.icon}</span>
								<span className="truncate">{chip.label}</span>
								{on ? <ProgressBar step={index} auto={auto} duration="6.4s" onEnd={advance} /> : null}
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}

export type QuietItem = { id: string; title: string; text: string; icon: ReactNode; scene: ReactNode }

/** Phones: each group drifts by as a row of pills; the card below plays one capability at a time. */
export function QuietStage({ groups, className }: { groups: { name: string; items: QuietItem[] }[]; className?: string }) {
	const steps = useMemo(() => groups.flatMap((group, g) => group.items.map((item) => ({ g, item }))), [groups])
	const { index, auto, go, advance } = useStepper(steps.length)
	const root = useRef<HTMLDivElement>(null)
	useRunWhileVisible(root)
	const current = steps[index]

	return (
		<div ref={root} data-run="0" className={cn('cap-run flex flex-col gap-3', className)}>
			<div className="-mx-4 flex flex-col gap-2 sm:-mx-6">
				{groups.map((group, g) => (
					<div key={group.name} className="cap-mq">
						<div className={cn('cap-mq-t', g % 2 === 1 && 'cap-mq-rev')} style={{ '--dur': `${46 + g * 8}s` } as CSSProperties}>
							{[false, true].map((duplicate) => (
								<div key={String(duplicate)} aria-hidden={duplicate || undefined} className={cn('flex gap-2 pe-2', duplicate && 'cap-mq-dup')}>
									{group.items.map((item) => {
										const on = item.id === current.item.id
										return (
											<button
												key={item.id}
												type="button"
												tabIndex={duplicate ? -1 : undefined}
												aria-pressed={duplicate ? undefined : on}
												onClick={() => go(steps.findIndex((step) => step.item.id === item.id), true)}
												className={cn('vg-press inline-flex h-[42px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border pe-3.5 ps-4 text-[13.5px] font-semibold', on ? 'border-vg-ink bg-vg-ink text-white' : 'border-vg-line bg-white text-vg-ink')}
											>
												<span aria-hidden className={on ? 'text-[#b9adff]' : 'text-vg-signal'}>{item.icon}</span>
												{item.title}
											</button>
										)
									})}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
			<div className="vg-lift relative overflow-hidden rounded-[22px] border border-vg-line bg-white p-2 md:mx-auto md:w-full md:max-w-[560px]">
				{steps.map((step, i) => <div key={step.item.id} hidden={i !== index}>{step.item.scene}</div>)}
				<div key={index} className="cap-swap px-1.5 pb-2.5 pt-2">
					<span className="block text-[11.5px] font-bold text-vg-signal">{groups[current.g].name}</span>
					<h4 className="text-[15px] font-bold leading-[1.6]">{current.item.title}</h4>
					<p className="mt-0.5 text-[13px] leading-[1.85] text-vg-sub">{current.item.text}</p>
				</div>
				<ProgressBar step={index} auto={auto} duration="5s" onEnd={advance} />
			</div>
		</div>
	)
}
