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
	Camera,
	ChevronLeft,
	Check,
	CheckCircle2,
	CircleDollarSign,
	Forward,
	GraduationCap,
	Heart,
	Image as ImageIcon,
	Info,
	Layers,
	Link2,
	MessageCircle,
	MessageCircleMore,
	MessagesSquare,
	Mic,
	MoveRight,
	PackageCheck,
	Phone,
	ScanSearch,
	Send,
	ShieldCheck,
	ShoppingBag,
	Smile,
	Sparkles,
	Store,
	Target,
	UtensilsCrossed,
	Video,
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

export function InstagramAutomationPostMock({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
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
/* Instagram direct simulator — faithful UI + fast AI reply loop      */
/* ------------------------------------------------------------------ */

type InstagramDemoMode = 'direct' | 'story' | 'comment'

const INSTAGRAM_SCENARIO_DELAYS: Record<InstagramDemoMode, readonly number[]> = {
	direct: [650, 1600, 650, 1400, 2000, 1100, 650, 1400, 1400, 1700, 1100, 650, 1400, 4800],
	story: [2000, 1600, 700, 1400, 1900, 1250, 650, 1400, 4800],
	comment: [1600, 650, 900, 1200, 1400, 2400, 1250, 650, 1400, 4800],
}

function InstagramTyping({ fa }: { fa: boolean }) {
	return (
		<m.div
			initial={{ opacity: 0, transform: 'translateY(6px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }}
			exit={{ opacity: 0, transform: 'translateY(-3px) scale(0.98)' }}
			transition={{ duration: 0.2, ease: EASE_OUT }}
			className="mr-auto flex w-fit items-end gap-2"
		>
			<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[8px] font-bold text-white">V</span>
			<div className="rounded-[18px] rounded-bl-[5px] bg-[#efefef] px-3.5 py-3" aria-label={fa ? 'در حال نوشتن پاسخ هوشمند' : 'Writing an intelligent reply'}>
				<span className="flex items-center gap-1" aria-hidden>
					{[0, 1, 2].map((dot) => (
						<m.span
							key={dot}
							className="h-1.5 w-1.5 rounded-full bg-black/45"
							animate={{ opacity: [0.35, 1, 0.35], transform: ['translateY(0px)', 'translateY(-2px)', 'translateY(0px)'] }}
							transition={{ duration: 0.75, repeat: Infinity, delay: dot * 0.12, ease: 'easeInOut' }}
						/>
					))}
				</span>
			</div>
		</m.div>
	)
}

function DirectBubble({
	children,
	from,
	label,
	className,
}: {
	children: ReactNode
	from: 'customer' | 'agent'
	label?: string
	className?: string
}) {
	const agent = from === 'agent'
	return (
		<m.div
			initial={{ opacity: 0, transform: `translateY(8px) scale(0.97)` }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			transition={{ duration: 0.24, ease: EASE_OUT }}
			className={cn('flex max-w-[86%] flex-col', agent ? 'ml-auto items-end' : 'mr-auto items-start', className)}
		>
			{label ? <span className="mb-1 px-1 text-[8px] font-semibold text-[#8e8e93]">{label}</span> : null}
			<div
				className={cn(
					'px-3 py-2 text-[11px] leading-[1.75]',
					agent
						? 'rounded-[18px] rounded-br-[5px] bg-gradient-to-br from-[#7c3aed] via-[#a855f7] to-[#d946ef] text-white shadow-[0_5px_14px_rgba(168,85,247,0.18)]'
						: 'rounded-[18px] rounded-bl-[5px] bg-[#efefef] text-[#101010]',
				)}
			>
				{children}
			</div>
		</m.div>
	)
}

export function InstagramDirectScreen({ locale, step }: { locale: HomeLocale; step: number }) {
	const fa = locale === 'fa'
	return (
		<div className="flex h-full min-h-0 flex-col bg-white text-[#101010]" dir={fa ? 'rtl' : 'ltr'}>
			<div className="flex h-[48px] shrink-0 items-center border-b border-black/[0.08] px-2">
				<span className="grid h-10 w-10 shrink-0 place-items-center" aria-hidden>
					<ChevronLeft className={cn('h-6 w-6', fa && 'rotate-180')} strokeWidth={2.1} />
				</span>
				<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)' }}>
					<span className="grid h-full w-full place-items-center rounded-full bg-white p-[1.5px]">
						<span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[9px] font-bold text-white">V</span>
					</span>
				</span>
				<div className="ms-2 min-w-0 flex-1 leading-tight">
					<p className="flex items-center gap-1 text-[11.5px] font-semibold">vigent.store <BadgeCheck className="h-3 w-3 fill-[#0095f6] text-white" aria-hidden /></p>
					<p className="text-[8.5px] text-black/45">{fa ? 'فعال الان' : 'Active now'}</p>
				</div>
				<span className="grid h-10 w-10 place-items-center" aria-hidden><Phone className="h-[19px] w-[19px]" strokeWidth={1.9} /></span>
				<span className="grid h-10 w-10 place-items-center" aria-hidden><Video className="h-[21px] w-[21px]" strokeWidth={1.9} /></span>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-3">
				<div className="flex justify-center pb-3">
					<div className="text-center">
						<span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[14px] font-bold text-white">V</span>
						<p className="mt-1.5 text-[11px] font-semibold">Vigent Store</p>
						<p className="text-[8.5px] text-black/45">@vigent.store · Instagram</p>
					</div>
				</div>
				<div className="space-y-2.5" aria-live="polite">
					<DirectBubble from="customer">{fa ? 'سلام، شال کرم موجوده؟ قیمتش چنده؟' : 'Hi, is the cream scarf in stock? How much is it?'}</DirectBubble>

					<AnimatePresence mode="popLayout" initial={false}>
						{step === 1 ? <InstagramTyping key="typing-one" fa={fa} /> : null}
						{step >= 2 ? (
							<DirectBubble key="answer-one" from="agent" label={fa ? 'پاسخ هوشمند ویجنت' : 'Vigent smart reply'}>
								{fa ? 'سلام نگار جان 🌿 بله، رنگ کرم موجوده؛ قیمتش ۸۹۰ هزار تومنه.' : 'Hi Negar 🌿 Yes, cream is in stock; it is 890,000 tomans.'}
							</DirectBubble>
						) : null}
					</AnimatePresence>

					{step >= 3 ? <DirectBubble from="customer">{fa ? 'عالیه، لینک خریدش رو می‌فرستی؟' : 'Great, can you send the checkout link?'}</DirectBubble> : null}

					<AnimatePresence mode="popLayout" initial={false}>
						{step === 4 ? <InstagramTyping key="typing-two" fa={fa} /> : null}
						{step >= 5 ? (
							<DirectBubble key="answer-two" from="agent" label={fa ? 'از کاتالوگ و موجودی فروشگاه' : 'From catalog and live stock'}>
								<p>{fa ? 'حتماً، این هم لینک خرید. ارسال تهران فرداست 👇' : 'Of course — here is the checkout link. Tehran delivery is tomorrow 👇'}</p>
								<div className="mt-2 flex items-center gap-2 rounded-xl bg-white/95 p-2 text-[#101010] shadow-sm">
									<span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f1ece7] text-[#7c3aed]"><ShoppingBag className="h-4 w-4" aria-hidden /></span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-[9.5px] font-semibold">{fa ? 'شال پشمی کرم' : 'Cream wool scarf'}</p>
										<p className="text-[8.5px] text-black/55">{fa ? '۸۹۰٬۰۰۰ تومان · موجود' : '890,000 tomans · In stock'}</p>
									</div>
								</div>
							</DirectBubble>
						) : null}
					</AnimatePresence>
				</div>
			</div>

			<div className="shrink-0 px-2.5 pb-2.5">
				<div className="flex h-10 items-center gap-1.5 rounded-full border border-black/15 px-1.5">
					<span className="grid h-7 w-7 place-items-center rounded-full bg-[#3797f0] text-white"><InstagramIcon className="h-3.5 w-3.5" aria-hidden /></span>
					<span className="flex-1 px-1 text-[10px] text-black/38">{fa ? 'پیام...' : 'Message...'}</span>
					<span className="grid h-7 w-7 place-items-center" aria-hidden><ImageIcon className="h-[17px] w-[17px]" strokeWidth={1.8} /></span>
					<span className="grid h-7 w-7 place-items-center text-[17px]" aria-hidden>♡</span>
				</div>
			</div>
		</div>
	)
}

function InstagramAutomationScreen({ locale, step }: { locale: HomeLocale; step: number }) {
	const fa = locale === 'fa'
	const liked = step >= 1
	const commentText = fa ? 'لینک خرید این مدل رو می‌فرستین؟' : 'Can you send the checkout link for this one?'
	const typedComment = useInstagramTypedText(commentText, step === 0)
	return (
		<div className="flex h-full min-h-0 flex-col bg-black text-white" dir={fa ? 'rtl' : 'ltr'}>
			<div className="flex h-[52px] shrink-0 items-center border-b border-white/10 px-2.5">
				<InstagramIcon className="h-5 w-5" aria-hidden />
				<p className="ms-2 text-[12px] font-semibold">vigent.store</p>
				<span className="ms-auto grid h-10 w-10 place-items-center" aria-hidden><Info className="h-5 w-5" /></span>
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div className="flex items-center gap-2.5 px-3 py-2">
					<span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[9px] font-bold text-white">V</span>
					<p className="text-[11.5px] font-semibold">vigent.store</p>
					<span className="ms-auto text-[15px] tracking-[2px]">•••</span>
				</div>
				<div className="relative grid aspect-square max-h-[250px] w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,#fff8e9_0%,#f5d5b8_40%,#c98b70_100%)]">
					<div className="absolute h-28 w-28 rotate-[-9deg] rounded-[28px] bg-[#ece1d2] shadow-[0_22px_50px_rgba(66,35,20,0.24)]" />
					<ShoppingBag className="relative h-12 w-12 text-[#725343] drop-shadow-sm" strokeWidth={1.35} aria-hidden />
					<span className="absolute bottom-3 end-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">{fa ? '۳ رنگ موجود' : '3 colors'}</span>
				</div>
				<div className="flex items-center gap-3 px-3 py-2">
					<Heart className={cn('h-[22px] w-[22px] transition-colors duration-200', liked ? 'fill-[#ff3040] text-[#ff3040]' : 'text-white')} aria-hidden />
					<MessageCircle className="h-[22px] w-[22px] -scale-x-100" aria-hidden />
					<Send className="h-[21px] w-[21px]" aria-hidden />
					<Bookmark className="ms-auto h-[21px] w-[21px]" aria-hidden />
				</div>
				<p className="px-3 text-[10.5px] font-semibold">{fa ? '۱٬۲۴۸ پسند' : '1,248 likes'}</p>
				<p className="mt-1 px-3 text-[10.5px] leading-5"><span className="font-semibold">vigent.store</span> {fa ? 'مانتو کتان در دو رنگ کرم و مشکی. برای لینک خرید کامنت بذار.' : 'Linen coat in cream and black. Comment for the checkout link.'}</p>
				<div className="mt-2 border-t border-white/10 px-3 pt-2">
					<AnimatePresence mode="wait" initial={false}>
						{step === 0 ? (
							<m.div
								key="comment-draft"
								initial={{ opacity: 0, transform: 'translateY(6px)' }}
								animate={{ opacity: 1, transform: 'translateY(0px)' }}
								exit={{ opacity: 0, transform: 'translateY(-3px) scale(0.985)' }}
								transition={{ duration: 0.2, ease: EASE_OUT }}
								className="flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-2"
								aria-label={fa ? 'مشتری در حال نوشتن کامنت است' : 'The customer is typing a comment'}
							>
								<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[8px] font-semibold">M</span>
								<span dir={fa ? 'rtl' : 'ltr'} className="flex min-w-0 flex-1 items-center text-[10px] text-white/85">
									<bdi className="truncate">{typedComment}</bdi>
									<InstagramTypingCaret />
								</span>
								<span className="shrink-0 text-[9px] font-semibold text-[#0095f6]">{fa ? 'ارسال' : 'Post'}</span>
							</m.div>
						) : (
							<m.p key="sent-comment" initial={{ opacity: 0.2, transform: 'translate3d(7px, 8px, 0) scale(0.98)' }} animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }} transition={{ type: 'spring', duration: 0.42, bounce: 0 }} className="text-[11px] leading-5">
								<span className="font-semibold">maryam.karimi</span> {commentText}
							</m.p>
						)}
					</AnimatePresence>
					<AnimatePresence initial={false}>
						{step >= 2 ? (
							<m.p initial={{ opacity: 0, transform: 'translateY(5px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.2, ease: EASE_OUT }} className="mt-1.5 text-[10.5px] leading-5 text-white/70">
								<span className="font-semibold text-[#a8c7fa]">vigent.store</span> {fa ? 'حتماً مریم جان؛ دایرکت برات ارسال شد، پیام‌هات رو ببین 💌' : 'Of course, Maryam; I sent you a DM. Check your messages 💌'}
							</m.p>
						) : null}
					</AnimatePresence>
					{step >= 3 ? <m.span initial={{ opacity: 0, transform: 'translateY(4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[8.5px] font-semibold text-emerald-300"><Check className="h-3 w-3" aria-hidden />{fa ? 'دایرکت با موفقیت ارسال شد' : 'DM sent successfully'}</m.span> : null}
				</div>
			</div>
		</div>
	)
}

function InstagramDarkTyping({ fa }: { fa: boolean }) {
	return (
		<m.div
			layout
			initial={{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			exit={{ opacity: 0, transform: 'translateY(-2px) scale(0.94)' }}
			transition={{ duration: 0.24, ease: EASE_OUT, layout: { duration: 0.32, ease: EASE_OUT } }}
			className="mr-auto flex h-10 min-w-[68px] shrink-0 items-center justify-center rounded-[18px] rounded-bl-[5px] bg-gradient-to-r from-[#315cff] via-[#6848f5] to-[#8d35ed] px-4"
			aria-label={fa ? 'ویجنت در حال نوشتن پاسخ است' : 'Vigent is typing a reply'}
		>
			<span className="flex gap-1.5" aria-hidden>
				{[0, 1, 2].map((dot) => (
					<m.span
						key={dot}
						className="h-1.5 w-1.5 rounded-full bg-white/55"
						animate={{ opacity: [0.4, 1, 0.4], transform: ['translateY(0px)', 'translateY(-2px)', 'translateY(0px)'] }}
						transition={{ duration: 0.72, repeat: Infinity, delay: dot * 0.11, ease: 'easeInOut' }}
					/>
				))}
			</span>
		</m.div>
	)
}

function InstagramDarkMessage({ children, sent = false, className, delay = 0 }: { children: ReactNode; sent?: boolean; className?: string; delay?: number }) {
	const entranceDelay = delay + (sent ? 0.08 : 0)
	return (
		<m.div
			layout
			initial={{ opacity: sent ? 0.2 : 0, transform: sent ? 'translate3d(10px, 18px, 0) scale(0.965)' : 'translate3d(0, 14px, 0) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }}
			exit={{ opacity: 0, transform: sent ? 'translate3d(5px, -3px, 0) scale(0.97)' : 'translate3d(0, -4px, 0) scale(0.94)' }}
			transition={{
				opacity: { duration: sent ? 0.2 : 0.4, delay: entranceDelay, ease: EASE_OUT },
				transform: sent
					? { type: 'spring', duration: 0.46, bounce: 0, delay: entranceDelay }
					: { duration: 0.4, delay: entranceDelay, ease: EASE_OUT },
				layout: { type: 'spring', duration: 0.42, bounce: 0 },
			}}
			style={{ transformOrigin: sent ? 'right bottom' : 'left bottom' }}
			className={cn(
				'max-w-[82%] shrink-0 rounded-[19px] px-3.5 py-2.5 text-[12px] leading-[1.85] text-white',
				sent ? 'ml-auto rounded-br-[6px] bg-[#262626]' : 'mr-auto rounded-bl-[6px] bg-[#1f1f1f]',
				className,
			)}
		>
			{children}
		</m.div>
	)
}

function InstagramIncomingReply({
	fa,
	typing,
	visible,
	children,
}: {
	fa: boolean
	typing: boolean
	visible: boolean
	children: ReactNode
}) {
	return (
		<AnimatePresence mode="wait" initial={false}>
			{typing ? (
				<InstagramDarkTyping key="typing" fa={fa} />
			) : visible ? (
				<InstagramDarkMessage key="reply" delay={0.05}>
					{children}
				</InstagramDarkMessage>
			) : null}
		</AnimatePresence>
	)
}

function InstagramSeen({ fa }: { fa: boolean }) {
	return (
		<m.span
			layout="position"
			initial={{ opacity: 0, transform: 'translateY(3px)' }}
			animate={{ opacity: 1, transform: 'translateY(0px)' }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2, ease: EASE_OUT }}
			className="ml-auto shrink-0 pe-1 text-[8.5px] font-medium text-white/45"
			aria-label={fa ? 'پیام دیده شد' : 'Message seen'}
		>
			Seen
		</m.span>
	)
}

function InstagramStoryReplyCard({ locale }: { locale: HomeLocale }) {
	const fa = locale === 'fa'
	return (
		<m.div
			dir="ltr"
			layout="position"
			initial={{ opacity: 0, transform: 'translateY(14px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			transition={{ duration: 0.4, ease: EASE_OUT }}
			className="ml-auto flex w-[82%] shrink-0 flex-col items-end"
		>
			<span dir={fa ? 'rtl' : 'ltr'} className="mb-1 pe-1 text-[8.5px] text-white/45">{fa ? 'به استوری پاسخ دادید' : 'You replied to their story'}</span>
			<div className="relative h-[112px] w-[70px] overflow-hidden rounded-[12px] border border-white/15 bg-[radial-gradient(circle_at_28%_16%,#f8dfc7_0%,#b9816d_42%,#4b3039_78%,#181018_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
				<div className="absolute inset-x-1.5 top-1.5 flex items-center gap-1 text-[5.5px] font-semibold"><span className="grid h-2.5 w-2.5 place-items-center rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 text-[4px]">V</span>vigent.store</div>
				<div className="absolute bottom-7 left-1/2 h-10 w-8 -translate-x-1/2 -rotate-6 rounded-[10px] bg-[#eadac8]/85 shadow" />
				<ShoppingBag className="absolute bottom-[37px] left-1/2 h-4 w-4 -translate-x-1/2 text-[#725343]" strokeWidth={1.35} aria-hidden />
				<span className="absolute inset-x-1 bottom-1.5 rounded-full bg-black/55 px-1 py-0.5 text-center text-[5.5px] font-semibold">{fa ? 'مانتو کتان کرم' : 'Cream linen coat'}</span>
			</div>
			<InstagramDarkMessage sent className="mt-1.5 max-w-full">
				<span dir={fa ? 'rtl' : 'ltr'} className="block text-start">{fa ? 'این رنگ کرمش هنوز موجوده؟' : 'Is this cream color still available?'}</span>
			</InstagramDarkMessage>
		</m.div>
	)
}

function InstagramProductCatalog({ locale, compact = false }: { locale: HomeLocale; compact?: boolean }) {
	const fa = locale === 'fa'
	const products = [
		{ name: fa ? 'مانتو کتان کرم' : 'Cream linen coat', meta: fa ? 'سایز ۳۶ تا ۴۲' : 'Sizes 36–42', price: fa ? '۱٬۲۸۰٬۰۰۰ تومان' : '1,280,000 tomans', colors: 'from-[#ead9c5] to-[#b88b6d]' },
		{ name: fa ? 'مانتو کتان مشکی' : 'Black linen coat', meta: fa ? 'سایز ۳۸ تا ۴۴' : 'Sizes 38–44', price: fa ? '۱٬۳۵۰٬۰۰۰ تومان' : '1,350,000 tomans', colors: 'from-[#4b4b4b] to-[#111111]' },
	]
	return (
		<m.div
			layout="position"
			initial={{ opacity: 0, transform: 'translateY(14px) scale(0.97)' }}
			animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
			transition={{ duration: 0.4, ease: EASE_OUT, layout: { duration: 0.36, ease: EASE_OUT } }}
			className="mr-auto flex w-[92%] shrink-0 gap-2 overflow-hidden"
			aria-label={fa ? 'کاتالوگ محصولات پیشنهادی' : 'Suggested product catalog'}
		>
			{products.map((product) => (
				<div key={product.name} className={cn('min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#171717]', compact && 'first:flex-[1.12] last:flex-[0.88]')}>
					<div className={cn('relative grid place-items-center bg-gradient-to-br', product.colors, compact ? 'h-[70px]' : 'h-[82px]')}>
						<div className="h-12 w-10 -rotate-6 rounded-[13px] border border-white/25 bg-white/25 shadow-[0_12px_28px_rgba(0,0,0,0.25)]" />
						<ShoppingBag className="absolute h-5 w-5 text-white/85" strokeWidth={1.5} aria-hidden />
						<span className="absolute end-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-semibold text-white backdrop-blur">{fa ? 'موجود' : 'In stock'}</span>
					</div>
					<div className="p-2">
						<p className="truncate text-[9px] font-semibold text-white">{product.name}</p>
						<p className="mt-0.5 truncate text-[7.5px] text-white/45">{product.meta}</p>
						<p className="mt-1 text-[8px] font-semibold text-white/80">{product.price}</p>
						<span className="mt-1.5 grid h-6 place-items-center rounded-lg bg-white text-[7.5px] font-bold text-black">{fa ? 'مشاهده محصول' : 'View product'}</span>
					</div>
				</div>
			))}
		</m.div>
	)
}

function InstagramStoryViewer({ locale, step }: { locale: HomeLocale; step: number }) {
	const fa = locale === 'fa'
	const storyReply = fa ? 'این رنگ کرمش هنوز موجوده؟' : 'Is this cream color still available?'
	const typedStoryReply = useInstagramTypedText(storyReply, step === 1)
	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_30%_18%,#f8dfc7_0%,#b9816d_38%,#4b3039_72%,#181018_100%)] text-white" dir={fa ? 'rtl' : 'ltr'}>
			<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34),transparent_28%,transparent_68%,rgba(0,0,0,0.55))]" />
			<div className="relative z-10 px-3 pt-2">
				<div className="flex gap-1" aria-hidden>
					<span className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/35"><m.span className="block h-full origin-right bg-white" initial={{ transform: 'scaleX(0)' }} animate={{ transform: 'scaleX(1)' }} transition={{ duration: 3.5, ease: 'linear' }} /></span>
					<span className="h-[2px] flex-1 rounded-full bg-white/35" />
					<span className="h-[2px] flex-1 rounded-full bg-white/35" />
				</div>
				<div className="mt-2 flex items-center gap-2">
					<span className="grid h-8 w-8 place-items-center rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}>
						<span className="grid h-full w-full place-items-center rounded-full bg-[#1b1118] text-[9px] font-bold">V</span>
					</span>
					<p className="text-[10.5px] font-semibold">vigent.store</p>
					<span className="text-[8px] text-white/65">{fa ? '۲ ساعت' : '2h'}</span>
					<span className="ms-auto grid h-8 w-8 place-items-center text-[18px] tracking-[2px]" aria-hidden>•••</span>
				</div>
			</div>

			<div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center">
				<m.div initial={{ opacity: 0, transform: 'translateY(10px) rotate(-5deg)' }} animate={{ opacity: 1, transform: 'translateY(0px) rotate(-5deg)' }} transition={{ duration: 0.35, ease: EASE_OUT }} className="relative h-52 w-40 rounded-[32px] border border-white/20 bg-[#eadac8]/80 shadow-[0_32px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
					<div className="absolute inset-x-7 top-8 h-28 rounded-[24px] bg-white/22" />
					<ShoppingBag className="absolute left-1/2 top-[72px] h-12 w-12 -translate-x-1/2 text-[#725343]" strokeWidth={1.25} aria-hidden />
					<span className="absolute inset-x-3 bottom-4 rounded-full bg-black/60 px-3 py-1.5 text-[9px] font-semibold backdrop-blur">{fa ? 'مانتو کتان · رنگ کرم' : 'Linen coat · Cream'}</span>
				</m.div>
				<p className="mt-5 text-[18px] font-bold drop-shadow">{fa ? 'رنگ محبوب دوباره موجود شد' : 'Your favorite color is back'}</p>
				<p className="mt-1 text-[10px] text-white/75">{fa ? 'برای قیمت و سایز، همین استوری رو ریپلای کن' : 'Reply for price and available sizes'}</p>
				<span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[9px] font-bold text-black"><Link2 className="h-3 w-3" aria-hidden />{fa ? 'مشاهده محصول' : 'View product'}</span>
			</div>

			<div className="relative z-10 shrink-0 px-3 pb-4">
				<m.div
					initial={{ borderColor: 'rgba(255,255,255,0.28)' }}
					animate={{ borderColor: step >= 1 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)' }}
					transition={{ duration: 0.2 }}
					className="flex h-11 items-center rounded-full border bg-black/15 px-4 backdrop-blur-sm"
					aria-label={step === 1 ? (fa ? 'مشتری در حال نوشتن ریپلای استوری است' : 'The customer is typing a story reply') : undefined}
				>
					<span dir={fa ? 'rtl' : 'ltr'} className="flex min-w-0 flex-1 items-center overflow-hidden text-start text-[10.5px] text-white/70">
						{step === 1 ? <><bdi className="truncate">{typedStoryReply}</bdi><InstagramTypingCaret /></> : fa ? 'ارسال پیام...' : 'Send message...'}
					</span>
					<Heart className="h-[18px] w-[18px]" aria-hidden />
					<Send className={cn('ms-3 h-[18px] w-[18px] transition-colors duration-200', step === 1 && 'text-[#5eb6ff]')} aria-hidden />
				</m.div>
			</div>
		</div>
	)
}

function useInstagramTypedText(text: string | null, active: boolean) {
	const reduce = useReducedMotion()
	const [typedText, setTypedText] = useState('')

	useEffect(() => {
		if (!text || !active) {
			setTypedText('')
			return
		}

		const characters = Array.from(text)
		if (reduce) {
			setTypedText(text)
			return
		}

		let characterIndex = 0
		let typingTimer: number | undefined
		setTypedText('')
		const characterDelay = Math.max(28, Math.min(56, Math.round(1100 / characters.length)))
		const startTimer = window.setTimeout(() => {
			typingTimer = window.setInterval(() => {
				characterIndex += 1
				setTypedText(characters.slice(0, characterIndex).join(''))
				if (characterIndex >= characters.length && typingTimer !== undefined) window.clearInterval(typingTimer)
			}, characterDelay)
		}, 90)

		return () => {
			window.clearTimeout(startTimer)
			if (typingTimer !== undefined) window.clearInterval(typingTimer)
		}
	}, [active, reduce, text])

	return typedText
}

function InstagramTypingCaret() {
	return (
		<m.span
			aria-hidden
			className="mx-0.5 h-3.5 w-px shrink-0 bg-[#3797f0]"
			animate={{ opacity: [1, 1, 0, 0] }}
			transition={{ duration: 0.8, times: [0, 0.45, 0.5, 1], repeat: Infinity, ease: 'linear' }}
		/>
	)
}

function InstagramMessageComposer({
	fa,
	draft,
	draftId,
}: {
	fa: boolean
	draft: string | null
	draftId: string | null
}) {
	const typing = Boolean(draft && draftId)
	const typedText = useInstagramTypedText(draft, typing)

	return (
		<div className="shrink-0 px-3 pb-3">
			<div dir="ltr" className={cn('relative flex h-11 items-center rounded-full border transition-colors duration-200', typing ? 'border-white/32 bg-white/[0.025]' : 'border-white/20')}>
				<AnimatePresence mode="wait" initial={false}>
					{typing ? (
						<m.span key="send" initial={{ opacity: 0, transform: 'translateY(-50%) scale(0.92)' }} animate={{ opacity: 1, transform: 'translateY(-50%) scale(1)' }} exit={{ opacity: 0, transform: 'translateY(-50%) scale(0.94)' }} transition={{ duration: 0.18, ease: EASE_OUT }} className="absolute right-1.5 top-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-[#3797f0] text-white" aria-hidden>
							<Send className="h-[15px] w-[15px] -rotate-12" />
						</m.span>
					) : (
						<m.span key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="absolute right-1.5 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#3797f0] text-white" aria-hidden>
							<Camera className="h-[17px] w-[17px]" />
						</m.span>
					)}
				</AnimatePresence>
				<span className={cn('relative flex min-w-0 flex-1 items-center overflow-hidden text-[11px]', typing ? 'ml-3 mr-11' : 'ml-[102px] mr-11')}>
					<AnimatePresence mode="popLayout" initial={false}>
						{typing ? (
							<m.span
								key={draftId}
								dir={fa ? 'rtl' : 'ltr'}
								initial={{ opacity: 0.35, transform: 'translate3d(0, 2px, 0)' }}
								animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
								exit={{ opacity: 0, transform: 'translate3d(8px, -5px, 0) scale(0.985)' }}
								transition={{ duration: 0.14, ease: EASE_OUT }}
								className="flex min-w-0 items-center text-white/88"
								aria-label={fa ? 'مشتری در حال نوشتن پیام است' : 'The customer is typing a message'}
							>
								<bdi className="truncate">{typedText}</bdi>
								<InstagramTypingCaret />
							</m.span>
						) : (
							<m.span key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }} className="text-white/40">
								{fa ? 'پیام...' : 'Message...'}
							</m.span>
						)}
					</AnimatePresence>
				</span>
				<AnimatePresence initial={false}>
					{!typing ? (
						<m.span key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }} className="absolute left-1 top-1/2 flex -translate-y-1/2 items-center" aria-hidden>
							<span className="grid h-8 w-8 place-items-center"><Mic className="h-[17px] w-[17px]" /></span>
							<span className="grid h-8 w-8 place-items-center"><ImageIcon className="h-[17px] w-[17px]" /></span>
							<span className="grid h-8 w-8 place-items-center"><Smile className="h-[17px] w-[17px]" /></span>
						</m.span>
					) : null}
				</AnimatePresence>
			</div>
		</div>
	)
}

function InstagramDarkConversationScreen({ locale, mode, step }: { locale: HomeLocale; mode: InstagramDemoMode; step: number }) {
	const fa = locale === 'fa'
	const directQuestion = fa ? 'سلام، اون مانتو کتان کرم سایز ۳۸ هست؟' : 'Hi, is that cream linen coat available in size 38?'
	const directFollowUp = fa ? 'آره، هر دو رنگ رو بفرست لطفاً.' : 'Yes, please send both colors.'
	const directOrder = fa ? 'همون کرم، سایز ۳۸ رو می‌خوام 🙏' : 'I’ll take cream in size 38, please.'
	const storyFollowUp = fa ? 'برای قد ۱۶۵، سایز ۳۸ مناسبه؟ ارسال تهران چقدره؟' : 'For 165 cm height, is size 38 right? How long is Tehran delivery?'
	const commentFollowUp = fa ? 'کرمش سایز ۳۸ موجوده؟' : 'Is cream available in size 38?'
	const customerDraft = mode === 'direct'
		? step === 1
			? { id: 'direct-question', text: directQuestion }
			: step === 5
				? { id: 'direct-follow-up', text: directFollowUp }
				: step === 10
					? { id: 'direct-order', text: directOrder }
					: null
		: mode === 'story' && step === 3
			? { id: 'story-follow-up', text: storyFollowUp }
			: mode === 'comment' && step === 2
				? { id: 'comment-follow-up', text: commentFollowUp }
				: null

	return (
		<div className="flex h-full min-h-0 flex-col bg-black text-white" dir={fa ? 'rtl' : 'ltr'}>
			<div className="flex h-[64px] shrink-0 items-center border-b border-white/10 px-2">
				<span className="grid h-11 w-10 shrink-0 place-items-center" aria-hidden>
					<ChevronLeft className={cn('h-7 w-7', fa && 'rotate-180')} strokeWidth={2} />
				</span>
				<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}>
					<span className="grid h-full w-full place-items-center rounded-full bg-black p-[2px]">
						<span className="grid h-full w-full place-items-center rounded-full bg-[#252525] text-[12px] font-semibold">V</span>
					</span>
				</span>
				<div className="ms-2 min-w-0 flex-1 leading-tight">
					<p className="flex items-center gap-1 text-[13px] font-semibold">Vigent Store <BadgeCheck className="h-3.5 w-3.5 fill-[#3797f0] text-black" aria-hidden /></p>
					<p className="mt-1 text-[9.5px] text-white/55">vigent.store</p>
				</div>
				<span className="grid h-11 w-10 place-items-center" aria-hidden><Phone className="h-5 w-5" strokeWidth={1.8} /></span>
				<span className="grid h-11 w-10 place-items-center" aria-hidden><Video className="h-[22px] w-[22px]" strokeWidth={1.8} /></span>
			</div>

			<div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/10 bg-[#121212] px-4 text-[9.5px] text-white/55">
				<Zap className="h-3.5 w-3.5 text-[#f5d07a]" aria-hidden />
				<span>{fa ? 'ویجنت این گفتگو را هوشمند پاسخ می‌دهد' : 'Vigent is intelligently replying to this conversation'}</span>
				<span className="ms-auto h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
			</div>

			<div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3.5 pb-3 pt-5" aria-live="polite">
				{mode === 'direct' ? (
					<>
						{step >= 2 ? <InstagramDarkMessage sent>{directQuestion}</InstagramDarkMessage> : null}
						<AnimatePresence initial={false}>{step === 3 ? <InstagramSeen key="direct-seen-one" fa={fa} /> : null}</AnimatePresence>
						<InstagramIncomingReply fa={fa} typing={step === 3} visible={step >= 4}>
							{fa ? 'سلام 🌿 آره موجوده! تنش خنکه و قدش بلنده. کرم ۱٬۲۸۰٬۰۰۰ تومنه؛ مشکی‌ش رو هم بفرستم ببینی؟' : 'Hi 🌿 Yes, it is available! It is light and long-cut. Cream is 1,280,000 tomans; want to see the black one too?'}
						</InstagramIncomingReply>
						{step >= 6 ? <InstagramDarkMessage sent>{directFollowUp}</InstagramDarkMessage> : null}
						<AnimatePresence initial={false}>{step === 7 ? <InstagramSeen key="direct-seen-two" fa={fa} /> : null}</AnimatePresence>
						<InstagramIncomingReply fa={fa} typing={step === 7} visible={step >= 8}>
							{fa ? 'حتماً؛ این دو مدل الان موجودن. رنگ و سایز رو از همین کارت‌ها می‌تونی ببینی.' : 'Of course; both are in stock. You can check colors and sizes in these cards.'}
						</InstagramIncomingReply>
						{step >= 9 ? <InstagramProductCatalog locale={locale} compact /> : null}
						{step >= 11 ? <InstagramDarkMessage sent>{directOrder}</InstagramDarkMessage> : null}
						<AnimatePresence initial={false}>{step === 12 ? <InstagramSeen key="direct-seen-three" fa={fa} /> : null}</AnimatePresence>
						<InstagramIncomingReply fa={fa} typing={step === 12} visible={step >= 13}>
							<>
								{fa ? 'چشم! موجودی سایز ۳۸ برات رزرو شد. این هم لینک پرداخت امن 👇' : 'Done! Size 38 is reserved for you. Here is the secure checkout link 👇'}
								<div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-2">
									<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10"><ShoppingBag className="h-4 w-4" aria-hidden /></span>
									<div className="min-w-0 flex-1"><p className="text-[9px] font-semibold">{fa ? 'مانتو کتان کرم · سایز ۳۸' : 'Cream linen coat · Size 38'}</p><p className="text-[8px] text-white/45">{fa ? '۱٬۲۸۰٬۰۰۰ تومان · پرداخت آنلاین' : '1,280,000 tomans · Checkout'}</p></div>
								</div>
							</>
						</InstagramIncomingReply>
					</>
				) : mode === 'story' ? (
					<>
						<InstagramStoryReplyCard locale={locale} />
						<AnimatePresence initial={false}>{step === 1 ? <InstagramSeen key="story-seen-one" fa={fa} /> : null}</AnimatePresence>
						<InstagramIncomingReply fa={fa} typing={step === 1} visible={step >= 2}>
							{fa ? 'بله، رنگ کرم موجوده؛ سایزهای ۳۶ تا ۴۲ داریم. قد کار ۱۱۸ سانته.' : 'Yes, cream is available in sizes 36–42. The coat length is 118 cm.'}
						</InstagramIncomingReply>
						{step >= 4 ? <InstagramDarkMessage sent>{storyFollowUp}</InstagramDarkMessage> : null}
						<AnimatePresence initial={false}>{step === 5 ? <InstagramSeen key="story-seen-two" fa={fa} /> : null}</AnimatePresence>
						<InstagramIncomingReply fa={fa} typing={step === 5} visible={step >= 6}>
							<>
								{fa ? 'بله، با اندازه‌هایی که گفتی سایز ۳۸ مناسبه. تهران فردا تحویل می‌شه؛ کارت محصول رو هم برات گذاشتم.' : 'Yes, size 38 fits the measurements you shared. Tehran delivery is tomorrow; here is the product card.'}
								<div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#d8c1a8]/20"><ShoppingBag className="h-4 w-4" aria-hidden /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold">{fa ? 'مانتو کتان کرم' : 'Cream linen coat'}</p><p className="text-[8px] text-white/45">{fa ? 'سایز ۳۸ · موجود' : 'Size 38 · In stock'}</p></div></div>
							</>
						</InstagramIncomingReply>
					</>
				) : (
					<>
						<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mb-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] text-white/55">{fa ? 'از کامنت «لینک خرید این مدل رو می‌فرستین؟»' : 'From comment “Can you send this product link?”'}</m.div>
						<InstagramIncomingReply fa={fa} typing={step === 0} visible={step >= 1}>
							{fa ? 'سلام مریم جان 🌿 حتماً؛ این مدل در دو رنگ کرم و مشکی موجوده. کارت محصول رو برات فرستادم.' : 'Hi Maryam 🌿 Sure; this style is available in cream and black. I sent you the product card.'}
						</InstagramIncomingReply>
						{step >= 1 ? <InstagramProductCatalog locale={locale} compact /> : null}
						{step >= 3 ? <InstagramDarkMessage sent>{commentFollowUp}</InstagramDarkMessage> : null}
						<AnimatePresence initial={false}>{step === 4 ? <InstagramSeen key="comment-seen" fa={fa} /> : null}</AnimatePresence>
						<InstagramIncomingReply fa={fa} typing={step === 4} visible={step >= 5}>
							{fa ? 'بله موجوده و تا ۱۰ دقیقه برات رزرو شد. برای تکمیل خرید روی «مشاهده محصول» بزن.' : 'Yes, it is in stock and reserved for 10 minutes. Tap “View product” to complete checkout.'}
						</InstagramIncomingReply>
					</>
				)}
			</div>

			<InstagramMessageComposer fa={fa} draft={customerDraft?.text ?? null} draftId={customerDraft?.id ?? null} />
		</div>
	)
}

function InstagramPhoneStatusBar({ fa }: { fa: boolean }) {
	return (
		<div dir="ltr" className="relative z-20 h-9 shrink-0 bg-[#0a0a0a] text-[10px] font-semibold text-white" aria-hidden>
			<span className="absolute left-[22px] top-1/2 -translate-y-1/2 tabular-nums">{fa ? '۹:۴۱' : '9:41'}</span>
			<span className="absolute left-1/2 top-[7px] flex h-[24px] w-[84px] -translate-x-1/2 items-center justify-end rounded-full bg-black px-[7px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
				<span className="h-[5px] w-[5px] rounded-full bg-[#111827] shadow-[inset_0_0_2px_rgba(65,105,225,0.45)]" />
			</span>
			<span className="absolute right-[20px] top-1/2 flex -translate-y-1/2 items-center gap-[5px] text-white">
				<svg viewBox="0 0 18 12" className="h-[10px] w-[15px]" fill="currentColor">
					<rect x="0" y="8" width="3" height="4" rx="0.8" />
					<rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
					<rect x="10" y="3" width="3" height="9" rx="0.8" />
					<rect x="15" y="0" width="3" height="12" rx="0.8" opacity="0.42" />
				</svg>
				<svg viewBox="0 0 18 13" className="h-[11px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round">
					<path d="M1.5 4.5a10.8 10.8 0 0 1 15 0" />
					<path d="M4.4 7.5a6.6 6.6 0 0 1 9.2 0" />
					<path d="M7.4 10.4a2.3 2.3 0 0 1 3.2 0" />
				</svg>
				<svg viewBox="0 0 27 13" className="h-[11px] w-[23px]" fill="none">
					<rect x="0.75" y="0.75" width="21.5" height="11.5" rx="3.4" stroke="currentColor" strokeOpacity="0.62" strokeWidth="1.5" />
					<rect x="2.6" y="2.6" width="15.2" height="7.8" rx="2" fill="currentColor" />
					<path d="M24 4.1v4.8c1.3-.35 2-1.12 2-2.4s-.7-2.05-2-2.4Z" fill="currentColor" fillOpacity="0.52" />
				</svg>
			</span>
		</div>
	)
}

export function InstagramMock({ locale, inverse = true, className, active = true }: { locale: HomeLocale; inverse?: boolean; className?: string; active?: boolean }) {
	const fa = locale === 'fa'
	const reduce = useReducedMotion()
	const [mode, setMode] = useState<InstagramDemoMode>('direct')
	const [step, setStep] = useState(reduce ? INSTAGRAM_SCENARIO_DELAYS.direct.length - 1 : 0)
	const scenarioOrder: InstagramDemoMode[] = ['direct', 'story', 'comment']

	useEffect(() => {
		if (!active) return
		setMode('direct')
		setStep(reduce ? INSTAGRAM_SCENARIO_DELAYS.direct.length - 1 : 0)
	}, [active, reduce])

	useEffect(() => {
		if (!active) return
		if (reduce) {
			setStep(INSTAGRAM_SCENARIO_DELAYS[mode].length - 1)
		} else {
			setStep(0)
		}
	}, [active, mode, reduce])

	useEffect(() => {
		if (!active || reduce) return
		const delays = INSTAGRAM_SCENARIO_DELAYS[mode]
		const delay = delays[step] ?? 2200
		const timer = window.setTimeout(() => {
			if (step >= delays.length - 1) {
				const currentIndex = scenarioOrder.indexOf(mode)
				setMode(scenarioOrder[(currentIndex + 1) % scenarioOrder.length])
				setStep(0)
				return
			}
			setStep((current) => current + 1)
		}, delay)
		return () => window.clearTimeout(timer)
		// scenarioOrder is intentionally static for this deterministic demo.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, mode, reduce, step])

	const scenarios = [
		{
			id: 'direct' as const,
			label: fa ? 'دایرکت هوشمند' : 'Smart DM',
			detail: fa ? 'سؤال محصول → پاسخ از موجودی' : 'Product question → stock-based reply',
		},
		{
			id: 'story' as const,
			label: fa ? 'ریپلای استوری' : 'Story reply',
			detail: fa ? 'تشخیص استوری → پاسخ مرتبط' : 'Story context → relevant reply',
		},
		{
			id: 'comment' as const,
			label: fa ? 'کامنت به دایرکت' : 'Comment to DM',
			detail: fa ? 'پاسخ عمومی → پیام خصوصی' : 'Public reply → private message',
		},
	]
	const activeScenario = scenarios.findIndex((scenario) => scenario.id === mode)
	const showStoryViewer = mode === 'story' && step < 2
	const showCommentFeed = mode === 'comment' && step < 4
	const conversationStep = mode === 'story' ? Math.max(0, step - 2) : mode === 'comment' ? Math.max(0, step - 4) : step
	const renderScenarioScreen = () => {
		if (showStoryViewer) return <InstagramStoryViewer locale={locale} step={step} />
		if (showCommentFeed) return <InstagramAutomationScreen locale={locale} step={step} />
		return <InstagramDarkConversationScreen locale={locale} mode={mode} step={conversationStep} />
	}

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className={cn(
				'relative',
				inverse ? 'text-white' : 'text-black',
				className,
			)}
		>
			<div className="grid items-center justify-center gap-4 md:grid-cols-[minmax(300px,370px)_minmax(170px,220px)] md:gap-6">
				<div className="relative mx-auto w-full max-w-[232px] sm:max-w-[320px]" dir="ltr">
					<span aria-hidden className="absolute -left-[4px] top-[106px] h-7 w-[4px] rounded-l-full bg-gradient-to-b from-[#536079] to-[#1d2536] shadow-[-1px_0_1px_rgba(255,255,255,0.14)]" />
					<span aria-hidden className="absolute -left-[4px] top-[151px] h-12 w-[4px] rounded-l-full bg-gradient-to-b from-[#536079] to-[#1d2536] shadow-[-1px_0_1px_rgba(255,255,255,0.14)]" />
					<span aria-hidden className="absolute -left-[4px] top-[213px] h-12 w-[4px] rounded-l-full bg-gradient-to-b from-[#536079] to-[#1d2536] shadow-[-1px_0_1px_rgba(255,255,255,0.14)]" />
					<span aria-hidden className="absolute -right-[4px] top-[164px] h-[68px] w-[4px] rounded-r-full bg-gradient-to-b from-[#536079] to-[#1d2536] shadow-[1px_0_1px_rgba(255,255,255,0.14)]" />
					<div className="relative rounded-[50px] bg-[linear-gradient(145deg,#46536c_0%,#151c2b_24%,#070a10_70%,#344057_100%)] p-[7px] shadow-[0_38px_95px_rgba(0,0,0,0.52),inset_0_1px_1px_rgba(255,255,255,0.22)] ring-1 ring-white/20">
						<div className="relative flex aspect-[393/852] w-full flex-col overflow-hidden rounded-[43px] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
							<InstagramPhoneStatusBar fa={fa} />
							<div className="min-h-0 flex-1 overflow-hidden">
								<AnimatePresence mode="wait" initial={false}>
									<m.div
										key={showStoryViewer ? 'story-viewer' : showCommentFeed ? 'comment-feed' : `${mode}-conversation`}
										initial={reduce ? false : { opacity: 0, transform: 'translateX(8px) scale(0.99)' }}
										animate={{ opacity: 1, transform: 'translateX(0px) scale(1)' }}
										exit={reduce ? undefined : { opacity: 0, transform: 'translateX(-6px) scale(0.99)' }}
										transition={{ duration: 0.22, ease: EASE_OUT }}
										className="h-full"
									>
										{renderScenarioScreen()}
									</m.div>
								</AnimatePresence>
							</div>
							<span aria-hidden className="pointer-events-none absolute bottom-[7px] left-1/2 z-30 h-[3px] w-[108px] -translate-x-1/2 rounded-full bg-white/35 shadow-[0_0_1px_rgba(0,0,0,0.5)]" />
						</div>
					</div>
				</div>

				<div>
					<div
						className={cn('grid grid-cols-3 gap-1 rounded-2xl border p-1 md:hidden', inverse ? 'border-white/10 bg-white/[0.045]' : 'border-black/10 bg-black/[0.04]')}
						role="tablist"
						aria-label={fa ? 'سناریوهای اینستاگرام' : 'Instagram scenarios'}
					>
						{scenarios.map((scenario) => (
							<button
								key={scenario.id}
								type="button"
								role="tab"
								aria-selected={mode === scenario.id}
								onClick={() => setMode(scenario.id)}
								className={cn(
									'min-h-11 touch-manipulation rounded-xl px-2 text-center text-[9.5px] font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]',
									mode === scenario.id
										? inverse
											? 'bg-white text-black shadow-[0_5px_16px_rgba(0,0,0,0.24)]'
											: 'bg-black text-white shadow-[0_5px_16px_rgba(0,0,0,0.15)]'
										: inverse
											? 'text-white/45'
											: 'text-black/45',
								)}
							>
								{scenario.label}
							</button>
						))}
					</div>

					<div
						className="relative hidden md:block"
						role="tablist"
						aria-label={fa ? 'سناریوهای اینستاگرام' : 'Instagram scenarios'}
					>
						<span className={cn('absolute inset-y-3 start-[3px] w-px overflow-hidden', inverse ? 'bg-white/10' : 'bg-black/10')} aria-hidden>
							<m.span
								className="block w-px origin-top bg-[#e8c677]"
								animate={{ height: `${((activeScenario + 1) / scenarios.length) * 100}%` }}
								transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}
							/>
						</span>
						<ol className="space-y-7 ps-8">
							{scenarios.map((scenario, index) => {
								const active = mode === scenario.id
								return (
									<li key={scenario.id} className="relative">
										<button
											type="button"
											role="tab"
											aria-selected={active}
											onClick={() => setMode(scenario.id)}
											className={cn(
												'group min-h-11 w-full touch-manipulation text-start transition-[opacity,transform] duration-200 active:scale-[0.97] focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c677]',
												active ? 'opacity-100' : 'opacity-35 hover:opacity-70',
											)}
										>
											<m.span
												className={cn(
													'absolute -start-[32px] top-[18px] block h-[7px] w-[7px] rounded-full ring-4',
													active ? 'bg-[#e8c677]' : inverse ? 'bg-white/25' : 'bg-black/25',
													inverse ? 'ring-[#090909]' : 'ring-white',
												)}
												animate={{ scale: active ? 1 : 0.72 }}
												transition={reduce ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
											/>
											<span className="block text-[8.5px] font-semibold tracking-[0.18em] opacity-45">{String(index + 1).padStart(2, '0')}</span>
											<span className="mt-1 block text-[12px] font-semibold">{scenario.label}</span>
											<span className="mt-1 block text-[9.5px] leading-5 opacity-55">{scenario.detail}</span>
										</button>
									</li>
								)
							})}
						</ol>
						<p className={cn('mt-8 ps-8 text-[9px]', inverse ? 'text-white/35' : 'text-black/40')} aria-live="polite">
							{fa ? `در حال نمایش: ${scenarios[activeScenario].label}` : `Now showing: ${scenarios[activeScenario].label}`}
						</p>
					</div>
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
