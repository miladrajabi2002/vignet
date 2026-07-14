'use client'

import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
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
	Play,
	ShoppingBag,
	UtensilsCrossed,
} from 'lucide-react'
import { NeuralOperationGraph } from './neural-operation-graph'
import { Spotlight } from './spotlight'

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
			{ channel: 'اینستاگرام', person: 'سارا', text: 'رنگ مشکی این مدل موجوده؟', time: 'همین حالا', reply: 'بله، رنگ مشکی موجود است؛ لینک خرید همین‌جا ارسال شد.', source: 'کاتالوگ + موجودی زنده', result: 'موجودی تأیید و لینک خرید ارسال شد' },
			{ channel: 'واتساپ', person: 'امیر', text: 'سفارشم چه زمانی می‌رسه؟', time: '۱ دقیقه پیش', reply: 'سفارش شما ارسال شده و فردا تحویل می‌شود.', source: 'اطلاعات سفارش + وضعیت ارسال', result: 'وضعیت سفارش ثبت و مشتری مطلع شد' },
		],
		flow: ['پیام دریافت شد', 'دانش پیدا شد', 'پاسخ و اقدام ثبت شد'],
		promises: ['یک ماه رایگان', 'اتوماسیون اینستاگرام رایگان', 'اعتبار فقط برای پاسخ موفق AI'],
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
			{ channel: 'Instagram', person: 'Sara', text: 'Is this available in black?', time: 'just now', reply: 'Yes, black is in stock. The checkout link is ready.', source: 'Catalog + live inventory', result: 'Stock confirmed and checkout link sent' },
			{ channel: 'WhatsApp', person: 'Amir', text: 'When will my order arrive?', time: '1 min ago', reply: 'Your order has shipped and is due tomorrow.', source: 'Order record + delivery status', result: 'Order status logged and customer updated' },
		],
		flow: ['Message received', 'Knowledge found', 'Reply and action logged'],
		promises: ['One month free', 'Free Instagram automation', 'Credit only for successful AI replies'],
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
	const verticalIdx = tick % copy.verticals.length
	const scenario = copy.messages[scenarioIdx]

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0.42, y: 14, scale: 0.992 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={reduce ? { duration: 0 } : { duration: 0.52, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[620px]"
			role="img"
			aria-label={copy.stageAria}
		>
			<div className="relative overflow-hidden rounded-[1.8rem] border border-black bg-[#050505] text-white shadow-[0_32px_90px_rgba(0,0,0,0.24)]">
				<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-50" />
				<div aria-hidden className="pointer-events-none absolute -start-24 top-10 h-52 w-52 rounded-full bg-white/[0.08] blur-3xl" />

				<div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.14)]">
							<Bot className="h-4 w-4" />
						</span>
						<div className="min-w-0">
							<p className="truncate text-[11px] font-semibold text-white sm:text-xs">{copy.stageTitle}</p>
							<p className="mt-0.5 text-[9px] text-white/40 sm:text-[10px]">{copy.connected}</p>
						</div>
					</div>
					<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-medium text-emerald-200 sm:text-[10px]">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50 motion-reduce:animate-none" />
							<span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
						</span>
						{copy.live}
					</span>
				</div>

				<div className="relative px-4 pt-4 sm:px-5">
					<p className="mb-2 text-[9px] font-medium text-white/40">{copy.verticalLabel}</p>
					<div className="grid grid-cols-5 gap-1.5 sm:gap-2">
						{copy.verticals.map((business, index) => {
							const Icon = BUSINESS_ICONS[index]
							const active = index === verticalIdx
							return (
								<motion.div
									key={business}
									initial={reduce ? false : { opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={reduce ? { duration: 0 } : { duration: 0.34, delay: 0.28 + index * 0.055 }}
									className={`relative z-10 min-w-0 rounded-xl border px-1 py-2 text-center transition-colors duration-300 ${active ? 'border-white/30 bg-white text-black' : 'border-white/10 bg-white/[0.045] text-white/50'}`}
								>
									<span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-black text-white' : 'bg-white/[0.06] text-white/55'}`}>
										<Icon className="h-3.5 w-3.5" />
									</span>
									<p className="mt-1 truncate text-[8px] font-medium sm:text-[9px]">{business}</p>
								</motion.div>
							)
						})}
					</div>
				</div>

				<NeuralOperationGraph
					locale={locale}
					reduce={reduce}
					scenarioIdx={scenarioIdx}
					scenario={scenario}
					allMessages={copy.allMessages}
					core={copy.core}
					coreHint={copy.coreHint}
					sharedBrain={copy.sharedBrain}
				/>

				{/* Flow steps footer */}
				<div className="relative grid grid-cols-3 overflow-hidden border-t border-white/10">
					{copy.flow.map((step, index) => (
						<motion.div
							key={step}
							initial={reduce ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 1 + index * 0.2 }}
							className="flex min-w-0 items-center justify-center gap-1.5 border-e border-white/10 px-1.5 py-2.5 text-center text-[8px] text-white/35 last:border-e-0 sm:text-[9px]"
						>
							<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === 2 ? 'bg-emerald-300' : 'bg-white/30'}`} />
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
		<section className="marketing-hero-spatial relative overflow-hidden pb-14 pt-[94px] sm:pb-16 sm:pt-28 lg:flex lg:min-h-[min(820px,100svh)] lg:items-center lg:pb-14 lg:pt-24">
			<Spotlight />
			<div className="marketing-hero-content relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-9 xl:gap-14">
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
						initial={reduce ? false : { y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.48, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
						className="mt-5 font-semibold leading-[1.18] tracking-[-0.03em] text-[var(--text-primary)] rtl:tracking-normal text-[clamp(1.5rem,6vw,2.15rem)] sm:text-[clamp(1.7rem,4.6vw,2.6rem)] md:text-[clamp(1.85rem,3.4vw,2.85rem)] lg:text-[clamp(2rem,2.9vw,3.1rem)] xl:text-[clamp(2.1rem,2.6vw,3.4rem)]"
					>
						<span className="marketing-hero-line block md:whitespace-nowrap">{copy.headlineTop}</span>
						<span className="marketing-hero-line block text-[var(--text-muted)] md:whitespace-nowrap">{copy.headlineBottom}</span>
					</motion.h1>

					<motion.p
						initial={reduce ? false : { y: 9 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.42, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
						className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base sm:leading-8 lg:mx-0"
					>
						{t('subtitle')}
					</motion.p>

					<motion.div
						initial={reduce ? false : { y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.14, ease: [0.23, 1, 0.32, 1] }}
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
						initial={reduce ? false : { y: 6 }}
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

				</div>

				<ProductStage reduce={reduce} />
			</div>
		</section>
	)
}
