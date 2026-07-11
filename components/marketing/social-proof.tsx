'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { motion, useInView, useReducedMotion } from 'framer-motion'

/**
 * SocialProof — a quiet numbers strip right under the hero.
 *
 * The numbers are real platform stats, set via env so they can grow without
 * a code change: NEXT_PUBLIC_STAT_CONVERSATIONS / _BUSINESSES / _AGENTS.
 * A stat only renders once it crosses MIN_VISIBLE — tiny or zero numbers
 * hurt trust more than no numbers, so below the threshold the whole strip
 * silently renders nothing.
 */
const MIN_VISIBLE = 50

const STATS: { key: 'conversations' | 'businesses' | 'agents'; value: number }[] = [
	{ key: 'conversations', value: Number(process.env.NEXT_PUBLIC_STAT_CONVERSATIONS ?? 0) },
	{ key: 'businesses', value: Number(process.env.NEXT_PUBLIC_STAT_BUSINESSES ?? 0) },
	{ key: 'agents', value: Number(process.env.NEXT_PUBLIC_STAT_AGENTS ?? 0) },
]

/** Counts up from zero when it scrolls into view. */
function CountUp({ to, play, duration = 1400 }: { to: number; play: boolean; duration?: number }) {
	const [val, setVal] = useState(0)
	const locale = useLocale()
	const reduce = useReducedMotion()

	useEffect(() => {
		if (!play) return
		if (reduce) {
			setVal(to)
			return
		}
		let raf: number
		const start = performance.now()
		const tick = (now: number) => {
			const p = Math.min((now - start) / duration, 1)
			setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
			if (p < 1) raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [to, duration, play, reduce])

	return <>{val.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}+</>
}

export function SocialProof() {
	const t = useTranslations('marketing.stats')
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-40px' })

	const visible = STATS.filter((s) => Number.isFinite(s.value) && s.value >= MIN_VISIBLE)
	if (visible.length === 0) return null

	return (
		<section aria-label={locale === 'fa' ? 'آمار ویجنت' : 'Vigent statistics'} className="border-y border-[var(--border-default)] bg-[var(--bg-base)]">
			<div
				ref={ref}
				className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-0 gap-y-6 px-6 py-10"
			>
				{visible.map(({ key, value }, i) => (
					<motion.div
						key={key}
						initial={{ opacity: 0, y: 14 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-40px' }}
						transition={{ duration: 0.5, delay: i * 0.12 }}
						className={
							i > 0
								? 'flex flex-col items-center border-s border-[var(--border-default)] px-8 sm:px-14'
								: 'flex flex-col items-center px-8 sm:px-14'
						}
					>
						<span className="text-3xl font-light tabular-nums text-[var(--text-primary)] md:text-4xl">
							<CountUp to={value} play={inView} />
						</span>
						<span className="mt-1.5 text-xs text-[var(--text-muted)]">{t(key)}</span>
					</motion.div>
				))}
			</div>
		</section>
	)
}
