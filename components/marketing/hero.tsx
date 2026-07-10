'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, Play } from 'lucide-react'
import { Spotlight } from './spotlight'

function useTypewriter(words: string[], enabled: boolean, typing = 90, deleting = 45, hold = 1600) {
	const [text, setText] = useState('')
	const [index, setIndex] = useState(0)
	const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('typing')

	useEffect(() => {
		if (!enabled || words.length === 0) return
		const word = words[index % words.length]
		let timeout: ReturnType<typeof setTimeout>
		if (phase === 'typing') {
			timeout = text.length < word.length
				? setTimeout(() => setText(word.slice(0, text.length + 1)), typing)
				: setTimeout(() => setPhase('holding'), hold)
		} else if (phase === 'holding') {
			timeout = setTimeout(() => setPhase('deleting'), hold)
		} else if (text.length > 0) {
			timeout = setTimeout(() => setText(word.slice(0, text.length - 1)), deleting)
		} else {
			setIndex((current) => current + 1)
			setPhase('typing')
		}
		return () => clearTimeout(timeout)
	}, [deleting, enabled, hold, index, phase, text, typing, words])
	return text
}

function rise(delay: number, reduce: boolean | null) {
	return {
		initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
		animate: { opacity: 1, y: 0 },
		transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
	}
}

export function Hero() {
	const t = useTranslations('marketing.hero')
	const reduce = useReducedMotion()
	const words = t.raw('rotate') as string[]
	const typed = useTypewriter(words, reduce === false)
	const rotatingText = reduce ? words[0] : typed

	return (
		<section className="relative flex min-h-[92dvh] items-center justify-center overflow-hidden bg-[var(--bg-base)]">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 z-0"
				style={{
					backgroundImage:
						'radial-gradient(rgba(var(--ink-rgb),0.05) 1px, transparent 1px)',
					backgroundSize: '44px 44px',
					maskImage:
						'radial-gradient(ellipse 75% 70% at 50% 38%, black, transparent 75%)',
					WebkitMaskImage:
						'radial-gradient(ellipse 75% 70% at 50% 38%, black, transparent 75%)',
				}}
			/>

			<Spotlight />

			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-b from-transparent to-[var(--bg-base)]"
			/>

			<div className="relative z-20 mx-auto max-w-4xl px-6 pb-20 pt-28 text-center sm:pb-16">
				<motion.div {...rise(0, reduce)}>
					<span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
						{t('badge')}
					</span>
				</motion.div>

				<motion.h1
					{...rise(0.08, reduce)}
					className="mt-8 text-balance text-4xl font-light leading-[1.15] text-[var(--text-primary)] sm:text-5xl md:text-7xl md:leading-[1.08]"
				>
					<span className="gradient-text block">{t('title')}</span>
					<span className="mt-2 block min-h-[1.15em] text-[var(--text-primary)]">
						{rotatingText}
						{!reduce && (
							<span
								aria-hidden
								className="ms-1 inline-block w-[2px] animate-blink bg-[var(--text-primary)] align-middle"
								style={{ height: '0.82em' }}
							/>
						)}
					</span>
				</motion.h1>

				<motion.p
					{...rise(0.16, reduce)}
					className="mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-[var(--text-secondary)] md:text-lg"
				>
					{t('subtitle')}
				</motion.p>

				<motion.div
					{...rise(0.24, reduce)}
					className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row"
				>
					<Link
						href="/login?next=/onboarding"
						className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--white)] px-8 text-sm font-medium text-[var(--bg-base)] shadow-[0_8px_30px_rgba(var(--ink-rgb),0.12)] transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(var(--ink-rgb),0.2)] sm:w-auto"
					>
						{t('ctaPrimary')}
					</Link>
					<Link
						href="#demo"
						className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-hover)] bg-[var(--bg-surface)] px-8 text-sm font-medium text-[var(--text-primary)] transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--white-05)] sm:w-auto"
					>
						<Play className="h-3.5 w-3.5 fill-current" />
						{t('ctaSecondary')}
					</Link>
				</motion.div>

				<motion.p
					{...rise(0.32, reduce)}
					className="mt-8 text-xs leading-6 text-[var(--text-muted)]"
				>
					{t('trust')}
				</motion.p>
			</div>

			<motion.div
				aria-hidden
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1, duration: 0.8 }}
				className="absolute bottom-5 z-20 flex flex-col items-center gap-1 text-[var(--text-muted)]"
			>
				<span className="text-[10px]">{t('scrollCue')}</span>
				<motion.div
					animate={reduce ? undefined : { y: [0, 7, 0] }}
					transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
				>
					<ChevronDown className="h-5 w-5" />
				</motion.div>
			</motion.div>
		</section>
	)
}
