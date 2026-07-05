'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
	Package,
	BookOpen,
	AudioLines,
	Mic,
	RotateCcw,
	GraduationCap,
	ShoppingCart,
	ArrowRight,
	UserCog,
	ShoppingBag,
	Headphones,
	Search,
	Sparkles,
	Check,
	MessageSquare,
	LayoutDashboard,
	Inbox,
	TrendingUp,
	Zap,
	CheckCircle2,
	MousePointerClick,
	Send,
	type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ───────────────────────────────────────────────────────────────────────
   Static configuration — view tabs, scenario tabs, source badges and
   the live capability rail. Keyed by strings that also live in i18n.
   ─────────────────────────────────────────────────────────────────────── */

type ViewId = 'chat' | 'dashboard' | 'learning'

const VIEWS: { id: ViewId; icon: LucideIcon }[] = [
	{ id: 'chat', icon: MessageSquare },
	{ id: 'dashboard', icon: LayoutDashboard },
	{ id: 'learning', icon: GraduationCap },
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

/** Capabilities narrated live by the demo — listed in tour order, so the
    highlight walks straight down the rail: chat → dashboard → learning. */
type CapKey =
	| 'catalog'
	| 'buttons'
	| 'voice'
	| 'analytics'
	| 'crm'
	| 'handoff'
	| 'learning'

const CAP_ITEMS: { key: CapKey; icon: LucideIcon }[] = [
	{ key: 'catalog', icon: Package },
	{ key: 'buttons', icon: MousePointerClick },
	{ key: 'voice', icon: AudioLines },
	{ key: 'analytics', icon: TrendingUp },
	{ key: 'crm', icon: Inbox },
	{ key: 'handoff', icon: UserCog },
	{ key: 'learning', icon: GraduationCap },
]

// Channel accent dots for the mock inbox — fixed brand-ish hues on purpose.
const CHANNEL_DOT: Record<string, string> = {
	telegram: 'bg-sky-500',
	whatsapp: 'bg-emerald-500',
	instagram: 'bg-pink-500',
	widget: 'bg-violet-500',
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

type InboxItem = {
	name: string
	channelKey: string
	channelLabel: string
	text: string
	time: string
	auto: boolean
}

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const id = setTimeout(resolve, ms)
		signal.addEventListener('abort', () => {
			clearTimeout(id)
			reject(new DOMException('aborted', 'AbortError'))
		})
	})

// Springy entrance shared by every bubble — feels like a real chat push.
const BUBBLE_SPRING = {
	type: 'spring' as const,
	stiffness: 420,
	damping: 32,
	mass: 0.8,
}

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

/** Animated number that counts up when mounted. */
function CountUp({ to, duration = 1400, suffix = '' }: { to: number; duration?: number; suffix?: string }) {
	const [val, setVal] = useState(0)
	const locale = useLocale()

	useEffect(() => {
		let raf: number
		const start = performance.now()
		const tick = (now: number) => {
			const p = Math.min((now - start) / duration, 1)
			// ease-out cubic so the counter settles smoothly
			setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
			if (p < 1) raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [to, duration])

	return (
		<>
			{val.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
			{suffix}
		</>
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
   View 1 — live chat. Plays a scenario automatically inside a fixed-height,
   self-scrolling body (the frame never grows), reports which capability is
   on display, and lets the visitor switch scenarios.
   ─────────────────────────────────────────────────────────────────────── */

function ChatView({
	play,
	onDone,
	onInteract,
	onSpot,
}: {
	play: boolean
	onDone: () => void
	onInteract: () => void
	onSpot: (key: CapKey) => void
}) {
	const t = useTranslations('marketing.demo')
	const tSrc = useTranslations('marketing.demo.sources')

	const scenarioIds: ScenarioId[] = ['sales', 'support', 'catalog']
	const [active, setActive] = useState<ScenarioId>('sales')

	const bubbles = t.raw(`scenarios.${active}.bubbles`) as Bubble[]

	// Playback state — number of fully-settled bubbles + the live one in flight.
	const [done, setDone] = useState(0)
	const [phase, setPhase] = useState<'idle' | 'typing' | 'writing'>('idle')
	const [partial, setPartial] = useState('')
	const [runId, setRunId] = useState(0)
	const doneRef = useRef(onDone)
	doneRef.current = onDone
	const spotRef = useRef(onSpot)
	spotRef.current = onSpot

	// Keep the newest bubble in view — the body scrolls, the frame stays put.
	const bodyRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = bodyRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [done, phase, partial])

	const pickScenario = (id: ScenarioId) => {
		onInteract()
		setActive(id)
		setRunId((n) => n + 1)
	}

	useEffect(() => {
		if (!play) return
		const controller = new AbortController()
		const { signal } = controller

		async function run() {
			setDone(0)
			setPhase('idle')
			setPartial('')
			try {
				for (let i = 0; i < bubbles.length; i++) {
					const b = bubbles[i]
					if (b.role === 'user') {
						await sleep(i === 0 ? 400 : 700, signal)
						if (b.voice) spotRef.current('voice')
						setDone(i + 1)
					} else {
						// 'knowledge' answers are not a rail item; every other source is.
						if (b.source && b.source !== 'knowledge') spotRef.current(b.source)
						setPhase('typing')
						await sleep(900, signal)
						setPhase('writing')
						// Two characters per tick — snappy but still legible.
						for (let c = 2; c < b.text.length + 2; c += 2) {
							setPartial(b.text.slice(0, c))
							await sleep(26, signal)
						}
						await sleep(300, signal)
						setPhase('idle')
						setPartial('')
						setDone(i + 1)
						if (b.buttons?.length || b.product) {
							spotRef.current('buttons')
							await sleep(500, signal)
						} else {
							await sleep(350, signal)
						}
					}
				}
				doneRef.current()
			} catch {
				/* aborted — a newer run took over */
			}
		}

		run()
		return () => controller.abort()
		// bubbles is static page copy; depend only on the play triggers.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [play, runId])

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
				initial={{ opacity: 0, y: 16, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={BUBBLE_SPRING}
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
		<div className="flex h-full w-full flex-col">
			{/* Chat header + scenario pills */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 sm:px-5">
				<div className="flex items-center gap-3">
					<div className="relative">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--white-30)] to-[var(--white-05)] text-sm font-medium text-[var(--text-primary)] sm:h-10 sm:w-10">
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

				<div className="flex items-center gap-1">
					{scenarioIds.map((id) => {
						const Icon = SCENARIO_ICONS[id]
						const isActive = id === active
						return (
							<button
								key={id}
								type="button"
								onClick={() => pickScenario(id)}
								className={cn(
									'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
									isActive
										? 'border-transparent bg-[var(--white)] text-[var(--bg-base)]'
										: 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
								)}
							>
								<Icon className="h-3 w-3" />
								{t(`tabs.${id}`)}
							</button>
						)
					})}
				</div>
			</div>

			{/* Chat body — fixed height, scrolls internally, older messages fade at the top */}
			<div className="relative min-h-0 flex-1">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-[var(--bg-surface)] to-transparent"
				/>
				<div
					ref={bodyRef}
					className="no-scrollbar h-full overflow-y-auto px-4 py-5 sm:px-5"
				>
					<div className="flex min-h-full flex-col justify-end gap-3">
						{bubbles.slice(0, done).map((b, i) => renderBubble(b, i, b.text))}

						{phase === 'writing' &&
							inFlight &&
							renderBubble(inFlight, 'writing', partial, { cursor: true })}

						{phase === 'typing' && (
							<motion.div
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={BUBBLE_SPRING}
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
					</div>
				</div>
			</div>
		</div>
	)
}

/* ───────────────────────────────────────────────────────────────────────
   View 2 — management dashboard mock. Stat tiles count up, inbox rows
   stream in from every channel, and a tiny bar chart draws itself.
   ─────────────────────────────────────────────────────────────────────── */

const CHART_BARS = [38, 55, 30, 68, 48, 74, 42, 88, 58, 72, 50, 95]

function DashboardView({
	onDone,
	onSpot,
}: {
	onDone: () => void
	onSpot: (key: CapKey) => void
}) {
	const t = useTranslations('marketing.demo.dashboard')
	const inbox = t.raw('inbox') as InboxItem[]
	const [showHandoff, setShowHandoff] = useState(false)
	const doneRef = useRef(onDone)
	doneRef.current = onDone
	const spotRef = useRef(onSpot)
	spotRef.current = onSpot

	useEffect(() => {
		spotRef.current('analytics')
		const timers = [
			setTimeout(() => spotRef.current('crm'), 1800),
			// The operator alert lands last: the agent asked for a human and
			// pinged the owner on Telegram — this is what checks off "handoff".
			setTimeout(() => {
				setShowHandoff(true)
				spotRef.current('handoff')
			}, 3600),
			setTimeout(() => doneRef.current(), 6600),
		]
		return () => timers.forEach(clearTimeout)
	}, [])

	const stats: { key: string; icon: LucideIcon; to: number; suffix?: string }[] = [
		{ key: 'statConversations', icon: MessageSquare, to: 236 },
		{ key: 'statAutomation', icon: Zap, to: 87, suffix: '٪' },
		{ key: 'statSales', icon: TrendingUp, to: 12 },
	]

	return (
		<div className="relative h-full">
			<div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-5">
			{/* Stat tiles */}
			<div className="grid grid-cols-3 gap-3">
				{stats.map(({ key, icon: Icon, to, suffix }, i) => (
					<motion.div
						key={key}
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, delay: i * 0.1 }}
						className="rounded-xl border border-[var(--border-default)] bg-[var(--white-05)] p-3.5"
					>
						<div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
							<Icon className="h-3.5 w-3.5" />
							{t(key)}
						</div>
						<div className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--text-primary)] md:text-2xl">
							<CountUp to={to} suffix={suffix} />
						</div>
					</motion.div>
				))}
			</div>

			<div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[3fr_2fr]">
				{/* Unified inbox */}
				<div className="rounded-xl border border-[var(--border-default)] bg-[var(--white-05)] p-3.5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
							<Inbox className="h-3.5 w-3.5" />
							{t('inboxTitle')}
						</div>
						<span className="text-[10px] text-[var(--text-muted)]">{t('viewAll')}</span>
					</div>
					<div className="mt-3 space-y-2">
						{inbox.map((item, i) => (
							<motion.div
								key={i}
								initial={{ opacity: 0, x: 16 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.4, delay: 0.9 + i * 0.55 }}
								className="flex items-center gap-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2"
							>
								<span
									className={cn(
										'h-2 w-2 shrink-0 rounded-full',
										CHANNEL_DOT[item.channelKey] ?? 'bg-[var(--text-muted)]',
									)}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-xs font-medium text-[var(--text-primary)]">
											{item.name}
										</span>
										<span className="shrink-0 text-[9px] text-[var(--text-muted)]">
											{item.time}
										</span>
									</div>
									<p className="truncate text-[11px] text-[var(--text-muted)]">{item.text}</p>
								</div>
								<span
									className={cn(
										'shrink-0 rounded-full px-2 py-0.5 text-[9px]',
										item.auto
											? 'bg-[var(--white-10)] text-[var(--text-secondary)]'
											: 'border border-[var(--border-hover)] text-[var(--text-secondary)]',
									)}
								>
									{item.auto ? t('tagAgent') : t('tagHuman')}
								</span>
							</motion.div>
						))}
					</div>
				</div>

				{/* Mini bar chart */}
				<div className="flex min-h-[120px] flex-col rounded-xl border border-[var(--border-default)] bg-[var(--white-05)] p-3.5">
					<div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
						<TrendingUp className="h-3.5 w-3.5" />
						{t('chartTitle')}
					</div>
					<div className="mt-3 flex flex-1 items-end gap-1.5">
						{CHART_BARS.map((h, i) => (
							<motion.div
								key={i}
								initial={{ scaleY: 0 }}
								animate={{ scaleY: 1 }}
								transition={{ duration: 0.5, delay: 0.6 + i * 0.07, ease: 'easeOut' }}
								className={cn(
									'flex-1 origin-bottom rounded-t',
									i === CHART_BARS.length - 1 ? 'bg-[var(--white)]' : 'bg-[var(--white-30)]',
								)}
								style={{ height: `${h}%` }}
							/>
						))}
					</div>
				</div>
			</div>
			</div>

			{/* Operator handoff toast — floats over the dashboard like a real
			    notification: the agent asked for a human and pinged Telegram. */}
			<AnimatePresence>
				{showHandoff && (
					<motion.div
						initial={{ opacity: 0, y: 16, scale: 0.97 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={BUBBLE_SPRING}
						className="absolute inset-x-4 bottom-4 z-10 flex items-center gap-3 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-elevated)] px-3.5 py-2.5 shadow-[0_8px_30px_rgba(var(--ink-rgb),0.12)] sm:inset-x-5"
					>
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--white)] text-[var(--bg-base)]">
							<UserCog className="h-4 w-4" />
						</span>
						<p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--text-primary)]">
							{t('handoffAlert')}
						</p>
						<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
							<Send className="h-3 w-3" />
						</span>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/* ───────────────────────────────────────────────────────────────────────
   View 3 — learning center mock. An unanswered question is detected,
   the agent proposes an answer, the owner approves it, done.
   ─────────────────────────────────────────────────────────────────────── */

function LearningView({
	onDone,
	onSpot,
}: {
	onDone: () => void
	onSpot: (key: CapKey) => void
}) {
	const t = useTranslations('marketing.demo.learningView')
	const [step, setStep] = useState(0)
	const doneRef = useRef(onDone)
	doneRef.current = onDone
	const spotRef = useRef(onSpot)
	spotRef.current = onSpot

	useEffect(() => {
		spotRef.current('learning')
		const timers = [
			setTimeout(() => setStep(1), 400),
			setTimeout(() => setStep(2), 1700),
			setTimeout(() => setStep(3), 3400),
			setTimeout(() => setStep(4), 4200),
			setTimeout(() => doneRef.current(), 5600),
		]
		return () => timers.forEach(clearTimeout)
	}, [])

	return (
		<div className="mx-auto flex h-full w-full max-w-md flex-col justify-center gap-3 p-5">
			<div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
				<GraduationCap className="h-4 w-4" />
				{t('badge')}
			</div>

			{/* Detected unanswered question */}
			<AnimatePresence>
				{step >= 1 && (
					<motion.div
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
						className="rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-elevated)] p-4"
					>
						<div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
							<Search className="h-3 w-3" />
							{t('detected')}
						</div>
						<p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
							«{t('question')}»
						</p>
						<p className="mt-1.5 text-[10px] text-[var(--text-muted)]">{t('sourceLabel')}</p>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Suggested answer */}
			<AnimatePresence>
				{step >= 2 && (
					<motion.div
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
						className="rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] p-4"
					>
						<div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
							<Sparkles className="h-3 w-3" />
							{t('suggestionLabel')}
						</div>
						<p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
							{t('suggestion')}
						</p>

						{/* Approve button — presses itself at step 3 */}
						<motion.div
							animate={step === 3 ? { scale: [1, 0.94, 1] } : {}}
							transition={{ duration: 0.35 }}
							className="mt-3"
						>
							{step < 4 ? (
								<span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--white)] px-4 py-2 text-xs font-medium text-[var(--bg-base)]">
									<Check className="h-3.5 w-3.5" />
									{t('approve')}
								</span>
							) : (
								<motion.span
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-600"
								>
									<CheckCircle2 className="h-3.5 w-3.5" />
									{t('approved')}
								</motion.span>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Closing note */}
			<AnimatePresence>
				{step >= 4 && (
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="text-center text-xs text-[var(--text-muted)]"
					>
						{t('note')}
					</motion.p>
				)}
			</AnimatePresence>
		</div>
	)
}

/* ───────────────────────────────────────────────────────────────────────
   Capability rail — the live "subtitle track" of the demo. Whatever the
   agent is doing inside the frame lights up here, and everything the
   visitor has already seen keeps a check mark.
   ─────────────────────────────────────────────────────────────────────── */

function CapabilityRail({
	spot,
	seen,
}: {
	spot: CapKey | null
	seen: Set<CapKey>
}) {
	const tCap = useTranslations('marketing.demo.capabilities')

	return (
		<div className="lg:sticky lg:top-24">
			<h3 className="text-2xl font-light text-[var(--text-primary)] md:text-3xl">
				{tCap('title')}
			</h3>
			<p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
				{tCap('subtitle')}
			</p>

			<div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
				{CAP_ITEMS.map(({ key, icon: Icon }, i) => {
					const isActive = spot === key
					const isSeen = seen.has(key)
					return (
						<motion.div
							key={key}
							initial={{ opacity: 0, x: 20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true, margin: '-40px' }}
							transition={{ duration: 0.45, delay: 0.1 + i * 0.06 }}
							className={cn(
								'relative flex items-center gap-3 rounded-xl border p-3 transition-all duration-300',
								isActive
									? 'border-[var(--border-strong)] bg-[var(--white-05)] shadow-[0_4px_20px_rgba(var(--ink-rgb),0.08)]'
									: 'border-[var(--border-default)] bg-transparent',
							)}
						>
							{isActive && (
								<motion.span
									layoutId="cap-glow"
									aria-hidden
									className="absolute inset-0 rounded-xl border border-[var(--border-strong)]"
									transition={{ type: 'spring', stiffness: 350, damping: 32 }}
								/>
							)}
							<span
								className={cn(
									'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-300',
									isActive
										? 'border-transparent bg-[var(--white)] text-[var(--bg-base)]'
										: 'border-[var(--border-default)] bg-[var(--white-05)] text-[var(--text-secondary)]',
								)}
							>
								<Icon className="h-4 w-4" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-[13px] font-medium leading-snug text-[var(--text-primary)]">
									{tCap(`items.${key}.title`)}
								</span>
								<span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-muted)]">
									{tCap(`items.${key}.desc`)}
								</span>
							</span>
							<AnimatePresence mode="wait" initial={false}>
								{isActive ? (
									<motion.span
										key="live"
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.8 }}
										transition={{ duration: 0.25 }}
										className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--white)] px-2.5 py-1 text-[9px] font-medium text-[var(--bg-base)]"
									>
										<span className="relative flex h-1.5 w-1.5">
											<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
											<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
										</span>
										{tCap('live')}
									</motion.span>
								) : isSeen ? (
									<motion.span
										key="seen"
										initial={{ opacity: 0, scale: 0.5 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ type: 'spring', stiffness: 500, damping: 25 }}
										title={tCap('seen')}
										className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--white)] text-[var(--bg-base)]"
									>
										<Check className="h-3 w-3" />
									</motion.span>
								) : null}
							</AnimatePresence>
						</motion.div>
					)
				})}
			</div>
		</div>
	)
}

/* ───────────────────────────────────────────────────────────────────────
   DemoSection — a full product tour inside one fixed-size browser frame.
   Autoplays chat → dashboard → learning; the visitor can take over with
   the view tabs at any time. The capability rail narrates the tour live.
   ─────────────────────────────────────────────────────────────────────── */

export function DemoSection() {
	const t = useTranslations('marketing.demo')

	const [view, setView] = useState<ViewId>('chat')
	const [autopilot, setAutopilot] = useState(true)
	const [cycle, setCycle] = useState(0)
	const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

	// Live capability narration. The tour only moves *forward*: a capability
	// lights up the first time it appears and then keeps its check mark —
	// re-using it later never yanks the highlight backwards.
	const [spot, setSpot] = useState<CapKey | null>(null)
	const [seen, setSeen] = useState<Set<CapKey>>(new Set())
	const seenRef = useRef<Set<CapKey>>(new Set())
	const handleSpot = useCallback((key: CapKey) => {
		if (seenRef.current.has(key)) return
		seenRef.current.add(key)
		setSeen(new Set(seenRef.current))
		setSpot(key)
	}, [])

	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once: true, margin: '-120px' })

	useEffect(() => () => clearTimeout(advanceTimer.current), [])

	const handleViewDone = (v: ViewId) => {
		if (!autopilot) return
		const next: Record<ViewId, ViewId | null> = {
			chat: 'dashboard',
			dashboard: 'learning',
			learning: null,
		}
		const n = next[v]
		advanceTimer.current = setTimeout(() => {
			if (n) setView(n)
			else setAutopilot(false)
		}, 1600)
	}

	const selectView = (v: ViewId) => {
		clearTimeout(advanceTimer.current)
		setAutopilot(false)
		setView(v)
	}

	const stopAutopilot = () => {
		clearTimeout(advanceTimer.current)
		setAutopilot(false)
	}

	const replayAll = () => {
		clearTimeout(advanceTimer.current)
		setCycle((n) => n + 1)
		seenRef.current = new Set()
		setSeen(new Set())
		setSpot(null)
		setAutopilot(true)
		setView('chat')
	}

	return (
		<section id="demo" className="relative overflow-hidden bg-[var(--bg-base)] py-20 md:py-28">
			{/* Ambient glow behind the product frame */}
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.07] blur-[100px]"
				style={{ background: 'var(--white)' }}
			/>

			<div className="relative mx-auto max-w-7xl px-6">
				<div className="text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
							<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
						</span>
						{t('eyebrow')}
					</span>
				</div>
				<h2 className="mt-6 text-center text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
					{t('title')}
				</h2>
				<p className="mx-auto mt-4 max-w-lg text-center text-[var(--text-secondary)]">
					{t('subtitle')}
				</p>

				<div className="mt-14 grid grid-cols-1 items-start gap-10 lg:grid-cols-[7fr_4fr] lg:gap-12">
					{/* ─── Product frame ──────────────────────────────────────── */}
					<motion.div
						ref={ref}
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-80px' }}
						transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
					>
						<div className="overflow-hidden rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-surface)] shadow-2xl shadow-black/5">
							{/* Browser chrome */}
							<div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-2.5">
								<div className="flex gap-1.5" aria-hidden>
									<span className="h-2.5 w-2.5 rounded-full bg-[var(--white-30)]" />
									<span className="h-2.5 w-2.5 rounded-full bg-[var(--white-10)]" />
									<span className="h-2.5 w-2.5 rounded-full bg-[var(--white-10)]" />
								</div>
								<div
									dir="ltr"
									className="flex-1 rounded-lg bg-[var(--white-05)] px-3 py-1 text-center font-mono text-[10px] text-[var(--text-muted)]"
								>
									app.vigent.ir
								</div>
								<AnimatePresence>
									{!autopilot && (
										<motion.button
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											type="button"
											onClick={replayAll}
											className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
										>
											<RotateCcw className="h-3 w-3" />
											{t('replay')}
										</motion.button>
									)}
								</AnimatePresence>
							</div>

							{/* View tabs */}
							<div className="flex items-center gap-1 border-b border-[var(--border-default)] px-3 py-2">
								{VIEWS.map(({ id, icon: Icon }) => {
									const isActive = id === view
									return (
										<button
											key={id}
											type="button"
											onClick={() => selectView(id)}
											className={cn(
												'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
												isActive
													? 'text-[var(--bg-base)]'
													: 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
											)}
										>
											{isActive && (
												<motion.span
													layoutId="demo-view-pill"
													className="absolute inset-0 rounded-lg bg-[var(--white)]"
													transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
												/>
											)}
											<Icon className="relative h-3.5 w-3.5" />
											<span className="relative">{t(`views.${id}`)}</span>
										</button>
									)
								})}
								{autopilot && (
									<span className="ms-auto hidden items-center gap-1.5 text-[10px] text-[var(--text-muted)] sm:inline-flex">
										<span className="relative flex h-1.5 w-1.5">
											<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
											<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
										</span>
										{t('autoplayNote')}
									</span>
								)}
							</div>

							{/* View content — fixed height so the section never jumps */}
							<div className="relative h-[480px] sm:h-[500px]">
								<AnimatePresence mode="wait">
									<motion.div
										key={`${view}-${cycle}`}
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -12 }}
										transition={{ duration: 0.35, ease: 'easeOut' }}
										className="flex h-full flex-col"
									>
										{view === 'chat' && (
											<ChatView
												play={inView}
												onDone={() => handleViewDone('chat')}
												onInteract={stopAutopilot}
												onSpot={handleSpot}
											/>
										)}
										{view === 'dashboard' && (
											<DashboardView
												onDone={() => handleViewDone('dashboard')}
												onSpot={handleSpot}
											/>
										)}
										{view === 'learning' && (
											<LearningView
												onDone={() => handleViewDone('learning')}
												onSpot={handleSpot}
											/>
										)}
									</motion.div>
								</AnimatePresence>
							</div>
						</div>

						{/* CTA under the frame */}
						<motion.div
							initial={{ opacity: 0 }}
							whileInView={{ opacity: 1 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.3 }}
							className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] px-5 py-4 sm:flex-row"
						>
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 shrink-0 text-[var(--text-primary)]" />
								<p className="text-sm text-[var(--text-secondary)]">{t('ctaStartDesc')}</p>
							</div>
							<Link
								href="/login"
								className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.03]"
							>
								{t('ctaStart')}
								<ArrowRight className="h-4 w-4 rtl:rotate-180" />
							</Link>
						</motion.div>
					</motion.div>

					{/* ─── Live capability rail ────────────────────────────────── */}
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-80px' }}
						transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
					>
						<CapabilityRail spot={spot} seen={seen} />
					</motion.div>
				</div>
			</div>
		</section>
	)
}
