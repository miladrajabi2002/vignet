import Link from 'next/link'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Preview = 'chat' | 'people' | 'cards' | 'orders' | 'agents' | 'none'

const ROW_ANIM = ['vg-in1', 'vg-in2', 'vg-in3', 'vg-in4']
const DOTS = ['#be185d', '#0369a1', '#047857', '#5b3de8']
// Placeholder text lines "fill in" a beat after their row lands, the way a
// real row renders its name then its preview.
const LINE_FILL = ['vg-f1', 'vg-f3', 'vg-f5']

/**
 * Live empty state (ط۹). Instead of a lone icon and "nothing here", a faded
 * preview of what this page will look like once data arrives plays on a
 * loop (the public site's CSS sequence; paused off-screen by MotionPauser,
 * frozen for reduced motion), with one clear next step. `preview="none"`
 * is for filtered searches that simply found nothing.
 */
export function LiveEmptyState({
	icon: Icon,
	title,
	description,
	action,
	secondary,
	preview = 'none',
	className,
}: {
	icon: ComponentType<{ className?: string; strokeWidth?: number }>
	title: string
	description?: string
	action?: { href: string; label: string }
	secondary?: ReactNode
	preview?: Preview
	className?: string
}) {
	return (
		<section className={cn('vg-anim vg-ex relative overflow-hidden rounded-card border border-dashed border-[var(--border-hover)] bg-white px-5 py-9 text-center sm:px-8 sm:py-12', className)}>
			{preview !== 'none' ? <PreviewRows kind={preview} /> : null}
			<div className="relative mx-auto flex max-w-md flex-col items-center">
				<span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--signal-soft)] text-[var(--signal)]">
					<Icon className="h-6 w-6" strokeWidth={1.8} />
				</span>
				<h2 className="ui-h3 mt-4">{title}</h2>
				{description ? <p className="ui-body mt-1.5 text-[13.5px]">{description}</p> : null}
				{action || secondary ? (
					<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
						{action ? (
							<Link href={action.href} className="spatial-press inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-[var(--shadow-control)] hover:bg-[#2a2a2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
								{action.label}
							</Link>
						) : null}
						{secondary}
					</div>
				) : null}
			</div>
		</section>
	)
}

function PreviewRows({ kind }: { kind: Exclude<Preview, 'none'> }) {
	return (
		<div aria-hidden className="pointer-events-none mx-auto mb-6 w-full max-w-sm [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" style={{ '--vg-T': '8s' } as CSSProperties}>
			{kind === 'cards' ? (
				<div className="grid grid-cols-3 gap-2">
					{[0, 1, 2].map((i) => (
						<div key={i} className={cn(ROW_ANIM[i], 'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2')}>
							<div className="h-12 rounded-lg bg-black/[0.06]" />
							<div className="mt-2 h-2 w-3/4 rounded bg-black/[0.08]" />
							<div className="mt-1.5 h-2 w-1/2 rounded bg-[var(--signal-tint)]" />
						</div>
					))}
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{[0, 1, 2].map((i) => (
						<div key={i} className={cn(ROW_ANIM[i], 'flex items-center gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5')}>
							<span className={cn('h-7 w-7 shrink-0', kind === 'agents' ? 'rounded-lg bg-black/80' : 'rounded-full bg-black/[0.08]')} />
							<span className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span className="h-2 w-2/5 rounded bg-black/[0.1]" />
								<span className="relative h-2 w-4/5 overflow-hidden rounded bg-black/[0.03]"><span className={cn('vg-fx absolute inset-0 rounded bg-black/[0.07]', LINE_FILL[i])} /></span>
							</span>
							{kind === 'chat' ? <span className="relative h-2 w-2"><span className="vg-ring absolute -inset-1 rounded-full" style={{ border: `1px solid ${DOTS[i]}`, animationDelay: `${i * 0.6}s` }} /><span className="absolute inset-0 rounded-full" style={{ background: DOTS[i] }} /></span> : null}
							{kind === 'orders' ? <span className="ui-chip ui-chip-ok">&nbsp;&nbsp;&nbsp;&nbsp;</span> : null}
							{kind === 'people' ? <span className="h-4 w-10 rounded-full bg-[var(--signal-tint)]" /> : null}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
