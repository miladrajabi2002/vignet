'use client'

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
	Globe2,
	MessageCircleMore,
	MessagesSquare,
	PackageSearch,
	Play,
	Radio,
	ShoppingBag,
	Sparkles,
	UtensilsCrossed,
} from 'lucide-react'
import { InstagramIcon, TelegramIcon } from './social-links'

const COPY = {
	fa: {
		kicker: 'هوش مصنوعی فارسی برای فروش و پشتیبانی',
		headlineTop: 'هر پیام، یک پاسخ دقیق',
		headlineBottom: 'از همه‌جا، در یک پنل',
		stageAria: 'نمایش پنج پنل تخصصی فروشگاه، سفارش غذا، نوبت‌دهی، خدمات و آموزش که به هسته هوشمند ویجنت و همه کانال‌های ارتباطی متصل‌اند.',
		stageTitle: 'سیستم‌عامل هوشمند کسب‌وکار',
		connected: '۵ پنل تخصصی · همه کانال‌ها',
		live: 'پاسخ‌گویی زنده',
		verticalLabel: 'ویجنت متناسب با مدل کار شما ساخته می‌شود',
		verticals: ['فروشگاه', 'سفارش غذا', 'نوبت‌دهی', 'خدمات', 'آموزش'],
		core: 'هسته هوشمند ویجنت',
		coreHint: 'AI · CRM · Automation',
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
		core: 'Vigent intelligence core',
		coreHint: 'AI · CRM · Automation',
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
	},
} as const

const CHANNEL_ICONS: ComponentType<{ className?: string }>[] = [
	InstagramIcon,
	MessageCircleMore,
	TelegramIcon,
	MessagesSquare,
	Radio,
	Globe2,
]

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

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 18, scale: 0.99 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[640px]"
			role="img"
			aria-label={copy.stageAria}
		>
			<div aria-hidden className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_48%_38%,rgba(16,185,129,0.16),transparent_62%)] blur-sm" />
			<div aria-hidden className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#101311] p-3 text-white shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-4">
				<div className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-40" />
				<div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

				<div className="relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 py-3 sm:px-4">
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-black shadow-sm">
							<Bot className="h-4 w-4" />
						</span>
						<div className="min-w-0">
							<p className="truncate text-[11px] font-semibold text-white sm:text-xs">{copy.stageTitle}</p>
							<p className="mt-0.5 text-[9px] text-white/45 sm:text-[10px]">{copy.connected}</p>
						</div>
					</div>
					<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-[9px] font-medium text-emerald-200 sm:text-[10px]">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50 motion-reduce:animate-none" />
							<span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
						</span>
						{copy.live}
					</span>
				</div>

				<div className="relative mt-3">
					<p className="mb-2 text-center text-[8px] font-medium text-white/35 sm:text-[9px]">{copy.verticalLabel}</p>
					<div className="grid grid-cols-5 gap-1.5 sm:gap-2">
					{copy.verticals.map((business, index) => {
						const Icon = BUSINESS_ICONS[index]
						return (
							<motion.div
								key={business}
								initial={reduce ? false : { opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={reduce ? { duration: 0 } : { duration: 0.34, delay: 0.28 + index * 0.055 }}
								className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] px-1 py-2.5 text-center"
							>
								<span className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.08] text-white/75">
									<Icon className="h-3.5 w-3.5" />
								</span>
								<p className="mt-1.5 truncate text-[7px] font-medium text-white/55 sm:text-[9px]">{business}</p>
							</motion.div>
						)
					})}
					</div>
				</div>

				<div className="relative h-[4.6rem]">
					<svg aria-hidden viewBox="0 0 500 74" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
						{[50, 150, 250, 350, 450].map((x, index) => (
							<motion.path
								key={x}
								d={`M ${x} 0 Q ${x} 28 250 46`}
								fill="none"
								stroke="rgba(255,255,255,0.18)"
								strokeWidth="1"
								animate={reduce ? undefined : { opacity: [0.25, 0.85, 0.25] }}
								transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, delay: index * 0.18 }}
							/>
						))}
					</svg>
					<motion.div
						initial={reduce ? false : { opacity: 0, scale: 0.94 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={reduce ? { duration: 0 } : { duration: 0.42, delay: 0.62 }}
						className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 shadow-[0_0_28px_rgba(52,211,153,0.16)]"
					>
						<span className="relative grid h-6 w-6 place-items-center rounded-full bg-emerald-300 text-black">
							<Sparkles className="h-3 w-3" />
							{!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300/40" />}
						</span>
						<span className="whitespace-nowrap text-[8px] font-semibold text-emerald-100 sm:text-[9px]">{copy.core}</span>
						<span className="hidden whitespace-nowrap text-[7px] text-white/35 sm:inline">{copy.coreHint}</span>
					</motion.div>
				</div>

				<div className="relative grid gap-2.5 sm:grid-cols-[0.86fr_1.14fr]">
					<div className="rounded-2xl border border-white/10 bg-black/20 p-3">
						<div className="mb-2.5 flex items-center justify-between gap-2">
							<p className="flex items-center gap-2 text-[9px] font-medium text-white/45 sm:text-[10px]">
								<MessageCircleMore className="h-3 w-3" />
								{copy.allMessages}
							</p>
							<div className="hidden items-center -space-x-1.5 sm:flex rtl:space-x-reverse">
								{CHANNEL_ICONS.map((Icon, index) => (
									<span key={index} className="grid h-5 w-5 place-items-center rounded-full border border-[#101311] bg-white/10 text-white/55">
										<Icon className="h-2.5 w-2.5" />
									</span>
								))}
							</div>
						</div>
						<div className="space-y-2">
							{copy.messages.map((message, index) => {
								const Icon = index === 0 ? InstagramIcon : MessageCircleMore
								return (
									<motion.div
										key={message.person}
										initial={reduce ? false : { opacity: 0, x: locale === 'fa' ? 8 : -8 }}
										animate={{ opacity: 1, x: 0 }}
										transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.58 + index * 0.18 }}
										className="rounded-xl border border-white/10 bg-white/[0.065] p-2.5"
									>
										<div className="flex items-center gap-2">
											<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white/70">
												<Icon className="h-3.5 w-3.5" />
											</span>
											<div className="min-w-0 flex-1">
												<div className="flex items-center justify-between gap-2">
													<p className="truncate text-[10px] font-medium text-white/80">{message.person} · {message.channel}</p>
													<span className="shrink-0 text-[8px] text-white/30">{message.time}</span>
												</div>
												<p className="mt-1 truncate text-[9px] text-white/48">{message.text}</p>
											</div>
										</div>
									</motion.div>
								)
							})}
						</div>
					</div>

					<motion.div
						initial={reduce ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.9 }}
						className="relative overflow-hidden rounded-2xl border border-white/10 bg-white p-3.5 text-black sm:p-4"
					>
						<div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-emerald-100 blur-2xl" />
						<div className="relative flex items-start gap-2.5">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black text-white">
								<Sparkles className="h-3.5 w-3.5" />
							</span>
							<div>
								<p className="text-[11px] font-semibold text-black">{copy.sharedBrain}</p>
								<p className="mt-1 text-[9px] leading-4 text-black/50 sm:text-[10px]">{copy.sharedBrainDesc}</p>
							</div>
						</div>
						<div className="relative mt-2.5 flex flex-wrap gap-1.5">
							{copy.modules.map((module) => (
								<span key={module} className="rounded-full border border-black/[0.08] bg-white px-2 py-1 text-[7px] font-medium text-black/45 sm:text-[8px]">{module}</span>
							))}
						</div>

						<div className="relative mt-2.5 rounded-xl bg-[#f2f4f0] p-3">
							<p className="text-[10px] leading-5 text-black/70">{copy.reply}</p>
							<span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1 text-[8px] font-medium text-black/55 sm:text-[9px]">
								<PackageSearch className="h-2.5 w-2.5" />
								{copy.source}
							</span>
						</div>

						<motion.div
							initial={reduce ? false : { opacity: 0, scale: 0.98 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={reduce ? { duration: 0 } : { duration: 0.32, delay: 1.22 }}
							className="relative mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-700/15 bg-emerald-50 px-2.5 py-2 text-[9px] font-medium text-emerald-900 sm:text-[10px]"
						>
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
								<Check className="h-3 w-3" />
							</span>
							{copy.result}
						</motion.div>
					</motion.div>
				</div>

				<div className="relative mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.045]">
					{copy.flow.map((step, index) => (
						<motion.div
							key={step}
							initial={reduce ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 1 + index * 0.2 }}
							className="flex min-w-0 items-center justify-center gap-1.5 border-e border-white/10 px-1.5 py-2.5 text-center text-[8px] text-white/50 last:border-e-0 sm:text-[9px]"
						>
							<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === 2 ? 'bg-emerald-300' : 'bg-white/35'}`} />
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
			<div aria-hidden className="marketing-grid pointer-events-none absolute inset-0 opacity-65" />
			<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />

			<div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-9 xl:gap-14">
				<div className="mx-auto max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-start">
					<motion.div
						initial={reduce ? false : { opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.5 }}
						className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/65 shadow-sm"
					>
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-45 motion-reduce:animate-none" />
							<span className="relative h-2 w-2 rounded-full bg-emerald-500" />
						</span>
						{copy.kicker}
					</motion.div>

					<motion.h1
						initial={reduce ? false : { opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
						className={`mt-5 font-semibold leading-[1.2] tracking-[-0.035em] text-black rtl:tracking-normal lg:text-[clamp(2.2rem,3.65vw,3.5rem)] ${locale === 'fa' ? 'text-[clamp(1.4rem,min(7.25vw,4rem),4rem)]' : 'text-[clamp(1.2rem,min(6vw,4rem),4rem)]'}`}
					>
						<span className="marketing-hero-line block lg:whitespace-nowrap">{copy.headlineTop}</span>
						<span className="marketing-hero-line block text-black/60 lg:whitespace-nowrap">{copy.headlineBottom}</span>
					</motion.h1>

					<motion.p
						initial={reduce ? false : { opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.12 }}
						className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-black/65 sm:text-base sm:leading-8 lg:mx-0"
					>
						{t('subtitle')}
					</motion.p>

					<motion.div
						initial={reduce ? false : { opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
						className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
					>
						<Link href="/login?next=/onboarding" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_12px_28px_rgba(0,0,0,0.15)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
							{t('ctaPrimary')}
							<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
						</Link>
						<Link href="#demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-medium text-black transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
							<Play className="h-3.5 w-3.5 fill-black" aria-hidden />
							{t('ctaSecondary')}
						</Link>
					</motion.div>

					<motion.p
						initial={reduce ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={reduce ? { duration: 0 } : { delay: 0.3, duration: 0.55 }}
						className="mt-4 text-[11px] leading-5 text-black/50"
					>
						{t('trust')}
					</motion.p>
				</div>

				<ProductStage reduce={reduce} />
			</div>
		</section>
	)
}
