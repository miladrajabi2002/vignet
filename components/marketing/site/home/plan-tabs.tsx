'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PlanLimit = { label: string; value: string; unit?: string }
export type PlanView = { id: string; name: string; audience: string; price: string; unit: string; limits: PlanLimit[]; limitsLabel: string; all: string; href: string; cta: string; recommended: boolean; badge: string }

/**
 * Plan limits as a label/value table. Every plan has every feature; only these
 * numbers differ, so they are bold and aligned for a quick side-by-side read.
 */
export function PlanLimits({ plan }: { plan: PlanView }) {
	return (
		<div className="w-full text-start">
			<p className="text-[12px] font-medium text-vg-cap">{plan.limitsLabel}</p>
			<dl className="mt-1.5 divide-y divide-black/[0.06] border-y border-black/[0.08]">
				{plan.limits.map((row) => (
					<div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
						<dt className="text-[14px] text-vg-sub">{row.label}</dt>
						<dd className="whitespace-nowrap text-[15px] font-bold tabular-nums">
							{row.value}
							{row.unit ? <span className="ms-1 text-[12px] font-normal text-vg-cap">{row.unit}</span> : null}
						</dd>
					</div>
				))}
			</dl>
			<p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-vg-signal">
				<Check aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
				{plan.all}
			</p>
		</div>
	)
}

/** Phone pricing: one plan at a time behind a segmented control (Pro first). */
export function PlanTabs({ plans, label }: { plans: PlanView[]; label: string }) {
	const [active, setActive] = useState(Math.max(0, plans.findIndex((plan) => plan.recommended)))
	const plan = plans[active]
	return (
		<div className="w-full">
			<div role="tablist" aria-label={label} className="grid grid-cols-3 gap-1 rounded-2xl bg-black/5 p-1">
				{plans.map((item, index) => {
					const on = index === active
					return (
						<button
							key={item.id}
							type="button"
							role="tab"
							id={`plan-tab-${item.id}`}
							aria-selected={on}
							aria-controls="plan-panel"
							onClick={() => setActive(index)}
							className={cn('vg-press min-h-11 rounded-xl text-[13px] font-bold', on ? 'bg-white text-vg-ink shadow-[var(--elev-1)]' : 'text-vg-sub')}
						>
							{item.name}
						</button>
					)
				})}
			</div>
			<div
				key={plan.id}
				id="plan-panel"
				role="tabpanel"
				aria-labelledby={`plan-tab-${plan.id}`}
				className="vg-pop mt-3 flex flex-col items-center rounded-card border border-black/10 bg-white px-[18px] py-6 shadow-[var(--elev-2)]"
			>
				{plan.recommended ? <span className="mb-2.5 rounded-full bg-vg-signal px-3 py-1 text-[12px] font-medium text-white">{plan.badge}</span> : null}
				<h3 className="text-[20px] font-bold">{plan.name}</h3>
				<p className="mt-1 text-[13px] leading-[1.9] text-vg-cap">{plan.audience}</p>
				<p className="mt-4 flex items-baseline gap-1.5"><span className="text-[34px] font-bold tabular-nums">{plan.price}</span><span className="text-[13px] text-vg-cap">{plan.unit}</span></p>
				<div className="mt-4 w-full">
					<PlanLimits plan={plan} />
				</div>
				<Link href={plan.href} className="vg-press vg-btn-dark mt-[18px] inline-flex h-[52px] w-full items-center justify-center rounded-control bg-vg-ink text-[15px] font-medium text-white">{plan.cta}</Link>
			</div>
		</div>
	)
}
