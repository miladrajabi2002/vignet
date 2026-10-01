'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, CircleAlert, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProblemView = { num: string; short: string; problem: string; answer: string; gain: string; solution: string; href: string }

/**
 * Desktop problem → answer explorer (phones use a native <details> list).
 * The hero's problem chips link to `#problem-N`; on desktop that selects the
 * matching tab and brings the explorer into view.
 */
export function ProblemPicker({ problems, labels }: { problems: ProblemView[]; labels: { list: string; problem: string; answer: string; related: string; view: string; arrow: ReactNode } }) {
	const [active, setActive] = useState(0)
	const rootRef = useRef<HTMLDivElement>(null)
	const current = problems[active]

	useEffect(() => {
		const sync = () => {
			const match = /^#problem-(\d+)$/.exec(window.location.hash)
			const index = match ? Number(match[1]) : -1
			if (index < 0 || index >= problems.length) return
			setActive(index)
			if (window.matchMedia('(min-width: 1024px)').matches) {
				const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
				rootRef.current?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
			}
		}
		sync()
		window.addEventListener('hashchange', sync)
		return () => window.removeEventListener('hashchange', sync)
	}, [problems.length])

	return (
		<div ref={rootRef} className="flex h-[540px] gap-5">
			<div role="tablist" aria-label={labels.list} aria-orientation="vertical" className="flex w-[500px] shrink-0 flex-col gap-2">
				{problems.map((item, index) => {
					const on = index === active
					return (
						<button
							key={item.short}
							type="button"
							role="tab"
							id={`problem-tab-${index}`}
							aria-selected={on}
							aria-controls="problem-panel"
							onClick={() => setActive(index)}
							className={cn(
								'vg-press flex grow items-center gap-3.5 rounded-card border px-[18px] text-start text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal',
								on ? 'border-vg-ink bg-vg-ink font-bold text-white shadow-[var(--elev-1)]' : 'vg-lift border-vg-line bg-white font-medium text-vg-ink',
							)}
						>
							<span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-chip text-[14px]', on ? 'bg-vg-signal text-white' : 'bg-[#f4f4f5] text-vg-sub')}>{item.num}</span>
							<span className="grow">{item.short}</span>
						</button>
					)
				})}
			</div>
			<div id="problem-panel" role="tabpanel" aria-labelledby={`problem-tab-${active}`} className="vg-dots relative flex grow flex-col overflow-hidden rounded-sheet border border-vg-line bg-white p-[34px]">
				<div className="flex items-center gap-2 text-[13px] font-bold text-[#b91c1c]"><span aria-hidden className="inline-flex size-[26px] items-center justify-center rounded-lg bg-[#fef2f2]"><CircleAlert className="size-3.5" strokeWidth={2} /></span>{labels.problem}</div>
				<p key={`p-${active}`} className="vg-pop mt-2.5 text-[18px] leading-[1.95] text-vg-sub">{current.problem}</p>
				<div className="my-6 h-px bg-vg-line" />
				<div className="flex items-center gap-2 text-[13px] font-bold text-vg-ok"><span aria-hidden className="inline-flex size-[26px] items-center justify-center rounded-lg bg-[#dcfce7]"><Sparkles className="size-3.5" strokeWidth={2} /></span>{labels.answer}</div>
				<p key={`a-${active}`} className="vg-pop mt-2.5 text-[23px] font-bold leading-[1.85] [animation-delay:60ms]">{current.answer}</p>
				<span key={`g-${active}`} className="vg-pop mt-4 inline-flex h-8 items-center gap-1.5 self-start rounded-full bg-[#f0fdf4] px-3 text-[13px] font-medium text-[#166534] [animation-delay:120ms]"><Check aria-hidden className="size-3.5" strokeWidth={2.4} />{current.gain}</span>
				<div className="mt-auto flex items-center justify-between rounded-card bg-vg-tint px-5 py-4">
					<div><div className="text-[12px] text-vg-cap">{labels.related}</div><div className="text-[17px] font-bold">{current.solution}</div></div>
					<Link href={current.href} className="vg-press vg-btn-dark inline-flex h-[46px] items-center gap-2 rounded-control bg-vg-ink px-[18px] text-[14px] font-medium text-white">{labels.view}{labels.arrow}</Link>
				</div>
			</div>
		</div>
	)
}
