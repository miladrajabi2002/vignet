'use client'

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, m, useInView, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import {
	BarChart3,
	BadgeCheck,
	BookOpenCheck,
	Bot,
	Box,
	Bookmark,
	BriefcaseBusiness,
	CalendarCheck2,
	Check,
	CheckCircle2,
	CircleDollarSign,
	Forward,
	GraduationCap,
	Heart,
	Layers,
	Link2,
	MessageCircle,
	MessageCircleMore,
	MessagesSquare,
	Mic,
	MoveRight,
	PackageCheck,
	ScanSearch,
	Send,
	ShieldCheck,
	ShoppingBag,
	Sparkles,
	Store,
	Target,
	UtensilsCrossed,
	Wand2,
	Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstagramIcon, TelegramIcon } from '@/components/marketing/social-links'
import { EASE_OUT } from './scroll'
import type { ChatScenario, IconName } from './content'
import type { HomeLocale, PlanPreview } from './types'

/* ------------------------------------------------------------------ */
/* Icon registry                                                       */
/* ------------------------------------------------------------------ */

type IconComponent = ComponentType<{ className?: string }>

const ICONS: Record<IconName, IconComponent> = {
	book: BookOpenCheck,
	box: Box,
	messages: MessagesSquare,
	users: MessageCircleMore,
	store: Store,
	calendar: CalendarCheck2,
	utensils: UtensilsCrossed,
	briefcase: BriefcaseBusiness,
	graduation: GraduationCap,
	instagram: InstagramIcon,
	mic: Mic,
	chart: BarChart3,
	handoff: Forward,
	spark: Sparkles,
	target: Target,
	plug: Link2,
}

export function ProductIcon({ name, className }: { name: IconName; className?: string }) {
	const Icon = ICONS[name] ?? Sparkles
	return <Icon aria-hidden className={className} />
}

export function LiveDot({ inverse = false, className }: { inverse?: boolean; className?: string }) {
	return (
		<span
			className={cn(
				'inline-flex h-2 w-2 rounded-full',
				inverse ? 'bg-emerald-300 text-emerald-300' : 'bg-emerald-500 text-emerald-500',
				className,
			)}
		/>
	)
}

/* ------------------------------------------------------------------ */
/* Chat simulation — auto-playing, typing + word-by-word streaming     */
/* ------------------------------------------------------------------ */

type ChatClock = {
	events: Array<{ t: number; step: number; words?: number; typing?: 'on' | 'off' }>
	total: number
}

function buildChatClock(scenario: ChatScenario): ChatClock {
	const events: ChatClock['events'] = []
	let base = 240
	for (let i = 0; i < scenario.messages.length; i += 1) {
		const message = scenario.messages[i]
		if (message.kind === 'user') {
			events.push({ t: base, step: i })
			base += 620
		} else if (message.kind === 'agent') {
			events.push({ t: base, step: i, typing: 'on' })
			base += 520
			events.push({ t: base, step: i, typing: 'off', words: 0 })
			const words = message.text.split(' ').length
			base += 48
			for (let w = 1; w < words; w += 1) {
				events.push({ t: base, step: i, words: w })
				base += 48
			}
			base += 360
		} else if (message.kind === 'card' || message.kind === 'handoff') {
			events.push({ t: base, step: i })
			base += 680
		}
	}
	return { events, total: base + 1500 }
}

type ChatPlayback = {
	visible: number
	typingStep: number
	wordsShown: Map<number, number>
}

function playbackAt(clock: ChatClock, elapsed: number): ChatPlayback {
	const wordsShown = new Map<number, number>()
	let visible = -1
	let typingStep = -1
	for (const event of clock.events) {
		if (event.t > elapsed) break
		if (event.typing === 'on') typingStep = event.step
		if (event.typing === 'off') typingStep = -1
		if (typeof event.words === 'number') wordsShown.set(event.step, event.words)
		if (event.words === 0) visible = Math.max(visible, event.step)
		if (event.typing === 'on' || event.typing === 'off') continue
		if (typeof event.words === 'number' && event.words > 0) {
			visible = Math.max(visible, event.step)
		} else if (!event.typing) {
			visible = Math.max(visible, event.step)
		}
	}
	return { visible, typingStep, wordsShown }
}

export function ChatThread({
	scenario,
	locale,
	inverse = true,
	className,
	showHeader = true,
	height = 'min-h-[430px]',
	loop = true,
}: {
	scenario: ChatScenario
	locale: HomeLocale
	inverse?: boolean
	className?: string
	showHeader?: boolean
	height?: string
	loop?: boolean
}) {
	const reduce = useReducedMotion()
	const rootRef = useRef<HTMLDivElement>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const inView = useInView(rootRef, { amount: 0.35 })
	const [paused, setPaused] = useState(false)
	const [elapsed, setElapsed] = useState(0)
	const clock = useMemo(() => buildChatClock(scenario), [scenario])
	const playback = reduce
		? { visible: scenario.messages.length - 1, typingStep: -1, wordsShown: new Map() }
		: playbackAt(clock, elapsed)

	// Single rAF clock, started when in view, paused on hover / hidden tab.
	useEffect(() => {
		if (reduce || paused || !inView || document.visibilityState === 'hidden') return
		let frame = 0
		let start = performance.now() - elapsed
		const tick = (now: number) => {
			let current = now - start
			if (current >= clock.total) {
				if (loop) {
					start = now
					current = 0
				} else {
					setElapsed(clock.total)
					return
				}
			}
			setElapsed(current)
			frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reduce, paused, inView, clock, loop])

	// Keep the newest message in view as the thread grows.
	useEffect(() => {
		const node = scrollRef.current
		if (node) node.scrollTop = node.scrollHeight
	}, [elapsed])

	const fa = locale === 'fa'

	return (
		<div
			ref={rootRef}
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'relative w-full overflow-hidden rounded-[1.6rem] border shadow-[0_28px_85px_rgba(0,0,0,0.16)]',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocusCapture={() => setPaused(true)}
			onBlurCapture={() => setPaused(false)}
		>
			{showHeader ? (
				<div className={cn('flex items-center justify-between gap-3 border-b px-4 py-3.5', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
					<div className="flex min-w-0 items-center gap-3">
						<span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
							<Bot className="h-[18px] w-[18px]" aria-hidden />
						</span>
						<div className="min-w-0">
							<p className={cn('truncate text-[13px] font-semibold', inverse ? 'text-white' : 'text-black')}>
								{fa ? 'گفتگوی زنده' : 'Live conversation'}
							</p>
							<p className={cn('mt-0.5 flex items-center gap-1.5 truncate text-[11px]', inverse ? 'text-white/45' : 'text-black/45')}>
								<LiveDot inverse={inverse} className="livePulse" />
								{scenario.person} · {scenario.channel}
							</p>
						</div>
					</div>
					<span className={cn('inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium', inverse ? 'bg-emerald-300/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700')}>
						{fa ? 'پاسخ خودکار' : 'AI reply'}
					</span>
				</div>
			) : null}

			<div ref={scrollRef} className={cn('overflow-y-auto px-4 py-4', height)} style={{ scrollbarWidth: 'none' }}>
				<div className="flex flex-col gap-3">
					{scenario.messages.map((message, index) => {
						if (index > playback.visible) return null
						if (message.kind === 'user') {
							return (
								<m.div
									key={index}
									initial={reduce ? false : { opacity: 0, y: 14, scale: 0.96 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									transition={{ duration: 0.4, ease: EASE_OUT }}
									className="flex justify-start"
								>
									<div className={cn('max-w-[82%] rounded-2xl rounded-ss-md px-4 py-3 text-[13px] leading-6', inverse ? 'bg-white/[0.09] text-white/90' : 'bg-black/[0.05] text-black/85')}>
										{message.text}
									</div>
								</m.div>
							)
						}
						if (message.kind === 'agent') {
							const shown = playback.wordsShown.get(index)
							const streaming = typeof shown === 'number' && shown < message.text.split(' ').length - 1
							const words = message.text.split(' ')
							return (
								<m.div
									key={index}
									initial={reduce ? false : { opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.35, ease: EASE_OUT }}
									className="flex flex-col items-end gap-1.5"
								>
									{message.source ? (
										<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium', inverse ? 'bg-white/[0.06] text-emerald-200/90' : 'bg-emerald-50 text-emerald-700')}>
											<BookOpenCheck className="h-3 w-3" aria-hidden />
											{fa ? 'منبع: ' : 'Source: '}
											{message.source}
										</span>
									) : null}
									<div className={cn('max-w-[86%] rounded-2xl rounded-se-md px-4 py-3 text-[13px] leading-6', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
										{reduce
											? message.text
											: words.slice(0, (shown ?? 0) + 1).map((word, w) => (
													<span key={w}>
														{word}{' '}
														{streaming && w === Math.min(shown ?? 0, words.length - 1) ? (
															<span className={cn('inline-block h-3.5 w-[2px] translate-y-0.5 rounded-full', inverse ? 'bg-black/70' : 'bg-white/90')} />
														) : null}
													</span>
												))}
									</div>
								</m.div>
							)
						}
						if (message.kind === 'card') {
							return (
								<m.div
									key={index}
									initial={reduce ? false : { opacity: 0, y: 16, scale: 0.94 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									transition={{ type: 'spring', stiffness: 320, damping: 26 }}
									className="flex justify-end"
								>
									<div className={cn('w-[88%] overflow-hidden rounded-2xl border', inverse ? 'border-white/15 bg-white/[0.05]' : 'border-black/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]')}>
										<div className="flex gap-3">
											{message.image ? (
												<div className={cn('grid w-[88px] shrink-0 place-items-center text-[34px]', inverse ? 'bg-white/[0.07]' : 'bg-black/[0.04]')}>
													<span aria-hidden>{message.image}</span>
												</div>
											) : null}
											<div className="min-w-0 flex-1 py-2.5 pe-3.5">
												<div className="flex items-center justify-between gap-2">
													<span className={cn('flex items-center gap-1.5 truncate text-[11.5px] font-semibold', inverse ? 'text-white/90' : 'text-black/90')}>
														<PackageCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
														{message.title}
													</span>
													{message.badge ? (
														<span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600">{message.badge}</span>
													) : null}
												</div>
												{message.price ? (
													<p className={cn('mt-1 text-[13px] font-bold tabular-nums', inverse ? 'text-emerald-300' : 'text-emerald-600')}>{message.price}</p>
												) : null}
												<ul className={cn('mt-1.5 space-y-1 text-[10.5px] leading-5', inverse ? 'text-white/55' : 'text-black/55')}>
													{message.lines.map((line) => (
														<li key={line} className="flex items-center gap-1.5">
															<Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" aria-hidden />
															{line}
														</li>
													))}
												</ul>
											</div>
										</div>
									</div>
								</m.div>
							)
						}
						return (
							<m.div
								key={index}
								initial={reduce ? false : { opacity: 0, y: 14 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.45, ease: EASE_OUT }}
								className={cn('flex items-start gap-2.5 rounded-2xl border border-dashed px-3.5 py-3', inverse ? 'border-amber-300/30 bg-amber-300/[0.07]' : 'border-amber-400/40 bg-amber-50')}
							>
								<Forward className={cn('mt-0.5 h-4 w-4 shrink-0', inverse ? 'text-amber-300' : 'text-amber-600')} aria-hidden />
								<div className="min-w-0">
									<p className={cn('text-[12px] font-semibold', inverse ? 'text-amber-200' : 'text-amber-800')}>🔔 {message.text}</p>
									<p className={cn('mt-1 text-[11px] leading-5', inverse ? 'text-white/55' : 'text-black/55')}>{message.summary}</p>
								</div>
							</m.div>
						)
					})}

					{playback.typingStep >= 0 ? (
						<div className="flex justify-end">
							<div className={cn('flex items-center gap-1.5 rounded-2xl px-4 py-3.5', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
								{[0, 1, 2].map((dot) => (
									<span key={dot} className={cn('typingDot h-1.5 w-1.5 rounded-full', inverse ? 'bg-black/60' : 'bg-white/70')} />
								))}
							</div>
						</div>
					) : null}

					{playback.visible === scenario.messages.length - 1 ? (
						<m.div
							initial={reduce ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							className={cn('mt-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold', inverse ? 'bg-emerald-300/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700')}
						>
							<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
							{scenario.outcome}
						</m.div>
					) : null}
				</div>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Unified inbox mock                                                  */
/* ------------------------------------------------------------------ */

export function InboxMock({
	locale,
	inverse = true,
	className,
}: {
	locale: HomeLocale
	inverse?: boolean
	className?: string
}) {
	const fa = locale === 'fa'
	const rows = [
		{ name: fa ? 'مریم احمدی' : 'Maryam Ahmadi', channel: fa ? 'تلگرام' : 'Telegram', icon: TelegramIcon, preview: fa ? 'سفارش من کی ارسال می‌شه؟' : 'When does my order ship?', tag: fa ? 'قصد خرید' : 'High intent', active: true },
		{ name: fa ? 'علی رضایی' : 'Ali Rezaei', channel: fa ? 'بله' : 'Bale', icon: MessageCircleMore, preview: fa ? 'برای شنبه وقت دارید؟' : 'Any slot on Saturday?', tag: fa ? 'رزرو' : 'Booking', active: false },
		{ name: fa ? 'نگار موسوی' : 'Negar Mousavi', channel: fa ? 'اینستاگرام' : 'Instagram', icon: InstagramIcon, preview: fa ? 'رنگ دیگه‌ای داره؟' : 'Any other colors?', tag: fa ? 'سرنخ' : 'Lead', active: false },
		{ name: fa ? 'حمید کریمی' : 'Hamid Karimi', channel: fa ? 'ویجت سایت' : 'Web widget', icon: Layers, preview: fa ? 'با کارشناس صحبت کنم' : 'Need a human expert', tag: fa ? 'تحویل اپراتور' : 'Handoff', active: false },
	]
	const [pulse, setPulse] = useState(0)
	useEffect(() => {
		const timer = window.setInterval(() => setPulse((p) => (p + 1) % rows.length), 2600)
		return () => window.clearInterval(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'overflow-hidden rounded-[1.6rem] border shadow-[0_28px_85px_rgba(0,0,0,0.16)]',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
		>
			<div className={cn('flex items-center justify-between border-b px-4 py-3.5', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
				<p className="text-[13px] font-semibold">{fa ? 'صندوق گفتگوی یکپارچه' : 'Unified inbox'}</p>
				<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium', inverse ? 'bg-emerald-300/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700')}>
					<LiveDot inverse={inverse} />
					{fa ? 'همهٔ کانال‌ها' : 'All channels'}
				</span>
			</div>
			<div className="divide-y" style={{ borderColor: inverse ? 'rgba(255,255,255,0.07)' : 'rgba(17,17,17,0.06)' }}>
				{rows.map((row, index) => (
					<m.div
						key={row.name}
						initial={{ opacity: 0, y: 12 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.4 }}
						transition={{ duration: 0.45, delay: index * 0.09, ease: EASE_OUT }}
						className={cn(
							'flex items-center gap-3 px-4 py-3 transition-colors',
							pulse === index && (inverse ? 'bg-white/[0.045]' : 'bg-black/[0.025]'),
						)}
					>
						<span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-bold', inverse ? 'bg-white/10 text-white' : 'bg-black/[0.06] text-black')}>
							{row.name.slice(0, 1)}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<p className={cn('truncate text-[12px] font-semibold', inverse ? 'text-white/90' : 'text-black/85')}>{row.name}</p>
								<span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium', inverse ? 'bg-white/[0.06] text-white/50' : 'bg-black/[0.04] text-black/50')}>
									<row.icon className="h-2.5 w-2.5" aria-hidden />
									{row.channel}
								</span>
							</div>
							<p className={cn('mt-0.5 truncate text-[11px]', inverse ? 'text-white/40' : 'text-black/45')}>{row.preview}</p>
						</div>
						<span
							className={cn(
								'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold',
								row.tag === (fa ? 'تحویل اپراتور' : 'Handoff')
									? 'bg-amber-400/15 text-amber-500'
									: 'bg-emerald-500/12 text-emerald-500',
							)}
						>
							{row.tag}
						</span>
					</m.div>
				))}
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Instagram automation mock                                           */
/* ------------------------------------------------------------------ */

export function InstagramMock({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const fa = locale === 'fa'
	const steps = [
		{ id: 'comment', title: fa ? 'کامنت «قیمت» می‌رسد' : 'Comment “price” arrives', detail: fa ? 'کاربر زیر پست جدید کامنت می‌گذارد' : 'A user comments on the new post' },
		{ id: 'reply', title: fa ? 'پاسخ خودکار + دایرکت' : 'Auto reply + DM', detail: fa ? 'کامنت عمومی جواب می‌گیرد و لینک در دایرکت می‌رود' : 'Public reply + link sent to DM' },
		{ id: 'follow', title: fa ? 'شرط: فالو + پیام' : 'Condition: follow + message', detail: fa ? 'کاربر باید فالو کند و پیام «فالو کردم» بفرستد' : 'User must follow and message “I followed”' },
		{ id: 'deliver', title: fa ? 'سپس پاسخ و لینک تحویل' : 'Then the reply and link arrive', detail: fa ? 'بدون مصرف اعتبار AI، خودکار و ثابت' : 'Deterministic — zero AI credit' },
	]
	const [step, setStep] = useState(0)
	useEffect(() => {
		const timer = window.setInterval(() => {
			setStep((current) => (current === steps.length - 1 ? 0 : current + 1))
		}, 2200)
		return () => window.clearInterval(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const liked = step >= 1
	const faNum = (n: string) => (fa ? n : n)

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'overflow-hidden rounded-[1.6rem] border shadow-[0_28px_85px_rgba(0,0,0,0.2)]',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
		>
			<div className={cn('flex items-center justify-between border-b px-4 py-3.5', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
				<p className="flex items-center gap-2 text-[13px] font-semibold">
					<InstagramIcon className="h-4 w-4" aria-hidden />
					{fa ? 'اتوماسیون اینستاگرام' : 'Instagram automation'}
				</p>
				<span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-bold text-emerald-500">
					{fa ? 'بدون اعتبار AI' : 'Zero AI credit'}
				</span>
			</div>
			<div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
				{/* Faithful Instagram post card — always light to match the real app */}
				<div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-xl border border-black/10 bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
					{/* Post header with story ring */}
					<div className="flex items-center gap-2.5 px-3 py-2.5">
						<span
							aria-hidden
							className="grid h-9 w-9 shrink-0 place-items-center rounded-full p-[2px]"
							style={{ background: 'linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)' }}
						>
							<span className="grid h-full w-full place-items-center rounded-full bg-white p-[1.5px]">
								<span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[12px] font-bold text-white">
									{fa ? 'ف' : 'V'}
								</span>
							</span>
						</span>
						<div className="min-w-0 leading-tight">
							<p className="flex items-center gap-1 text-[12.5px] font-semibold">
								your.store
								<BadgeCheck className="h-3.5 w-3.5 text-[#0095F6]" aria-hidden />
							</p>
							<p className="text-[10px] text-black/55">{fa ? 'اصلی · تهران' : 'Original · Tehran'}</p>
						</div>
						<span className="ms-auto text-[18px] leading-none text-black/80">•••</span>
					</div>

					{/* Image area — product flat-lay gradient */}
					<div className="relative grid aspect-square place-items-center overflow-hidden" style={{ background: 'linear-gradient(135deg,#f6d365 0%,#fda085 45%,#d4768c 100%)' }}>
						<span aria-hidden className="text-[68px] drop-shadow-[0_6px_18px_rgba(0,0,0,0.25)]">🧣</span>
						<span className="absolute bottom-2.5 end-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
							{fa ? '۳ رنگ موجود' : '3 colors in stock'}
						</span>
					</div>

					{/* Action bar */}
					<div className="flex items-center gap-4 px-3 pt-2.5">
						<Heart
							className={cn('h-6 w-6 transition-colors duration-300', liked ? 'fill-[#FF3040] text-[#FF3040]' : 'text-black')}
							aria-hidden
						/>
						<MessageCircle className="h-6 w-6 -scale-x-100 text-black" aria-hidden />
						<Send className="h-6 w-6 text-black" aria-hidden />
						<Bookmark className="ms-auto h-6 w-6 text-black" aria-hidden />
					</div>

					{/* Likes + caption */}
					<p className="px-3 pt-2 text-[12px] font-semibold">{faNum(fa ? '۱٬۲۴۸ پسند' : '1,248 likes')}</p>
					<p className="px-3 mt-1 text-[12px] leading-5">
						<span className="font-semibold">your.store</span>{' '}
						{fa ? 'شال گردن پشم، سه رنگ کرم، سرمه‌ای و صورتی 🧣 کامنت «قیمت» تا لینک خرید برات بیاد ✨' : 'Wool knit scarf — cream, navy and pink 🧣 Comment “price” for the checkout link ✨'}
					</p>

					{/* Comments */}
					<div className="px-3 pt-2.5 pb-1">
						<p className="text-[10.5px] text-black/45">{fa ? 'مشاهدهٔ همهٔ نظرها (۳۸)' : 'View all 38 comments'}</p>
						<AnimatePresence mode="wait" initial={false}>
							<m.div
								key={step}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								transition={{ duration: 0.28, ease: EASE_OUT }}
								className="mt-1.5 space-y-1"
							>
								<p className="text-[11.5px] leading-5">
									<span className="font-semibold">negar_m</span> {fa ? 'قیمت؟ 🤩' : 'Price? 🤩'}
								</p>
								<p className="text-[11.5px] leading-5">
									<span className="font-semibold text-[#00376B]">your.store</span>{' '}
									{fa ? 'سلام! لینک تو دایرکت شد 💌' : 'Hi! Link sent to your DM 💌'}
								</p>
							</m.div>
						</AnimatePresence>
					</div>

					{/* Add comment bar */}
					<div className="mt-1 flex items-center gap-2 border-t border-black/[0.07] px-3 py-2">
						<span className="text-[11px] text-black/40">{fa ? 'افزودن نظر...' : 'Add a comment...'}</span>
						<button type="button" className="ms-auto text-[11px] font-semibold text-[#0095F6]">
							{fa ? 'ارسال' : 'Post'}
						</button>
					</div>
				</div>

				{/* Follow funnel */}
				<div className="flex flex-col justify-center gap-2.5">
					{steps.map((item, index) => (
						<div
							key={item.id}
							className={cn(
								'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-300',
								index === step
									? inverse
										? 'border-emerald-300/40 bg-emerald-300/[0.08]'
										: 'border-emerald-400/50 bg-emerald-50'
									: inverse
										? 'border-white/[0.08] bg-white/[0.03]'
										: 'border-black/[0.06] bg-black/[0.02]',
							)}
						>
							<span
								className={cn(
									'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors',
									index < step || index === step
										? 'bg-emerald-500 text-white'
										: inverse
											? 'bg-white/10 text-white/50'
											: 'bg-black/[0.07] text-black/50',
								)}
							>
								{index < step || index === step ? <Check className="h-3.5 w-3.5" aria-hidden /> : fa ? new Intl.NumberFormat('fa-IR').format(index + 1) : index + 1}
							</span>
							<div className="min-w-0">
								<p className={cn('truncate text-[11.5px] font-semibold', index === step && (inverse ? 'text-emerald-200' : 'text-emerald-700'))}>{item.title}</p>
								<p className={cn('truncate text-[10px]', inverse ? 'text-white/40' : 'text-black/45')}>{item.detail}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Knowledge flow — sources feeding the agent core                     */
/* ------------------------------------------------------------------ */

export function KnowledgeFlow({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const fa = locale === 'fa'
	const sources = [
		{ icon: BookOpenCheck, label: fa ? 'پایگاه دانش' : 'Knowledge base', detail: fa ? '۴۲ قطعه' : '42 chunks' },
		{ icon: Box, label: fa ? 'کاتالوگ محصول' : 'Product catalog', detail: fa ? '۱۲۸ محصول' : '128 products' },
		{ icon: ScanSearch, label: fa ? 'خزش سایت' : 'Website crawl', detail: fa ? 'به‌روزرسانی خودکار' : 'Auto refresh' },
		{ icon: GraduationCap, label: fa ? 'مرکز یادگیری' : 'Learning center', detail: fa ? '۷ پاسخ تأییدشده' : '7 approved' },
	]
	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'relative overflow-hidden rounded-[1.6rem] border p-5 shadow-[0_28px_85px_rgba(0,0,0,0.18)] sm:p-6',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
		>
			<div className="grid items-center gap-5 sm:grid-cols-[1fr_auto_1fr]">
				<div className="space-y-2.5">
					{sources.map((source, index) => (
						<m.div
							key={source.label}
							initial={{ opacity: 0, x: fa ? 18 : -18 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true, amount: 0.5 }}
							transition={{ duration: 0.5, delay: index * 0.12, ease: EASE_OUT }}
							className={cn(
								'flex items-center gap-3 rounded-xl border px-3.5 py-2.5',
								inverse ? 'border-white/[0.09] bg-white/[0.04]' : 'border-black/[0.07] bg-white',
							)}
						>
							<span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
								<source.icon className="h-4 w-4" aria-hidden />
							</span>
							<div className="min-w-0">
								<p className="truncate text-[12px] font-semibold">{source.label}</p>
								<p className={cn('truncate text-[10px]', inverse ? 'text-white/40' : 'text-black/45')}>{source.detail}</p>
							</div>
						</m.div>
					))}
				</div>
				<div className="relative grid place-items-center py-2">
					<svg width="86" height="86" viewBox="0 0 86 86" className="orbit" aria-hidden>
						<circle cx="43" cy="43" r="40" fill="none" stroke={inverse ? 'rgba(255,255,255,0.14)' : 'rgba(17,17,17,0.14)'} strokeDasharray="3 6" />
						<circle cx="43" cy="3" r="3.5" fill="#10b981" />
					</svg>
					<m.span
						aria-hidden
						className="absolute grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_0_45px_rgba(16,185,129,0.45)]"
						animate={{ scale: [1, 1.05, 1] }}
						transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
					>
						<Bot className="h-6 w-6" aria-hidden />
					</m.span>
				</div>
				<div className="space-y-2.5">
					<m.div
						initial={{ opacity: 0, y: 12 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.5 }}
						transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT }}
						className={cn('rounded-xl border p-3.5', inverse ? 'border-white/[0.09] bg-white text-black' : 'border-black/[0.08] bg-black text-white')}
					>
						<p className="text-[10px] font-bold opacity-45">{fa ? 'پاسخ با ذکر منبع' : 'Answer with source'}</p>
						<p className="mt-1.5 text-[12px] leading-6">
							{fa ? '«بله، کت گرامی مشکی تا سایز L موجود است؛ ارسال از تهران ۲ روزه است.»' : '“Yes, the Grami jacket is in stock up to size L; ships from Tehran in 2 days.”'}
						</p>
						<span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
							<ShieldCheck className="h-3 w-3" aria-hidden />
							{fa ? 'از کاتالوگ + راهنمای ارسال' : 'From catalog + shipping guide'}
						</span>
					</m.div>
					<m.div
						initial={{ opacity: 0, y: 12 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.5 }}
						transition={{ duration: 0.5, delay: 0.38, ease: EASE_OUT }}
						className={cn('flex items-center gap-3 rounded-xl border border-dashed px-3.5 py-3', inverse ? 'border-white/20' : 'border-black/15')}
					>
						<Wand2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
						<p className={cn('text-[11px] leading-5', inverse ? 'text-white/55' : 'text-black/55')}>
							{fa ? 'سؤال بی‌پاسخ؟ پیشنهاد پاسخ می‌سازد؛ با تأیید شما برای همیشه یاد می‌گیرد.' : 'Unanswered? A suggested reply awaits one approval — then it is learned forever.'}
						</p>
					</m.div>
				</div>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Booking mock — conflict-free calendar                               */
/* ------------------------------------------------------------------ */

const BOOKING_SLOTS = [
	[1, 1, 0, 1, 0],
	[0, 1, 1, 1, 1],
	[1, 0, 0, 1, 0],
]

export function BookingMock({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const fa = locale === 'fa'
	const days = fa ? ['شنبه', 'یک‌شنبه', 'دوشنبه'] : ['Sat', 'Sun', 'Mon']
	const [selection, setSelection] = useState<[number, number] | null>(null)
	useEffect(() => {
		setSelection([2, 3])
		const timer = window.setInterval(() => {
			setSelection((previous) => {
				if (!previous) return previous
				const next: [number, number] = [(previous[0] + 1) % 3, (previous[1] + 2) % 5]
				while (BOOKING_SLOTS[next[0]][next[1]] === 1) next[1] = (next[1] + 1) % 5
				return next
			})
		}, 2000)
		return () => window.clearInterval(timer)
	}, [])

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'overflow-hidden rounded-[1.6rem] border shadow-[0_28px_85px_rgba(0,0,0,0.16)]',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
		>
			<div className={cn('flex items-center justify-between border-b px-4 py-3.5', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
				<p className="flex items-center gap-2 text-[13px] font-semibold">
					<CalendarCheck2 className="h-4 w-4 text-emerald-500" aria-hidden />
					{fa ? 'رزرو بدون تداخل' : 'Conflict-free booking'}
				</p>
				<span className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium', inverse ? 'bg-white/[0.06] text-white/50' : 'bg-black/[0.04] text-black/50')}>
					{fa ? 'تقویم زنده' : 'Live calendar'}
				</span>
			</div>
			<div className="p-4">
				<div className="grid grid-cols-3 gap-2">
					{days.map((day, dayIndex) => (
						<div key={day} className="space-y-1.5">
							<p className={cn('text-center text-[10px] font-bold', inverse ? 'text-white/45' : 'text-black/45')}>{day}</p>
							{BOOKING_SLOTS[dayIndex].map((busy, slotIndex) => {
								const isSelected = selection?.[0] === dayIndex && selection?.[1] === slotIndex
								return (
									<div
										key={slotIndex}
										className={cn(
											'grid h-7 place-items-center rounded-lg border text-[9.5px] font-semibold tabular-nums transition-all duration-300',
											isSelected
												? 'scale-[1.06] border-emerald-400 bg-emerald-500 text-white shadow-[0_6px_20px_rgba(16,185,129,0.4)]'
												: busy
													? inverse
														? 'border-transparent bg-white/[0.06] text-white/25 line-through'
														: 'border-transparent bg-black/[0.05] text-black/25 line-through'
													: inverse
														? 'border-white/15 text-white/70'
														: 'border-black/10 text-black/70',
										)}
									>
										{fa ? `۱۷:${String(slotIndex).padStart(2, '0')}` : `17:${String(slotIndex).padStart(2, '0')}`}
									</div>
								)
							})}
						</div>
					))}
				</div>
				<div className={cn('mt-4 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[10.5px]', inverse ? 'bg-emerald-300/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700')}>
					<span className="flex items-center gap-2 font-semibold">
						<Zap className="h-3.5 w-3.5" aria-hidden />
						{fa ? 'نوبت انتخابی قفل می‌شود' : 'Selected slot is held'}
					</span>
					<span>{fa ? 'بدون دوبار‌فروشی' : 'No double-booking'}</span>
				</div>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Analytics mock                                                      */
/* ------------------------------------------------------------------ */

export function AnalyticsMock({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const fa = locale === 'fa'
	const kpis = [
		{ value: 87, suffix: '٪', label: fa ? 'نرخ حل گفتگو' : 'Resolution rate', icon: CheckCircle2 },
		{ value: 1284, suffix: '', label: fa ? 'گفتگو در ۳۰ روز' : 'Conversations / 30d', icon: MessagesSquare },
		{ value: 4, suffix: '/۵', label: fa ? 'رضایت مشتری' : 'CSAT', icon: Heart },
		{ value: 96, suffix: '٪', label: fa ? 'پاسخ زیر ۱۰ ثانیه' : 'Replies < 10s', icon: Zap },
	]
	const trend =
		'M0,64 C24,58 36,44 58,46 C82,48 92,30 116,26 C140,22 150,34 174,22 C198,10 216,14 240,8'
	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'overflow-hidden rounded-[1.6rem] border shadow-[0_28px_85px_rgba(0,0,0,0.18)]',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
		>
			<div className={cn('flex items-center justify-between border-b px-4 py-3.5', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
				<p className="flex items-center gap-2 text-[13px] font-semibold">
					<BarChart3 className="h-4 w-4 text-emerald-500" aria-hidden />
					{fa ? 'گزارش عملکرد' : 'Performance'}
				</p>
				<span className={cn('rounded-full px-2.5 py-1 text-[10px]', inverse ? 'bg-white/[0.06] text-white/50' : 'bg-black/[0.04] text-black/50')}>{fa ? '۳۰ روز اخیر' : 'Last 30 days'}</span>
			</div>
			<div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
				{kpis.map((kpi) => (
					<div key={kpi.label} className={cn('rounded-xl border p-3', inverse ? 'border-white/[0.08] bg-white/[0.035]' : 'border-black/[0.06] bg-black/[0.02]')}>
						<kpi.icon className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
						<CountUpLike value={kpi.value} suffix={kpi.suffix} inverse={inverse} fa={fa} />
						<p className={cn('mt-1 text-[10px] leading-4', inverse ? 'text-white/40' : 'text-black/45')}>{kpi.label}</p>
					</div>
				))}
			</div>
			<div className="px-4 pb-4">
				<div className={cn('rounded-xl border p-3.5', inverse ? 'border-white/[0.08] bg-white/[0.025]' : 'border-black/[0.06] bg-white')}>
					<p className={cn('mb-2 text-[10px] font-bold', inverse ? 'text-white/45' : 'text-black/45')}>{fa ? 'روند گفتگوها' : 'Conversation trend'}</p>
					<svg viewBox="0 0 240 72" className="h-16 w-full" aria-hidden>
						<m.path
							d={trend}
							fill="none"
							stroke="#10b981"
							strokeWidth="2.5"
							strokeLinecap="round"
							initial={{ pathLength: 0 }}
							whileInView={{ pathLength: 1 }}
							viewport={{ once: true, amount: 0.6 }}
							transition={{ duration: 1.6, ease: EASE_OUT }}
						/>
					</svg>
				</div>
			</div>
		</div>
	)
}

function CountUpLike({ value, suffix, inverse, fa }: { value: number; suffix: string; inverse: boolean; fa: boolean }) {
	const ref = useRef<HTMLSpanElement>(null)
	const inView = useInView(ref, { once: true, amount: 0.6 })
	const [display, setDisplay] = useState(0)
	useEffect(() => {
		if (!inView) return
		let frame = 0
		const start = performance.now()
		const duration = 1300
		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / duration)
			setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))))
			if (progress < 1) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [inView, value])
	const format = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	return (
		<strong ref={ref} className={cn('mt-2.5 block text-lg font-semibold', inverse ? 'text-white' : 'text-black')}>
			{format.format(display)}
			{suffix}
		</strong>
	)
}

/* ------------------------------------------------------------------ */
/* Vigento six-layer blueprint                                         */
/* ------------------------------------------------------------------ */

export function VigentoLayers({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const fa = locale === 'fa'
	const layers = [
		{ title: fa ? 'شخصیت' : 'Personality', detail: fa ? 'مشاور فروش گرم و حرفه‌ای' : 'Warm professional sales consultant' },
		{ title: fa ? 'لحن' : 'Tone', detail: fa ? 'محاوره‌ای محترمانه، شما‌محور' : 'Casual-polite, customer-first' },
		{ title: fa ? 'قلمرو' : 'Scope', detail: fa ? 'فقط محصولات و خدمات ثبت‌شده' : 'Only registered products and services' },
		{ title: fa ? 'عدم آگاهی → تحویل' : 'Fallback → handoff', detail: fa ? 'موارد حساس به کارشناس انسانی' : 'Sensitive cases reach a human' },
		{ title: fa ? 'فرمت پاسخ' : 'Format', detail: fa ? 'کوتاه، دکمه‌دار، با کارت محصول' : 'Short, with buttons and product cards' },
		{ title: fa ? 'پرسش و پاسخ' : 'Q&A pairs', detail: fa ? '۱۸ پرسش آماده از دانش شما' : '18 seeded Q&As from your data' },
	]
	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'relative overflow-hidden rounded-[1.6rem] border p-5 shadow-[0_28px_85px_rgba(0,0,0,0.18)] sm:p-6',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
		>
			<div className={cn('mb-4 flex items-center justify-between border-b pb-3.5', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
				<p className="flex items-center gap-2 text-[13px] font-semibold">
					<Sparkles className="h-4 w-4 text-emerald-400" aria-hidden />
					{fa ? 'موتور پرامپت شش‌لایه ویجنتو' : 'Vigento six-layer prompt engine'}
				</p>
				<span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
					{fa ? 'قابل ویرایش' : 'Editable'}
				</span>
			</div>
			<div className="space-y-2">
				{layers.map((layer, index) => (
					<m.div
						key={layer.title}
						initial={{ opacity: 0, y: 14 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.4 }}
						transition={{ duration: 0.5, delay: index * 0.14, ease: EASE_OUT }}
						className={cn(
							'flex items-center gap-3 rounded-xl border px-3.5 py-2.5',
							inverse ? 'border-white/[0.08] bg-white/[0.035]' : 'border-black/[0.06] bg-black/[0.02]',
						)}
					>
						<span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold', inverse ? 'bg-white/10 text-emerald-300' : 'bg-black/[0.06] text-emerald-700')}>
							{fa ? new Intl.NumberFormat('fa-IR').format(index + 1) : index + 1}
						</span>
						<div className="min-w-0 flex-1">
							<p className="text-[12px] font-semibold">{layer.title}</p>
							<p className={cn('truncate text-[10.5px]', inverse ? 'text-white/40' : 'text-black/45')}>{layer.detail}</p>
						</div>
						<Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
					</m.div>
				))}
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Trace log — terminal-style decision trace (variant 4)               */
/* ------------------------------------------------------------------ */

export type TraceLine = { tone: 'in' | 'ai' | 'tool' | 'ok' | 'warn'; text: string }

export function TraceLog({
	lines,
	locale,
	className,
	title,
}: {
	lines: TraceLine[]
	locale: HomeLocale
	className?: string
	title?: string
}) {
	const fa = locale === 'fa'
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { amount: 0.3 })
	const [count, setCount] = useState(0)
	useEffect(() => {
		if (!inView) return
		const timer = window.setInterval(() => {
			setCount((current) => (current < lines.length ? current + 1 : current))
		}, 620)
		return () => window.clearInterval(timer)
	}, [inView, lines.length])
	useEffect(() => {
		if (count >= lines.length) {
			const reset = window.setTimeout(() => setCount(0), 3800)
			return () => window.clearTimeout(reset)
		}
	}, [count, lines.length])

	const toneClass: Record<TraceLine['tone'], string> = {
		in: 'text-sky-300',
		ai: 'text-emerald-300',
		tool: 'text-violet-300',
		ok: 'text-white/70',
		warn: 'text-amber-300',
	}
	return (
		<div
			ref={ref}
			dir="ltr"
			className={cn('overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#050505] font-mono shadow-[0_28px_85px_rgba(0,0,0,0.3)]', className)}
		>
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
					<span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
					<span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
				</div>
				<p className="text-[11px] font-medium text-white/45">{title ?? (fa ? 'ردی تصمیم ایجنت' : 'Agent decision trace')}</p>
			</div>
			<div className="min-h-[240px] space-y-2 p-4 text-[11.5px] leading-6">
				{lines.slice(0, count).map((line, index) => (
					<m.p
						key={`${index}-${line.text}`}
						initial={{ opacity: 0, x: -8 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.3, ease: EASE_OUT }}
						className={cn('flex gap-3', toneClass[line.tone])}
					>
						<span className="shrink-0 text-white/25">{String(index + 1).padStart(2, '0')}</span>
						<span dir="auto">{line.text}</span>
					</m.p>
				))}
				{count < lines.length ? <span className="inline-block h-3.5 w-2 animate-pulse bg-emerald-300" /> : null}
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Credit meter — pay only for successful replies                       */
/* ------------------------------------------------------------------ */

export function CreditMeter({
	locale,
	plans,
	inverse = true,
	className,
}: {
	locale: HomeLocale
	plans: PlanPreview[]
	inverse?: boolean
	className?: string
}) {
	const fa = locale === 'fa'
	const [balance, setBalance] = useState(100)
	const [state, setState] = useState<'idle' | 'charging' | 'success' | 'failed'>('idle')
	useEffect(() => {
		const sequence = ['idle', 'charging', 'success', 'idle', 'charging', 'failed'] as const
		let index = 0
		const timer = window.setInterval(() => {
			index = (index + 1) % sequence.length
			const next = sequence[index]
			setState(next)
			if (next === 'success') setBalance((b) => Math.max(40, b - 3))
		}, 1500)
		return () => window.clearInterval(timer)
	}, [])
	const pro = plans.find((plan) => plan.key === 'PRO') ?? plans[0]
	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'overflow-hidden rounded-[1.4rem] border p-4',
				inverse ? 'border-white/10 bg-white/[0.04] text-white' : 'border-black/[0.08] bg-white text-black',
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<p className="flex items-center gap-2 text-[12px] font-semibold">
					<CircleDollarSign className="h-4 w-4 text-emerald-500" aria-hidden />
					{fa ? 'کیف پول پاسخ' : 'Reply wallet'}
				</p>
				<span className="text-[11px] font-bold tabular-nums text-emerald-500">
					{fa ? new Intl.NumberFormat('fa-IR').format(balance * 1000) : balance * 1000}
				</span>
			</div>
			<div className={cn('mt-3 h-2 overflow-hidden rounded-full', inverse ? 'bg-white/10' : 'bg-black/10')}>
				<m.div
					className="h-full rounded-full bg-emerald-500"
					animate={{ width: `${balance}%` }}
					transition={{ duration: 0.6, ease: EASE_OUT }}
				/>
			</div>
			<div className="mt-3 h-14">
				<AnimatePresence mode="wait">
					{state === 'charging' ? (
						<m.p key="charging" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[11px] text-white/60">
							{fa ? 'در حال تولید پاسخ… اعتبار موقتاً رزرو شد' : 'Generating reply… credit temporarily held'}
						</m.p>
					) : state === 'success' ? (
						<m.p key="success" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
							<CheckCircle2 className="h-4 w-4" aria-hidden />
							{fa ? `پاسخ موفق — فقط ${pro?.replyPrice ?? '۳۰'} تومان کسر شد` : `Successful reply — only ${pro?.replyPrice ?? '30'} toman deducted`}
						</m.p>
					) : state === 'failed' ? (
						<m.p key="failed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[11px] font-semibold text-amber-300">
							{fa ? 'پاسخ ناموفق — اعتبار به‌طور کامل برگشت خورد ✳️' : 'Failed reply — credit fully refunded'}
						</m.p>
					) : (
						<m.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-white/40">
							{fa ? 'منقضی نمی‌شود · فقط پاسخ موفق هزینه دارد' : 'Never expires · only successful replies cost'}
						</m.p>
					)}
				</AnimatePresence>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */

export function MockFrame({
	children,
	label,
	inverse = false,
	className,
}: {
	children: ReactNode
	label?: string
	inverse?: boolean
	className?: string
}) {
	return (
		<div className={cn('relative', className)}>
			{label ? (
				<span
					className={cn(
						'absolute -top-3 start-4 z-10 rounded-full px-3 py-1 text-[10px] font-bold shadow-[0_6px_18px_rgba(0,0,0,0.12)]',
						inverse ? 'bg-black text-white' : 'bg-white text-black',
					)}
				>
					{label}
				</span>
			) : null}
			{children}
		</div>
	)
}

export function useSectionTint(progress: MotionValue<number>, from: number, to: number) {
	return useTransform(progress, [0, 1], [from, to])
}

export function ChannelRow({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	const fa = locale === 'fa'
	const channels = [
		{ icon: InstagramIcon, label: fa ? 'اینستاگرام' : 'Instagram' },
		{ icon: TelegramIcon, label: fa ? 'تلگرام' : 'Telegram' },
		{ icon: MessageCircleMore, label: fa ? 'بله' : 'Bale' },
		{ icon: MoveRight, label: fa ? 'روبیکا' : 'Rubika' },
		{ icon: ShoppingBag, label: fa ? 'ویجت سایت' : 'Web widget' },
	]
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			{channels.map((channel) => (
				<span
					key={channel.label}
					className={cn(
						'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[11px] font-medium',
						inverse ? 'border-white/12 bg-white/[0.05] text-white/60' : 'border-black/[0.08] bg-white text-black/60',
					)}
				>
					<channel.icon className="h-3.5 w-3.5" aria-hidden />
					{channel.label}
				</span>
			))}
		</div>
	)
}
