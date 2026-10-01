'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StepperStep = { num: string; title: string; duration: string; desc: string; result: string; path: string }

const INTERVAL = 4200

/**
 * Desktop-only interactive setup walkthrough. Every step's text is server
 * rendered (inactive descriptions stay in the DOM, just hidden); the preview
 * panels arrive pre-rendered from the server, so this island only owns the
 * active index. Autoplay runs only while visible on a desktop viewport and
 * never under prefers-reduced-motion; picking a step restarts the timer.
 */
export function OnboardingStepper({ steps, panels, label }: { steps: StepperStep[]; panels: ReactNode[]; label: string }) {
	const [active, setActive] = useState(0)
	const [cycle, setCycle] = useState(0)
	const [running, setRunning] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const root = rootRef.current
		if (!root) return
		const desktop = window.matchMedia('(min-width: 1024px)')
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
		let visible = false
		const sync = () => setRunning(visible && desktop.matches && !reduce.matches)
		const observer = new IntersectionObserver((entries) => {
			visible = entries.some((entry) => entry.isIntersecting)
			sync()
		})
		observer.observe(root)
		desktop.addEventListener('change', sync)
		reduce.addEventListener('change', sync)
		return () => {
			observer.disconnect()
			desktop.removeEventListener('change', sync)
			reduce.removeEventListener('change', sync)
		}
	}, [])

	useEffect(() => {
		if (!running) return
		const timer = window.setTimeout(() => setActive((current) => (current + 1) % steps.length), INTERVAL)
		return () => window.clearTimeout(timer)
	}, [running, active, cycle, steps.length])

	const pick = (index: number) => {
		setActive(index)
		setCycle((value) => value + 1)
	}

	return (
		<div ref={rootRef} className="flex min-h-[560px] gap-5">
			<div role="tablist" aria-label={label} aria-orientation="vertical" className="flex w-[440px] shrink-0 flex-col gap-2">
				{steps.map((step, index) => {
					const on = index === active
					return (
						<button
							key={step.title}
							type="button"
							role="tab"
							id={`ob-tab-${index}`}
							aria-selected={on}
							aria-controls="ob-panel"
							onClick={() => pick(index)}
							className={cn(
								'vg-press block w-full shrink-0 rounded-card border px-5 text-start text-vg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal',
								on ? 'border-black/[0.12] bg-white py-[18px] shadow-[var(--elev-2)]' : 'border-transparent bg-transparent py-3.5 text-[#3f3f46] hover:bg-white/60',
							)}
						>
							<span className="flex w-full items-center gap-3.5">
								<span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold', on ? 'bg-vg-signal text-white' : 'border border-black/10 bg-white text-vg-sub')}>{step.num}</span>
								<span className="grow text-[16px] font-bold">{step.title}</span>
								<span className={cn('shrink-0 text-[12px]', on ? 'rounded-full bg-vg-tint px-2.5 py-1 font-medium text-[#4c2fd0]' : 'text-vg-cap')}>{step.duration}</span>
							</span>
							<span hidden={!on}>
								<span className={cn('mt-2 block ps-[50px] text-[14px] font-normal leading-[1.9] text-vg-sub', on && 'vg-pop')}>{step.desc}</span>
								<span className={cn('mt-2.5 inline-flex items-center gap-1.5 ps-[50px] text-[13px] font-medium text-vg-ok', on && 'vg-pop')}>
									<Check aria-hidden className="size-3.5" strokeWidth={2.4} />
									{step.result}
								</span>
								<span aria-hidden className="mt-3.5 block h-[3px] overflow-hidden rounded-[3px] bg-black/[0.07]">
									{on && running ? <span key={`${active}-${cycle}`} className="vg-obfill block h-full bg-vg-signal" /> : null}
								</span>
							</span>
						</button>
					)
				})}
			</div>

			<div className="vg-dots relative flex grow items-center justify-center overflow-hidden rounded-sheet border border-vg-line bg-white p-7">
				<div aria-hidden className="pointer-events-none absolute -bottom-[180px] left-[120px] h-[360px] w-[500px] rounded-[50%] bg-[radial-gradient(closest-side,rgba(199,189,240,0.4),rgba(255,255,255,0))]" />
				<div id="ob-panel" role="tabpanel" aria-labelledby={`ob-tab-${active}`} className="relative w-full max-w-[600px] overflow-hidden rounded-card border border-black/10 bg-white shadow-[var(--elev-2)]">
					<div className="flex h-10 items-center gap-3 border-b border-black/[0.06] bg-vg-bg px-3.5" aria-hidden>
						<span dir="ltr" className="inline-flex gap-1.5">{[0, 1, 2].map((dot) => <span key={dot} className="size-2.5 rounded-full bg-[#e4e4e7]" />)}</span>
						<span dir="ltr" className="grow text-center text-[12px] text-vg-cap">vigent.ir/{steps[active].path}</span>
					</div>
					<div key={active} className="flex h-[380px] flex-col p-7">{panels[active]}</div>
				</div>
			</div>
		</div>
	)
}
