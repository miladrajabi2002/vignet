'use client'

import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	BriefcaseBusiness,
	CalendarCheck2,
	Check,
	GraduationCap,
	Gift,
	MessageCircleMore,
	PackageSearch,
	Play,
	ShoppingBag,
	Sparkles,
	UtensilsCrossed,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

const COPY = {
	fa: {
		kicker: 'هوش مصنوعی فارسی برای فروش و پشتیبانی',
		headlineTop: 'هر پیام، یک پاسخ دقیق',
		headlineBottom: 'از همه‌جا، در یک پنل',
		stageAria: 'نمایش پنج پنل تخصصی فروشگاه، سفارش غذا، نوبت‌دهی، خدمات و آموزش که به هسته هوشمند ویجنت و همه کانال‌های ارتباطی متصل‌اند.',
		stageTitle: 'مرکز عملیات هوشمند کسب‌وکار',
		connected: '۵ پنل تخصصی · همه کانال‌ها',
		live: 'پاسخ‌گویی زنده',
		verticalLabel: 'ویجنت متناسب با مدل کار شما ساخته می‌شود',
		verticals: ['فروشگاه', 'سفارش غذا', 'نوبت‌دهی', 'خدمات', 'آموزش'],
		core: 'Vigento AI',
		coreHint: 'هوش مصنوعی ویجنتو · CRM · Automation',
		allMessages: 'پیام‌های تازه از همه‌جا',
		sharedBrain: 'یک ایجنت، یک پاسخ دقیق',
		sharedBrainDesc: 'ویجنت پیام را می‌فهمد، دانش مرتبط را پیدا می‌کند و پاسخ یا اقدام درست را به همان کانال برمی‌گرداند.',
		modules: ['CRM یکپارچه', 'ایجنت شش‌لایه', 'گزارش و اتوماسیون'],
		channels: ['اینستاگرام', 'واتساپ', 'تلگرام', 'بله', 'روبیکا', 'ویجت وب'],
		messages: [
			{ channel: 'اینستاگرام', person: 'سارا', text: 'رنگ مشکی این مدل موجوده؟', time: 'همین حالا' },
			{ channel: 'واتساپ', person: 'امیر', text: 'سفارشم چه زمانی می‌رسه؟', time: '۱ دقیقه پیش' },
		],
		reply: 'بله، رنگ مشکی موجود است. لینک خرید همین‌جا برایتان ارسال شد.',
		source: 'کاتالوگ + موجودی زنده',
		result: 'موجودی تأیید شد · لینک خرید ارسال شد',
		flow: ['پیام دریافت شد', 'دانش پیدا شد', 'پاسخ و اقدام ثبت شد'],
		promises: ['یک ماه استفاده رایگان', 'اتوماسیون ثابت اینستاگرام رایگان', 'هزینه فقط برای پاسخ موفق AI'],
	},
	en: {
		kicker: 'Persian AI for sales and support',
		headlineTop: 'Every message gets a clear answer',
		headlineBottom: 'Every channel, one inbox',
		stageAria: 'Five specialized workspaces for commerce, food orders, appointments, services and education connect to the Vigent intelligence core and every customer channel.',
		stageTitle: 'The intelligent business operating system',
		connected: '5 specialized workspaces · every channel',
		live: 'Live replies',
		verticalLabel: 'Vigent adapts to how your business actually operates',
		verticals: ['Commerce', 'Food', 'Booking', 'Services', 'Education'],
		core: 'Vigento AI',
		coreHint: 'Business intelligence · CRM · Automation',
		allMessages: 'New messages from everywhere',
		sharedBrain: 'One agent, one precise answer',
		sharedBrainDesc: 'Vigent understands the message, finds the right knowledge, then returns the answer or action to the same channel.',
		modules: ['Unified CRM', 'Six-layer agent', 'Reports & automation'],
		channels: ['Instagram', 'WhatsApp', 'Telegram', 'Bale', 'Rubika', 'Web widget'],
		messages: [
			{ channel: 'Instagram', person: 'Sara', text: 'Is this available in black?', time: 'just now' },
			{ channel: 'WhatsApp', person: 'Amir', text: 'When will my order arrive?', time: '1 min ago' },
		],
		reply: 'Yes, black is in stock. I have sent the checkout link right here.',
		source: 'Catalog + live inventory',
		result: 'Stock confirmed · checkout link sent',
		flow: ['Message received', 'Knowledge found', 'Reply and action logged'],
		promises: ['One month free', 'Free deterministic Instagram automation', 'Credit only for successful AI replies'],
	},
} as const

const BUSINESS_ICONS: ComponentType<{ className?: string }>[] = [
	ShoppingBag,
	UtensilsCrossed,
	CalendarCheck2,
	BriefcaseBusiness,
	GraduationCap,
]

function ProductStage({ reduce }: { reduce: boolean | null }) {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const [tick, setTick] = useState(0)

	// Auto-advance the live conversation scenario every 4.5s
	useEffect(() => {
		if (reduce) return
		const interval = setInterval(() => setTick((t) => t + 1), 4500)
		return () => clearInterval(interval)
	}, [reduce])

	const scenarioIdx = tick % copy.messages.length

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 18, scale: 0.99 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[620px]"
			role="img"
			aria-label={copy.stageAria}
		>
			{/* Flat main panel — clean white card with thin border and soft shadow */}
			<div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
				{/* Top bar */}
				<div className="relative flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--text-primary)] text-white">
							<Bot className="h-4 w-4" />
						</span>
						<div className="min-w-0">
							<p className="truncate text-[11px] font-semibold text-[var(--text-primary)] sm:text-xs">{copy.stageTitle}</p>
							<p className="mt-0.5 text-[9px] text-[var(--text-muted)] sm:text-[10px]">{copy.connected}</p>
						</div>
					</div>
					<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[9px] font-medium text-[var(--accent-strong)] sm:text-[10px]">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-50 motion-reduce:animate-none" />
							<span className="relative h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
						</span>
						{copy.live}
					</span>
				</div>

				{/* Business verticals row */}
				<div className="relative px-4 pt-3 sm:px-5">
					<p className="mb-2 text-center text-[8px] font-medium text-[var(--text-muted)] sm:text-[9px]">{copy.verticalLabel}</p>
					<div className="grid grid-cols-5 gap-1.5 sm:gap-2">
						{copy.verticals.map((business, index) => {
							const Icon = BUSINESS_ICONS[index]
							return (
								<motion.div
									key={business}
									initial={reduce ? false : { opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={reduce ? { duration: 0 } : { duration: 0.34, delay: 0.28 + index * 0.055 }}
									className="relative z-10 min-w-0 rounded-xl border border-[var(--border-subtle)] bg-white px-1 py-2 text-center"
								>
									<span className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)]">
										<Icon className="h-3.5 w-3.5" />
									</span>
									<p className="mt-1 truncate text-[7px] font-medium text-[var(--text-muted)] sm:text-[9px]">{business}</p>
								</motion.div>
							)
						})}
					</div>
				</div>

				{/* ─── Neural connection layer: verticals → core ─── */}
				<div aria-hidden className="relative h-12 w-full">
					<svg viewBox="0 0 500 48" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
						{/* 5 lines converging from each vertical (top) to the core (bottom center) */}
						{[50, 150, 250, 350, 450].map((x, index) => {
							const stroke = 'rgba(10,132,255,0.28)'
							const fill = 'rgb(10 132 255)'
							return (
							<g key={x}>
								<motion.path
									d={`M ${x} 0 Q ${x} 24 250 44`}
									fill="none"
									stroke={stroke}
									strokeWidth="1"
									strokeDasharray="3 3"
									animate={reduce ? undefined : { strokeDashoffset: [0, -12], opacity: [0.2, 0.6, 0.2] }}
									transition={reduce ? undefined : { duration: 2, repeat: Infinity, delay: index * 0.15, ease: 'linear' }}
								/>
								{/* Traveling particle down each line */}
								{!reduce && (
									<motion.circle
										r="1.5"
										fill={fill}
										initial={{ cx: x, cy: 0, opacity: 0 }}
										animate={{ cx: [x, 250], cy: [0, 44], opacity: [0, 1, 1, 0] }}
										transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.36, ease: 'easeInOut' }}
									/>
								)}
							</g>
							)
						})}
					</svg>
				</div>

				{/* Central intelligence core — the neural hub */}
				<div className="relative flex items-center justify-center -mt-2 pb-1">
					<motion.div
						animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
						transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
						className="relative flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-4 py-2.5"
						style={{ boxShadow: 'var(--shadow-sm)' }}
					>
						<span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--text-primary)] text-white ">
							<Sparkles className="h-4 w-4" />
							{!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/30" />}
							{!reduce && <span className="absolute -inset-1 rounded-full border border-[var(--accent)]/30 animate-[spin_6s_linear_infinite]" />}
						</span>
						<div className="text-start">
							<p className="whitespace-nowrap text-[10px] font-semibold text-[var(--text-primary)] sm:text-[11px]">{copy.core}</p>
							<p className="whitespace-nowrap text-[8px] text-[var(--text-muted)] sm:text-[9px]">{copy.coreHint}</p>
						</div>
						{/* Neural pulse dots */}
						{!reduce && (
							<div className="ms-1 flex items-center gap-0.5">
								{[0, 1, 2].map((i) => (
									<motion.span
										key={i}
										className="h-1 w-1 rounded-full bg-[var(--accent)]"
										animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
										transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
									/>
								))}
							</div>
						)}
					</motion.div>
				</div>

				{/* ─── Neural connection layer: core → messages ─── */}
				<div aria-hidden className="relative h-10 w-full">
					<svg viewBox="0 0 500 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
						{/* 2 lines diverging from core (top center) to message panels (bottom left + right) */}
						{[125, 375].map((x, index) => {
							const stroke = 'rgba(10,132,255,0.26)'
							const fill = 'rgb(10 132 255)'
							return (
							<g key={x}>
								<motion.path
									d={`M 250 0 Q 250 20 ${x} 36`}
									fill="none"
									stroke={stroke}
									strokeWidth="1"
									strokeDasharray="3 3"
									animate={reduce ? undefined : { strokeDashoffset: [0, -12] }}
									transition={reduce ? undefined : { duration: 1.5, repeat: Infinity, delay: index * 0.3, ease: 'linear' }}
								/>
								{!reduce && (
									<motion.circle
										r="1.5"
										fill={fill}
										initial={{ cx: 250, cy: 0, opacity: 0 }}
										animate={{ cx: [250, x], cy: [0, 36], opacity: [0, 1, 1, 0] }}
										transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.5 + 0.8, ease: 'easeInOut' }}
									/>
								)}
							</g>
							)
						})}
					</svg>
				</div>

				{/* Live conversation: incoming message + Vigent reply */}
				<div className="relative grid gap-2.5 px-4 pb-3 sm:grid-cols-[0.88fr_1.12fr] sm:px-5">
					{/* Incoming messages */}
					<div className="rounded-2xl border border-[var(--border-default)] bg-white p-2.5" style={{ boxShadow: 'var(--shadow-sm)' }}>
						<p className="mb-2 flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-muted)] sm:text-[10px]">
							<MessageCircleMore className="h-3 w-3" />
							{copy.allMessages}
						</p>
						<div className="space-y-2">
							{copy.messages.map((msg, index) => {
								const MsgIcon = index === 0 ? InstagramIcon : MessageCircleMore
								const isActive = index === scenarioIdx
								return (
									<motion.div
										key={msg.person}
										initial={reduce ? false : { opacity: 0, x: locale === 'fa' ? 8 : -8 }}
										animate={{ opacity: isActive ? 1 : 0.5, x: 0 }}
										transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.4 + index * 0.15 }}
										className={`rounded-xl border px-2.5 py-2 transition-colors ${isActive ? 'border-[var(--accent-border)] bg-white' : 'border-transparent bg-[var(--bg-surface)]'}`}
										style={isActive ? { boxShadow: 'var(--shadow-xs)' } : undefined}
									>
										<div className="flex items-center gap-2">
											<span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
												<MsgIcon className="h-3 w-3" />
											</span>
											<div className="min-w-0 flex-1">
												<div className="flex items-center justify-between gap-1">
													<p className="truncate text-[9px] font-medium text-[var(--text-primary)]">{msg.person} · {msg.channel}</p>
													<span className="shrink-0 text-[7px] text-[var(--text-muted)]">{msg.time}</span>
												</div>
												<p className="mt-0.5 truncate text-[8px] text-[var(--text-secondary)]">{msg.text}</p>
											</div>
										</div>
									</motion.div>
								)
							})}
						</div>
					</div>

					{/* Vigent reply card */}
					<motion.div
						initial={reduce ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.9 }}
						className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white p-3"
						style={{ boxShadow: 'var(--shadow-card)' }}
					>
						<div className="flex items-start gap-2.5">
							<span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--text-primary)] text-white ">
								<Sparkles className="h-3.5 w-3.5" />
							</span>
							<div>
								<p className="text-[10px] font-semibold text-[var(--text-primary)]">{copy.sharedBrain}</p>
								<p className="mt-1 text-[9px] leading-4 text-[var(--text-muted)] sm:text-[10px]">{copy.sharedBrainDesc}</p>
							</div>
						</div>

						{/* Animated reply text */}
						<div className="mt-2.5 rounded-xl bg-[var(--bg-surface)] p-2.5">
							<AnimatePresence mode="wait">
								<motion.p
									key={scenarioIdx}
									initial={reduce ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={reduce ? undefined : { opacity: 0 }}
									transition={{ duration: 0.3 }}
									className="text-[10px] leading-5 text-[var(--text-primary)]"
								>
									{copy.reply}
								</motion.p>
							</AnimatePresence>
							<span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-2 py-0.5 text-[8px] font-medium text-[var(--text-muted)] sm:text-[9px]">
								<PackageSearch className="h-2.5 w-2.5" />
								{copy.source}
							</span>
						</div>

						<motion.div
							initial={reduce ? false : { opacity: 0, scale: 0.98 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={reduce ? { duration: 0 } : { duration: 0.32, delay: 1.22 }}
							className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--success)]/20 bg-green-50 px-2.5 py-2 text-[9px] font-medium text-[var(--success)] sm:text-[10px]"
						>
							<span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--success)] text-white">
								<Check className="h-3 w-3" />
							</span>
							{copy.result}
						</motion.div>
					</motion.div>
				</div>

				{/* Flow steps footer */}
				<div className="relative grid grid-cols-3 overflow-hidden border-t border-[var(--border-subtle)]">
					{copy.flow.map((step, index) => (
						<motion.div
							key={step}
							initial={reduce ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 1 + index * 0.2 }}
							className="flex min-w-0 items-center justify-center gap-1.5 border-e border-[var(--border-subtle)] px-1.5 py-2.5 text-center text-[8px] text-[var(--text-muted)] last:border-e-0 sm:text-[9px]"
						>
							<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === 2 ? 'bg-[var(--success)]' : 'bg-[var(--border-hover)]'}`} />
							<span className="truncate">{step}</span>
						</motion.div>
					))}
				</div>
			</div>
		</motion.div>
	)
}

export function Hero() {
	const t = useTranslations('marketing.hero')
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section className="relative overflow-hidden bg-white pb-14 pt-[94px] sm:pb-16 sm:pt-28 lg:flex lg:min-h-[min(820px,100svh)] lg:items-center lg:pb-14 lg:pt-24">
			<div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-9 xl:gap-14">
				<div className="mx-auto max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-start">
					<motion.div
						initial={reduce ? false : { opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.5 }}
						className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--accent-border)] bg-white px-3.5 text-[11px] font-medium text-[var(--text-secondary)]"
						style={{ boxShadow: 'var(--shadow-xs)' }}
					>
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-45 motion-reduce:animate-none" />
							<span className="relative h-2 w-2 rounded-full bg-[var(--accent)]" />
						</span>
						{copy.kicker}
					</motion.div>

					<motion.h1
						initial={reduce ? false : { opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
						className="mt-5 font-semibold leading-[1.18] tracking-[-0.03em] text-[var(--text-primary)] rtl:tracking-normal text-[clamp(1.5rem,6vw,2.15rem)] sm:text-[clamp(1.7rem,4.6vw,2.6rem)] md:text-[clamp(1.85rem,3.4vw,2.85rem)] lg:text-[clamp(2rem,2.9vw,3.1rem)] xl:text-[clamp(2.1rem,2.6vw,3.4rem)]"
					>
						<span className="marketing-hero-line block md:whitespace-nowrap">{copy.headlineTop}</span>
						<span className="marketing-hero-line block text-[var(--text-muted)] md:whitespace-nowrap">{copy.headlineBottom}</span>
					</motion.h1>

					<motion.p
						initial={reduce ? false : { opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.12 }}
						className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base sm:leading-8 lg:mx-0"
					>
						{t('subtitle')}
					</motion.p>

					<motion.div
						initial={reduce ? false : { opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
						className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
					>
						<Link href="/login?next=/onboarding" className="marketing-pressable group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-6 text-sm font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)] hover:bg-[var(--text-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2" >
							{t('ctaPrimary')}
							<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
						</Link>
						<Link href="#demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-6 text-sm font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2" style={{ boxShadow: 'var(--shadow-sm)' }}>
							<Play className="h-3.5 w-3.5 fill-[var(--text-primary)]" aria-hidden />
							{t('ctaSecondary')}
						</Link>
					</motion.div>

					<motion.div
						initial={reduce ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { delay: 0.27, duration: 0.45 }}
						className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
					>
						{copy.promises.map((promise, index) => (
							<span key={promise} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 text-[10px] font-medium text-black/55 shadow-[0_4px_14px_rgba(0,0,0,0.04)]">
								{index === 0 ? <Gift className="h-3 w-3" /> : <Check className="h-3 w-3" />}
								{promise}
							</span>
						))}
					</motion.div>

					<motion.p
						initial={reduce ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={reduce ? { duration: 0 } : { delay: 0.3, duration: 0.55 }}
						className="mt-4 text-[11px] leading-5 text-[var(--text-muted)]"
					>
						{t('trust')}
					</motion.p>
				</div>

				<ProductStage reduce={reduce} />
			</div>
		</section>
	)
}
