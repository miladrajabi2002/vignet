'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
	Package,
	BookOpen,
	AudioLines,
	Mic,
	RotateCcw,
	GraduationCap,
	SlidersHorizontal,
	Workflow,
	Share2,
	ShoppingCart,
	ArrowRight,
	UserCog,
	ShoppingBag,
	Headphones,
	Search,
	Sparkles,
	Check,
	type LucideIcon,
} from 'lucide-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { TextReveal } from '@/components/ui/text-reveal'
import { cn } from '@/lib/utils'

/* ───────────────────────────────────────────────────────────────────────
   Static configuration — icons for capability highlights, scenario tabs
   and source badges. Keyed by strings that also live in the i18n file.
   ─────────────────────────────────────────────────────────────────────── */

const HIGHLIGHTS: { key: string; icon: LucideIcon }[] = [
	{ key: 'learning', icon: GraduationCap },
	{ key: 'personalize', icon: SlidersHorizontal },
	{ key: 'flow', icon: Workflow },
	{ key: 'omnichannel', icon: Share2 },
]

const SCENARIO_ICONS: Record<string, LucideIcon> = {
	sales: ShoppingBag,
	support: Headphones,
	catalog: Search,
}

const SOURCE_ICON: Record<string, LucideIcon> = {
	catalog: Package,
	knowledge: BookOpen,
	voice: AudioLines,
	handoff: UserCog,
}

// Map product button keys → icon + (optional) primary style
const BUTTON_META: Record<string, { icon: LucideIcon; primary?: boolean }> = {
	addToCart: { icon: ShoppingCart, primary: true },
	details: { icon: ArrowRight },
	compare: { icon: ArrowRight },
	specs: { icon: ArrowRight },
	reserve: { icon: Check, primary: true },
}

/* ───────────────────────────────────────────────────────────────────────
   Bubble / product types — mirror the shape in messages/{fa,en}.json
   ─────────────────────────────────────────────────────────────────────── */

type ProductCard = {
	name: string
	price: string
	badge?: string
	desc: string
	initial: string
}

type Bubble = {
	role: 'user' | 'agent'
	text: string
	source?: 'catalog' | 'knowledge' | 'voice' | 'handoff'
	voice?: boolean
	product?: ProductCard
	buttons?: string[]
	handoff?: boolean
}

type ScenarioId = 'sales' | 'support' | 'catalog'

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const id = setTimeout(resolve, ms)
		signal.addEventListener('abort', () => {
			clearTimeout(id)
			reject(new DOMException('aborted', 'AbortError'))
		})
	})

/* ───────────────────────────────────────────────────────────────────────
   Small presentational helpers
   ─────────────────────────────────────────────────────────────────────── */

function VoiceWave({ playing }: { playing: boolean }) {
	return (
		<span className="flex items-end gap-[3px]">
			{[6, 11, 7, 14, 9, 5, 12, 8, 10, 6, 13, 7].map((h, j) => (
				<motion.span
					key={j}
					className="w-[2px] rounded-full bg-[var(--text-muted)]"
					style={{ height: h }}
					animate={playing ? { scaleY: [1, 0.45, 1] } : { scaleY: 1 }}
					transition={{
						duration: 0.9,
						repeat: playing ? Infinity : 0,
						delay: j * 0.07,
					}}
				/>
			))}
		</span>
	)
}

/** Product card embedded inside an agent bubble. */
function ProductBubble({ product }: { product: ProductCard }) {
	return (
		<div className="mt-2 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
			{/* Thumbnail row — gradient + initial letter, no external image dependency */}
			<div className="flex items-center gap-3 p-3">
				<div
					className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-xl font-semibold text-[var(--bg-base)]"
					style={{
						background: 'linear-gradient(135deg, var(--white) 0%, var(--white-60) 100%)',
					}}
				>
					{product.initial}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h5 className="truncate text-sm font-medium text-[var(--text-primary)]">
							{product.name}
						</h5>
						{product.badge && (
							<span className="shrink-0 rounded-full border border-[var(--border-hover)] bg-[var(--white-05)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
								{product.badge}
							</span>
						)}
					</div>
					<p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">
						{product.desc}
					</p>
					<p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
						{product.price}
					</p>
				</div>
			</div>
		</div>
	)
}

/** Inline action buttons under a bubble. */
function BubbleButtons({
	buttons,
	labels,
}: {
	buttons: string[]
	labels: Record<string, string>
}) {
	return (
		<div className="mt-2 flex flex-wrap gap-2">
			{buttons.map((key) => {
				const meta = BUTTON_META[key]
				if (!meta) return null
				const Icon = meta.icon
				return (
					<button
						key={key}
						type="button"
						onClick={(e) => e.preventDefault()}
						className={cn(
							'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
							meta.primary
								? 'bg-[var(--white)] text-[var(--bg-base)] hover:scale-[1.03]'
								: 'border border-[var(--border-hover)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
						)}
					>
						<Icon className="h-3 w-3" />
						{labels[key]}
					</button>
				)
			})}
		</div>
	)
}

/* ───────────────────────────────────────────────────────────────────────
   DemoSection — the headline component.
   Plays one of three scenarios automatically; lets the visitor switch
   tabs; ends with a "Start free" CTA that links to /login.
   ─────────────────────────────────────────────────────────────────────── */

export function DemoSection() {
	const t = useTranslations('marketing.demo')
	const tSrc = useTranslations('marketing.demo.sources')
	const tH = useTranslations('marketing.demo.highlights')

	const scenarioIds: ScenarioId[] = ['sales', 'support', 'catalog']
	const [active, setActive] = useState<ScenarioId>('sales')

	// Read the bubbles for the active scenario. `t.raw` returns the JSON
	// structure directly (arrays/objects), which is exactly what we need.
	const bubbles = t.raw(`scenarios.${active}.bubbles`) as Bubble[]

	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-120px' })

	// Playback state — number of fully-settled bubbles + the live one in flight.
	const [done, setDone] = useState(0)
	const [phase, setPhase] = useState<'idle' | 'typing' | 'writing'>('idle')
	const [partial, setPartial] = useState('')
	const [finished, setFinished] = useState(false)
	const [runId, setRunId] = useState(0)

	// Reset playback whenever the visitor picks a new scenario.
	useEffect(() => {
		setRunId((n) => n + 1)
	}, [active])

	useEffect(() => {
		if (!inView) return
		const controller = new AbortController()
		const { signal } = controller

		async function play() {
			setDone(0)
			setPhase('idle')
			setPartial('')
			setFinished(false)
			try {
				for (let i = 0; i < bubbles.length; i++) {
					const b = bubbles[i]
					if (b.role === 'user') {
						await sleep(i === 0 ? 400 : 750, signal)
						setDone(i + 1)
					} else {
						setPhase('typing')
						await sleep(950, signal)
						setPhase('writing')
						for (let c = 1; c <= b.text.length; c++) {
							setPartial(b.text.slice(0, c))
							await sleep(16, signal)
						}
						await sleep(700, signal)
						setPhase('idle')
						setPartial('')
						setDone(i + 1)
					}
				}
				setFinished(true)
			} catch {
				/* aborted — a newer run took over */
			}
		}

		play()
		return () => controller.abort()
		// bubbles is static page copy; depend only on the play triggers.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [inView, runId])

	/* ─── Bubble renderer ──────────────────────────────────────────── */

	const renderBubble = (
		b: Bubble,
		key: string | number,
		text: string,
		opts?: { cursor?: boolean },
	) => {
		const isUser = b.role === 'user'
		const Icon = b.source ? SOURCE_ICON[b.source] : null
		return (
			<motion.div
				key={key}
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, ease: 'easeOut' }}
				className={isUser ? 'flex justify-start' : 'flex justify-end'}
			>
				<div
					className={cn(
						'flex max-w-[85%] flex-col gap-1.5',
						isUser ? 'items-start' : 'items-end',
					)}
				>
					{/* Source badge (agent only) */}
					{!isUser && b.source && Icon && (
						<span
							className={cn(
								'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
								b.handoff
									? 'border-[var(--border-hover)] bg-[var(--white-10)] text-[var(--text-primary)]'
									: 'border-[var(--border-default)] bg-[var(--white-05)] text-[var(--text-secondary)]',
							)}
						>
							<Icon className="h-3 w-3" />
							{tSrc(b.source)}
						</span>
					)}

					{/* Bubble body */}
					<div
						className={cn(
							'rounded-2xl px-4 py-2.5 text-sm',
							isUser
								? 'bg-[var(--white-10)] text-[var(--text-primary)]'
								: b.handoff
									? 'border border-[var(--border-hover)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
									: 'bg-[var(--white)] text-[var(--bg-base)]',
						)}
					>
						{b.voice ? (
							<span className="inline-flex items-center gap-2 py-0.5">
								<Mic className="h-4 w-4 text-[var(--text-secondary)]" />
								<VoiceWave playing={phase === 'writing' && Boolean(opts?.cursor)} />
								<span className="text-xs text-[var(--text-muted)]">0:06</span>
							</span>
						) : (
							<span className="whitespace-pre-wrap">
								{text}
								{opts?.cursor && (
									<span className="ms-0.5 inline-block h-3.5 w-px animate-blink bg-[var(--bg-base)]/70 align-middle" />
								)}
							</span>
						)}
					</div>

					{/* Embedded product card */}
					{!isUser && b.product && <ProductBubble product={b.product} />}

					{/* Inline action buttons */}
					{!isUser && b.buttons && b.buttons.length > 0 && (
						<BubbleButtons
							buttons={b.buttons}
							labels={t.raw('productButtons') as Record<string, string>}
						/>
					)}

					{/* Handoff caption */}
					{!isUser && b.handoff && (
						<div className="flex items-center gap-1.5 rounded-lg bg-[var(--white-05)] px-2.5 py-1.5 text-[10px] text-[var(--text-muted)]">
							<UserCog className="h-3 w-3" />
							{t('handoff.title')}
						</div>
					)}
				</div>
			</motion.div>
		)
	}

	const inFlight = bubbles[done]

	return (
		<section id="demo" className="relative overflow-hidden bg-[var(--bg-base)] py-28">
			{/* Ambient glow that shifts with the active scenario for visual variety */}
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.07] blur-[100px]"
				style={{ background: 'var(--white)' }}
			/>

			<div className="relative mx-auto max-w-6xl px-6">
				<h2 className="text-center text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
					<TextReveal text={t('title')} />
				</h2>
				<p className="mx-auto mt-4 max-w-lg text-center text-[var(--text-secondary)]">
					{t('subtitle')}
				</p>

				<div className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
					{/* ─── Live chat demo ─────────────────────────────────────── */}
					<motion.div
						ref={ref}
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-80px' }}
						transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
						className="mx-auto w-full max-w-lg"
					>
						<SpotlightCard className="overflow-hidden p-0">
							{/* Scenario tabs */}
							<div className="flex items-center gap-1 border-b border-[var(--border-default)] px-3 pt-3">
								{scenarioIds.map((id) => {
									const Icon = SCENARIO_ICONS[id]
									const isActive = id === active
									return (
										<button
											key={id}
											type="button"
											onClick={() => setActive(id)}
											className={cn(
												'relative inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors',
												isActive
													? 'text-[var(--text-primary)]'
													: 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
											)}
										>
											<Icon className="h-3.5 w-3.5" />
											{t(`tabs.${id}`)}
											{isActive && (
												<motion.span
													layoutId="demo-tab-underline"
													className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--text-primary)]"
												/>
											)}
										</button>
									)
								})}
							</div>

							{/* Chat header */}
							<div className="flex items-center gap-3 border-b border-[var(--border-default)] px-5 py-3.5">
								<div className="relative">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--white-30)] to-[var(--white-05)] text-sm font-medium text-[var(--text-primary)]">
										و
									</div>
									<span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500" />
								</div>
								<div className="flex flex-col">
									<span className="text-sm font-medium text-[var(--text-primary)]">
										{t('agentName')}
									</span>
									<span className="inline-flex items-center gap-1 text-xs text-emerald-500">
										<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
										{t('online')}
									</span>
								</div>
							</div>

							{/* Chat body */}
							<div className="flex min-h-[380px] flex-col justify-end gap-3 px-5 py-5">
								{bubbles.slice(0, done).map((b, i) => renderBubble(b, i, b.text))}

								{phase === 'writing' &&
									inFlight &&
									renderBubble(inFlight, 'writing', partial, { cursor: true })}

								{phase === 'typing' && (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										className="flex justify-end"
									>
										<div className="flex items-center gap-1.5 rounded-2xl bg-[var(--white)] px-4 py-3">
											{[0, 1, 2].map((d) => (
												<motion.span
													key={d}
													className="h-1.5 w-1.5 rounded-full bg-[var(--bg-base)]/50"
													animate={{ opacity: [0.3, 1, 0.3] }}
													transition={{
														duration: 1,
														repeat: Infinity,
														delay: d * 0.18,
													}}
												/>
											))}
										</div>
									</motion.div>
								)}

								{/* End-of-conversation CTA */}
								<AnimatePresence>
									{finished && (
										<motion.div
											initial={{ opacity: 0, y: 12 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: 12 }}
											transition={{ duration: 0.4 }}
											className="mt-2 rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-elevated)] p-4"
										>
											<div className="flex items-center gap-2">
												<Sparkles className="h-4 w-4 text-[var(--text-primary)]" />
												<p className="text-sm font-medium text-[var(--text-primary)]">
													{t('ctaStartDesc')}
												</p>
											</div>
											<Link
												href="/login"
												className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
											>
												{t('ctaStart')}
												<ArrowRight className="h-4 w-4 rtl:rotate-180" />
											</Link>
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							{/* Footer: replay + scenario switcher */}
							<div className="flex items-center justify-between border-t border-[var(--border-default)] px-5 py-3">
								<span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
									{t('scenarioLabel')}: {t(`tabs.${active}`)}
								</span>
								<AnimatePresence>
									{finished && (
										<motion.button
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											onClick={() => setRunId((n) => n + 1)}
											className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
										>
											<RotateCcw className="h-3.5 w-3.5" />
											{t('replay')}
										</motion.button>
									)}
								</AnimatePresence>
							</div>
						</SpotlightCard>
					</motion.div>

					{/* ─── Capability highlights ─────────────────────────────── */}
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-80px' }}
						transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
						className="mx-auto w-full max-w-lg"
					>
						<h3 className="text-2xl font-light text-[var(--text-primary)] md:text-3xl">
							{tH('title')}
						</h3>
						<p className="mt-3 text-[var(--text-secondary)]">{tH('subtitle')}</p>

						<ul className="mt-8 space-y-3">
							{HIGHLIGHTS.map(({ key, icon: Icon }, i) => (
								<motion.li
									key={key}
									initial={{ opacity: 0, x: 20 }}
									whileInView={{ opacity: 1, x: 0 }}
									viewport={{ once: true, margin: '-40px' }}
									transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
									className="group flex gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] p-4 transition-all duration-300 hover:border-[var(--border-hover)] hover:bg-[var(--white-10)]"
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--white-05)] transition-colors duration-300 group-hover:border-[var(--border-strong)]">
										<Icon className="h-5 w-5 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
									</div>
									<div>
										<h4 className="text-[15px] font-medium text-[var(--text-primary)]">
											{tH(`items.${key}.title`)}
										</h4>
										<p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
											{tH(`items.${key}.desc`)}
										</p>
									</div>
								</motion.li>
							))}
						</ul>
					</motion.div>
				</div>
			</div>
		</section>
	)
}
