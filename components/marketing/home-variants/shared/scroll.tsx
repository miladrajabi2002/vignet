'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
	animate,
	m,
	useInView,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform,
	type MotionValue,
} from 'framer-motion'
import { cn } from '@/lib/utils'

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
export const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const

/** Smooth a raw scroll-linked motion value into a buttery spring. */
export function useSmoothProgress(raw: MotionValue<number>, stiffness = 90, damping = 26) {
	return useSpring(raw, { stiffness, damping, restDelta: 0.001 })
}

/**
 * Sticky scrollytelling scene: a tall outer track with a pinned viewport-height
 * inner stage. Children receive the scene's scroll progress (0 → 1) to scrub
 * their own choreography.
 */
export function StickyScene({
	height = '300vh',
	children,
	className,
	stageClassName,
	overflowHidden = true,
}: {
	height?: string
	children: (progress: MotionValue<number>) => ReactNode
	className?: string
	stageClassName?: string
	overflowHidden?: boolean
}) {
	const trackRef = useRef<HTMLDivElement>(null)
	const { scrollYProgress } = useScroll({
		target: trackRef,
		offset: ['start start', 'end end'],
	})
	return (
		<div ref={trackRef} style={{ height }} className={cn('relative', className)}>
			<div
				className={cn(
					'sticky top-0 flex min-h-screen w-full items-center justify-center',
					overflowHidden && 'overflow-hidden',
					stageClassName,
				)}
			>
				{children(scrollYProgress)}
			</div>
		</div>
	)
}

/** Map a 0→1 scene progress onto a discrete step index (0..steps-1). */
export function useSceneStep(progress: MotionValue<number>, steps: number) {
	const [step, setStep] = useState(0)
	useEffect(() => {
		const unsubscribe = progress.on('change', (value) => {
			const next = Math.min(steps - 1, Math.max(0, Math.floor(value * steps)))
			setStep((current) => (current === next ? current : next))
		})
		return unsubscribe
	}, [progress, steps])
	return step
}

/** Thin reading-progress bar pinned under the navbar. */
export function ScrollProgress({ inverse = false }: { inverse?: boolean }) {
	const { scrollYProgress } = useScroll()
	const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 })
	const reduce = useReducedMotion()
	if (reduce) return null
	return (
		<m.div
			aria-hidden
			style={{ scaleX }}
			className={cn(
				'fixed inset-x-0 top-0 z-[90] h-[2.5px] origin-[0%] rtl:origin-[100%]',
				inverse ? 'bg-emerald-300' : 'bg-black',
			)}
		/>
	)
}

/** Element translates on Y as it passes through the viewport (depth layering). */
export function Parallax({
	children,
	distance = 48,
	className,
	opacity,
}: {
	children: ReactNode
	distance?: number
	className?: string
	opacity?: [number, number, number]
}) {
	const ref = useRef<HTMLDivElement>(null)
	const reduce = useReducedMotion()
	const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
	const y = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [0, 0, 0] : [distance, 0, -distance])
	const smoothY = useSpring(y, { stiffness: 90, damping: 24 })
	const fade = useTransform(scrollYProgress, [0, 0.5, 1], opacity ?? [1, 1, 1])
	return (
		<m.div ref={ref} style={{ y: smoothY, opacity: fade }} className={className}>
			{children}
		</m.div>
	)
}

/**
 * Word-by-word headline reveal — the signature premium text entrance. Words
 * rise and unblur with a tight stagger when the heading scrolls into view.
 */
export function WordsReveal({
	text,
	highlight,
	className,
	wordClassName,
	delay = 0,
	as: Tag = 'span',
}: {
	text: string
	highlight?: string
	className?: string
	wordClassName?: string
	delay?: number
	as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
}) {
	const reduce = useReducedMotion()
	const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
	const highlightWords = useMemo(
		() => new Set((highlight ?? '').split(/\s+/).filter(Boolean)),
		[highlight],
	)
	const MotionTag = m[Tag]
	return (
		<MotionTag
			className={cn('flex flex-wrap', className)}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, amount: 0.6 }}
			transition={{ staggerChildren: reduce ? 0 : 0.055, delayChildren: delay }}
		>
			{words.map((word, index) => (
				<span key={`${word}-${index}`} className="inline-block overflow-visible">
					<m.span
						className={cn('inline-block will-change-transform', highlightWords.has(word) && wordClassName)}
						variants={{
							hidden: reduce
								? { opacity: 1, y: 0, filter: 'blur(0px)' }
								: { opacity: 0, y: '0.55em', filter: 'blur(6px)' },
							visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
						}}
						transition={{ duration: 0.62, ease: EASE_OUT }}
					>
						{word}
					</m.span>
				</span>
			))}
		</MotionTag>
	)
}

/** Standard section/block entrance: rise + fade (+ optional blur). */
export function RevealBlock({
	children,
	className,
	delay = 0,
	amount = 0.25,
	translate = 22,
	once = true,
}: {
	children: ReactNode
	className?: string
	delay?: number
	amount?: number
	translate?: number
	once?: boolean
}) {
	const reduce = useReducedMotion()
	return (
		<m.div
			className={className}
			initial={reduce ? false : { opacity: 0, transform: `translate3d(0, ${translate}px, 0)`, filter: 'blur(3px)' }}
			whileInView={{ opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0px)' }}
			viewport={{ once, amount }}
			transition={reduce ? { duration: 0 } : { duration: 0.72, delay, ease: EASE_OUT }}
		>
			{children}
		</m.div>
	)
}

/** Animate a number from 0 → value when it enters the viewport. */
export function CountUp({
	to,
	duration = 1.6,
	locale = 'fa',
	suffix = '',
	prefix = '',
	className,
}: {
	to: number
	duration?: number
	locale?: 'fa' | 'en'
	suffix?: string
	prefix?: string
	className?: string
}) {
	const ref = useRef<HTMLSpanElement>(null)
	const inView = useInView(ref, { once: true, amount: 0.6 })
	const reduce = useReducedMotion()
	const [display, setDisplay] = useState(0)
	const format = useMemo(
		() => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 0 }),
		[locale],
	)

	useEffect(() => {
		if (!inView) return
		if (reduce) {
			setDisplay(to)
			return
		}
		const controls = animate(0, to, {
			duration,
			ease: EASE_OUT,
			onUpdate: (latest) => setDisplay(Math.round(latest)),
		})
		return () => controls.stop()
	}, [inView, to, duration, reduce])

	return (
		<span ref={ref} className={cn('tabular-nums', className)}>
			{prefix}
			{format.format(display)}
			{suffix}
		</span>
	)
}

/**
 * SVG path that draws itself while its section scrolls through the viewport —
 * used for connecting lines, route rails and chart lines. Wrap in a component
 * with `useScroll` if you need scene progress instead.
 */
export function ScrollPath({
	d,
	progress,
	className,
	width = 2,
	drawRange = [0.15, 0.85],
}: {
	d: string
	progress: MotionValue<number>
	className?: string
	width?: number
	drawRange?: [number, number]
}) {
	const pathLength = useTransform(progress, drawRange, [0, 1])
	return (
		<m.path
			d={d}
			fill="none"
			strokeWidth={width}
			strokeLinecap="round"
			style={{ pathLength }}
			className={className}
		/>
	)
}

/** Scroll cue used at the bottom of heroes. */
export function ScrollCue({ label, inverse = false }: { label: string; inverse?: boolean }) {
	const reduce = useReducedMotion()
	return (
		<div className="flex flex-col items-center gap-2.5" aria-hidden>
			<span className={cn('text-[11px] font-medium', inverse ? 'text-white/45' : 'text-black/45')}>{label}</span>
			<span
				className={cn(
					'grid h-9 w-6 items-start justify-center rounded-full border p-1.5',
					inverse ? 'border-white/20' : 'border-black/20',
				)}
			>
				<m.span
					className={cn('h-2 w-1 rounded-full', inverse ? 'bg-emerald-300' : 'bg-black/60')}
					animate={reduce ? undefined : { y: [0, 10, 0], opacity: [1, 0.25, 1] }}
					transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
				/>
			</span>
		</div>
	)
}
