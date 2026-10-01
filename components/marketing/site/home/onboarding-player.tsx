'use client'

import { Children, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, MessageSquare, Pause, Play, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PlayerStep = { num: string; title: string; duration: string; eyebrow: string; desc: string; result: string; path: string }
export type PlayerLabels = { tabs: string; goal: string; result: string; clockNote: string; clockLabel: string; prev: string; next: string; pause: string; play: string; pauseShort: string; playShort: string }

/**
 * One beat per step. `secs` is the real setup time the header clock adds up;
 * `cues[n]` is when the scene gains class `c{n+1}` (onboarding.css holds what
 * each one means); `cursor` glides the demo pointer to the scene's
 * `[data-ob-target]` and taps it; `typing` types the scene's `[data-ob-typed]`.
 */
type Beat = { dur: number; secs: number; cues: number[]; cursor?: { show: number; move: number; tap: number; hide: number }; typing?: { from: number; to: number } }
const TIMELINE: Beat[] = [
	{ dur: 5600, secs: 30, cues: [300, 1000, 1280, 1560, 1840, 2120, 3000, 3700, 4050], cursor: { show: 2150, move: 2250, tap: 2800, hide: 3350 } },
	{ dur: 5400, secs: 60, cues: [1300, 1900, 2250, 2450, 2650], cursor: { show: 350, move: 450, tap: 1150, hide: 1750 } },
	{ dur: 7200, secs: 120, cues: [2800, 3300, 3650, 4150, 5000], typing: { from: 450, to: 2500 } },
	{ dur: 7200, secs: 120, cues: [300, 700, 1100, 1500, 2300, 3200, 3800, 4600] },
	{ dur: 8200, secs: 60, cues: [1100, 1900, 2500, 3300, 4500, 5100, 5900, 6300], cursor: { show: 300, move: 400, tap: 950, hide: 1500 } },
]
const LAST = TIMELINE.length - 1
const GOAL_AT = 6300
const TAP_MS = 450
const QUICK_TAP_MS = 260
const BEFORE = TIMELINE.map((_, index) => TIMELINE.slice(0, index).reduce((sum, beat) => sum + beat.secs, 0))
/* Phone motion budget (see MotionPauser): one full run, then rest. */
const PHONE = '(max-width: 1023px)'

const clockText = (seconds: number, fa: boolean) => {
	const text = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
	return fa ? text.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : text
}

type Api = { jump: (index: number) => void; step: (delta: number) => void; toggle: () => void; hold: (on: boolean) => void }

/**
 * The setup walkthrough as a player. All copy and every scene (the children,
 * one per step) arrive server rendered (inactive steps stay in the DOM, just hidden); this island owns
 * the active step and a per-step clock. Scene state is a pure function of
 * that clock, so jumping, replaying and reduced motion (each step shown on
 * its final frame, no autoplay) share one code path. The clock only runs
 * while the player is on screen.
 */
export function OnboardingPlayer({ fa, steps, intro, typed, labels, children }: { fa: boolean; steps: PlayerStep[]; intro: ReactNode; typed: string; labels: PlayerLabels; children: ReactNode }) {
	const [active, setActive] = useState(0)
	const [stopped, setStopped] = useState(false)
	const playerRef = useRef<HTMLDivElement>(null)
	const clockRef = useRef<HTMLElement>(null)
	const api = useRef<Api | null>(null)
	const downAt = useRef(0)

	useEffect(() => {
		const player = playerRef.current
		if (!player) return
		const sceneEls = Array.from(player.querySelectorAll<HTMLElement>('.ob-scene'))
		const fills = Array.from(player.querySelectorAll<HTMLElement>('.ob-fill'))
		const goal = player.querySelector('.ob-goal')
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
		const phone = window.matchMedia(PHONE)
		const placed = new Map<Element, string>()
		let step = 0
		let t = 0
		let last = 0
		let raf = 0
		let typedCount = -1
		let visible = !('IntersectionObserver' in window)
		let held = false
		let userPaused = false
		const running = () => visible && !held && !userPaused && !reduce.matches

		const apply = () => {
			const beat = TIMELINE[step]
			const scene = sceneEls[step]
			if (!scene) return
			beat.cues.forEach((at, index) => scene.classList.toggle(`c${index + 1}`, t >= at))
			if (beat.typing) {
				const target = scene.querySelector('[data-ob-typed]')
				const count = Math.round(typed.length * Math.min(1, Math.max(0, (t - beat.typing.from) / (beat.typing.to - beat.typing.from))))
				if (target && count !== typedCount) {
					target.textContent = typed.slice(0, count)
					typedCount = count
				}
				scene.classList.toggle('typing', t < beat.typing.to + 250)
			}
			const cursor = scene.querySelector<HTMLElement>('.vg-cur')
			if (beat.cursor && cursor) {
				const moved = t >= beat.cursor.move
				const key = `${moved}|${scene.offsetWidth}`
				if (placed.get(cursor) !== key) {
					placed.set(cursor, key)
					const box = scene.getBoundingClientRect()
					const rect = moved ? scene.querySelector('[data-ob-target]')?.getBoundingClientRect() : undefined
					const x = rect ? rect.left - box.left + rect.width / 2 : box.width / 2
					const y = rect ? rect.top - box.top + rect.height * 0.62 : box.height + 24
					cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
				}
				cursor.classList.toggle('show', t >= beat.cursor.show && t < beat.cursor.hide)
				cursor.classList.toggle('tap', t >= beat.cursor.tap && t < beat.cursor.tap + TAP_MS)
			}
		}

		const render = () => {
			const beat = TIMELINE[step]
			const progress = Math.min(1, t / beat.dur)
			apply()
			if (fills[step]) fills[step].style.transform = `scaleX(${progress.toFixed(4)})`
			goal?.classList.toggle('live', step === LAST && t >= GOAL_AT)
			const text = clockText(Math.round(BEFORE[step] + beat.secs * progress), fa)
			if (clockRef.current && clockRef.current.textContent !== text) clockRef.current.textContent = text
		}

		const go = (index: number) => {
			step = (index + TIMELINE.length) % TIMELINE.length
			t = reduce.matches ? TIMELINE[step].dur : 0
			typedCount = -1
			const scene = sceneEls[step]
			if (scene) {
				// Rewind the scene without animating its way back.
				scene.classList.add('reset')
				placed.clear()
				apply()
				void scene.offsetWidth
				if (!reduce.matches) scene.classList.remove('reset')
			}
			fills.forEach((fill, index) => { fill.style.transform = `scaleX(${index < step ? 1 : 0})` })
			setActive(step)
			render()
		}

		const frame = (now: number) => {
			raf = 0
			if (!running()) return
			t += Math.min(now - last, 64)
			last = now
			if (t < TIMELINE[step].dur) render()
			else if (step === LAST && phone.matches) {
				t = TIMELINE[step].dur
				userPaused = true
				render()
				sync()
				return
			} else go(step + 1)
			raf = window.requestAnimationFrame(frame)
		}
		const sync = () => {
			player.classList.toggle('is-paused', !running())
			setStopped(userPaused || reduce.matches)
			if (running() && !raf) {
				last = performance.now()
				raf = window.requestAnimationFrame(frame)
			}
		}

		const jump = (index: number) => {
			userPaused = false
			go(index)
			sync()
		}
		api.current = {
			jump,
			step: (delta) => jump(step + delta),
			toggle: () => {
				if (reduce.matches) return
				userPaused = !userPaused
				if (!userPaused && t >= TIMELINE[step].dur) go(step + 1)
				sync()
			},
			hold: (on) => {
				held = on
				sync()
			},
		}

		const observer = 'IntersectionObserver' in window
			? new IntersectionObserver((entries) => {
					visible = entries.some((entry) => entry.isIntersecting)
					sync()
				}, { threshold: 0.15 })
			: null
		observer?.observe(player)
		const resize = 'ResizeObserver' in window ? new ResizeObserver(() => render()) : null
		resize?.observe(player)
		const onReduce = () => {
			go(step)
			sync()
		}
		reduce.addEventListener('change', onReduce)
		go(0)
		sync()

		return () => {
			api.current = null
			observer?.disconnect()
			resize?.disconnect()
			reduce.removeEventListener('change', onReduce)
			if (raf) window.cancelAnimationFrame(raf)
		}
	}, [fa, typed])

	const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
		const forward = fa ? 'ArrowLeft' : 'ArrowRight'
		const back = fa ? 'ArrowRight' : 'ArrowLeft'
		const delta = event.key === forward || event.key === 'ArrowDown' ? 1 : event.key === back || event.key === 'ArrowUp' ? -1 : 0
		if (!delta) return
		event.preventDefault()
		api.current?.step(delta)
		const next = (active + delta + steps.length) % steps.length
		playerRef.current?.querySelector<HTMLElement>(`#ob-tab-${next}`)?.focus()
	}

	// Stage halves: a quick tap changes the step, holding pauses (story-style).
	const zone = (delta: number) => ({
		onPointerDown: () => {
			downAt.current = performance.now()
			api.current?.hold(true)
		},
		onPointerUp: () => {
			if (!downAt.current) return
			const quick = performance.now() - downAt.current < QUICK_TAP_MS
			downAt.current = 0
			api.current?.hold(false)
			if (quick) api.current?.step(delta)
		},
		onPointerCancel: () => {
			downAt.current = 0
			api.current?.hold(false)
		},
		onPointerLeave: () => {
			if (!downAt.current) return
			downAt.current = 0
			api.current?.hold(false)
		},
	})

	return (
		<div className="vg-ob">
			<div className="vg-rv flex flex-col items-center gap-3.5 text-center lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:text-start">
				{intro}
				<div className="ob-clock" role="img" aria-label={labels.clockLabel}>
					<Timer aria-hidden strokeWidth={1.8} />
					<b ref={clockRef} dir="ltr">{clockText(0, fa)}</b>
					<span>{labels.clockNote}</span>
				</div>
			</div>

			<div ref={playerRef} className="ob-player vg-rv">
				<div className="ob-rail" role="tablist" aria-label={labels.tabs}>
					{steps.map((step, index) => (
						<button
							key={step.title}
							type="button"
							role="tab"
							id={`ob-tab-${index}`}
							aria-selected={index === active}
							aria-controls="ob-panel"
							tabIndex={index === active ? 0 : -1}
							onClick={() => api.current?.jump(index)}
							onKeyDown={onTabKey}
							className={cn('ob-node', index < active && 'done', index === active && 'on')}
						>
							<span className="ob-dot"><span className="ob-num">{step.num}</span><Check aria-hidden strokeWidth={2.4} /></span>
							<span className="ob-track"><span className="ob-fill" /></span>
							<span className="ob-lbl"><b>{step.title}</b><small>{step.duration}</small></span>
						</button>
					))}
					<span className="ob-goal" aria-hidden>
						<span className="ob-dot"><MessageSquare strokeWidth={1.8} /></span>
						<span className="ob-lbl"><b>{labels.goal}</b></span>
					</span>
				</div>

				<div className="ob-heads">
					{steps.map((step, index) => (
						<div key={step.title} className={cn('ob-head', index === active && 'on')}>
							<span className="ob-eyebrow">{step.eyebrow}</span>
							<h3>{step.title}</h3>
						</div>
					))}
				</div>

				<div className="ob-ctrl">
					<button type="button" className="ob-cb nav vg-press" aria-label={labels.prev} onClick={() => api.current?.step(-1)}><ChevronLeft aria-hidden className="rtl:rotate-180" strokeWidth={1.8} /></button>
					<button type="button" className="ob-cb pp vg-press" aria-label={stopped ? labels.play : labels.pause} onClick={() => api.current?.toggle()}>
						{stopped ? <Play aria-hidden fill="currentColor" strokeWidth={1.2} /> : <Pause aria-hidden fill="currentColor" strokeWidth={1.2} />}
						<span>{stopped ? labels.playShort : labels.pauseShort}</span>
					</button>
					<button type="button" className="ob-cb nav vg-press" aria-label={labels.next} onClick={() => api.current?.step(1)}><ChevronRight aria-hidden className="rtl:rotate-180" strokeWidth={1.8} /></button>
				</div>

				<div className="ob-stage">
					<div className="ob-win" aria-hidden>
						<div className="ob-bar" dir="ltr">
							<span className="ob-bar-dots"><i /><i /><i /></span>
							<span className="ob-url">vigent.ir/{steps[active].path}</span>
						</div>
						<div className="ob-scenes">
							{Children.map(children, (scene, index) => <div className={cn('ob-slot', index === active && 'on')}>{scene}</div>)}
						</div>
						<button type="button" tabIndex={-1} className="ob-zone prev" {...zone(-1)} />
						<button type="button" tabIndex={-1} className="ob-zone next" {...zone(1)} />
					</div>
				</div>

				<div id="ob-panel" role="tabpanel" aria-labelledby={`ob-tab-${active}`} className="ob-bodies">
					{steps.map((step, index) => (
						<div key={step.title} className={cn('ob-body', index === active && 'on')}>
							<p>{step.desc}</p>
							<div className="ob-result">
								<span className="ob-result-ck"><Check aria-hidden strokeWidth={2.6} /></span>
								<span><small>{labels.result}</small>{step.result}</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
