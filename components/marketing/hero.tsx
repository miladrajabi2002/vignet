'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Check,
	Clock3,
	Globe2,
	Instagram,
	MessageCircleMore,
	PackageSearch,
	Play,
	Send,
	UserRound,
} from 'lucide-react'

const EXTRA_COPY = {
	fa: {
		kicker: 'ایجنت فارسی برای فروش و پشتیبانی',
		headlineTop: 'مشتری هرجا پیام بدهد،',
		headlineBottom: 'شما یک‌جا جواب دارید.',
		inbox: 'صندوق یکپارچه',
		live: 'زنده',
		customer: 'سارا احمدی',
		message: 'این مدل برای پیاده‌روی روزانه مناسبه؟ سایز ۳۸ هم دارید؟',
		reply: 'بله؛ مدل «راه‌رو ۲» برای استفاده روزانه طراحی شده و سایز ۳۸ مشکی موجود است.',
		source: 'بررسی‌شده از کاتالوگ محصول',
		result: 'پیشنهاد محصول آماده شد',
		operator: 'در صورت نیاز، گفتگو با خلاصه کامل به همکار شما می‌رسد.',
		channels: 'اینستاگرام، تلگرام، واتساپ، بله، روبیکا و سایت',
	},
	en: {
		kicker: 'Persian AI agents for sales and support',
		headlineTop: 'Customers message everywhere.',
		headlineBottom: 'You answer from one place.',
		inbox: 'Unified inbox',
		live: 'Live',
		customer: 'Sara Ahmadi',
		message: 'Is this model good for daily walks? Do you have size 38?',
		reply: 'Yes. Walker 2 is made for everyday use, and black in size 38 is in stock.',
		source: 'Verified against product catalog',
		result: 'Product recommendation ready',
		operator: 'When needed, the full context is handed to a teammate.',
		channels: 'Instagram, Telegram, WhatsApp, Bale, Rubika and your website',
	},
} as const

const sourceIcons = [Instagram, Send, MessageCircleMore, Globe2]

function ProductStage({ reduce }: { reduce: boolean | null }) {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = EXTRA_COPY[locale]

	return (
		<motion.div
			initial={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.985 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[640px]"
		>
			<div className="absolute -inset-5 -z-10 rounded-[2.25rem] bg-[radial-gradient(circle_at_50%_30%,rgba(var(--ink-rgb),0.08),transparent_68%)]" />

			<div className="overflow-hidden rounded-[1.6rem] border border-black/15 bg-white shadow-[0_28px_80px_rgba(0,0,0,0.13)]">
				<div className="flex h-12 items-center justify-between border-b border-black/10 px-4 sm:px-5">
					<div className="flex items-center gap-2.5">
						<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
							<Bot className="h-3.5 w-3.5" />
						</span>
						<span className="text-[12px] font-medium text-black">{copy.inbox}</span>
					</div>
					<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
						{copy.live}
					</span>
				</div>

				<div className="grid min-h-[390px] grid-cols-1 sm:grid-cols-[180px_1fr]">
					<aside className="hidden border-e border-black/10 bg-[#f7f7f5] p-3 sm:block">
						<p className="px-2 pb-2 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-black/40">Inbox · 12</p>
						{[
							{ name: copy.customer, text: copy.message, active: true, icon: Instagram },
							{ name: locale === 'fa' ? 'امیر نادری' : 'Amir Naderi', text: locale === 'fa' ? 'سفارشم ارسال شده؟' : 'Has my order shipped?', icon: Send },
							{ name: locale === 'fa' ? 'نگین کاظمی' : 'Negin Kazemi', text: locale === 'fa' ? 'وقت مشاوره می‌خواستم' : 'I need a consultation', icon: Globe2 },
						].map(({ name, text, active, icon: Icon }) => (
							<div key={name} className={`mb-1.5 rounded-xl p-2.5 ${active ? 'border border-black/10 bg-white shadow-sm' : ''}`}>
								<div className="flex items-center gap-2">
									<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
										<Icon className="h-3 w-3 text-black/60" />
									</span>
									<div className="min-w-0">
										<p className="truncate text-[10px] font-medium text-black/80">{name}</p>
										<p className="truncate text-[9px] text-black/40">{text}</p>
									</div>
								</div>
							</div>
						))}
					</aside>

					<div className="relative flex min-h-[390px] flex-col bg-white">
						<div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
							<div className="flex items-center gap-2.5">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05]">
									<UserRound className="h-3.5 w-3.5 text-black/55" />
								</span>
								<div>
									<p className="text-[11px] font-medium text-black">{copy.customer}</p>
									<p className="text-[9px] text-black/40">Instagram Direct</p>
								</div>
							</div>
							<Clock3 className="h-3.5 w-3.5 text-black/25" />
						</div>

						<div className="flex-1 space-y-3 p-4 sm:p-5">
							<motion.div
								initial={{ opacity: 0, y: reduce ? 0 : 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.65, duration: 0.45 }}
								className="ms-auto max-w-[88%] rounded-2xl rounded-ee-md bg-black px-3.5 py-2.5 text-[11px] leading-5 text-white"
							>
								{copy.message}
							</motion.div>

							<motion.div
								initial={{ opacity: 0, y: reduce ? 0 : 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 1.05, duration: 0.45 }}
								className="max-w-[94%] rounded-2xl rounded-es-md border border-black/10 bg-[#f7f7f5] px-3.5 py-3"
							>
								<div className="flex gap-2.5">
									<Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/55" />
									<div>
										<p className="text-[11px] leading-5 text-black/75">{copy.reply}</p>
										<span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] text-black/50">
											<PackageSearch className="h-2.5 w-2.5" />
											{copy.source}
										</span>
									</div>
								</div>
							</motion.div>

							<motion.div
								initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 1.4, duration: 0.4 }}
								className="flex items-center justify-between gap-3 rounded-xl border border-emerald-700/15 bg-emerald-50 px-3 py-2.5"
							>
								<span className="flex items-center gap-2 text-[10px] font-medium text-emerald-800">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
										<Check className="h-3 w-3" />
									</span>
									{copy.result}
								</span>
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
							</motion.div>
						</div>

						<div className="border-t border-black/5 px-4 py-3">
							<p className="flex items-center gap-2 text-[9px] leading-4 text-black/40">
								<UserRound className="h-3 w-3 shrink-0" />
								{copy.operator}
							</p>
						</div>
					</div>
				</div>
			</div>

			<div aria-hidden className="absolute -start-3 top-20 hidden flex-col gap-2 lg:flex">
				{sourceIcons.map((Icon, index) => (
					<motion.span
						key={index}
						initial={{ opacity: 0, x: -8 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.55 + index * 0.1, duration: 0.4 }}
						className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm"
					>
						<Icon className="h-3.5 w-3.5" />
					</motion.span>
				))}
			</div>
		</motion.div>
	)
}

export function Hero() {
	const t = useTranslations('marketing.hero')
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = EXTRA_COPY[locale]
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section className="relative overflow-hidden bg-white pb-20 pt-28 sm:pt-32 lg:min-h-[900px] lg:pb-28 lg:pt-40">
			<div aria-hidden className="marketing-grid pointer-events-none absolute inset-0 opacity-70" />
			<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />

			<div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
				<div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-start">
					<motion.div
						initial={{ opacity: 0, y: reduce ? 0 : 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.55 }}
						className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/55 shadow-sm"
					>
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
							<span className="relative h-2 w-2 rounded-full bg-emerald-500" />
						</span>
						{copy.kicker}
					</motion.div>

					<motion.h1
						initial={{ opacity: 0, y: reduce ? 0 : 18 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
						className="mt-7 text-balance text-[clamp(2.75rem,7vw,5.8rem)] font-semibold leading-[1.06] tracking-[-0.055em] text-black lg:tracking-[-0.065em]"
					>
						<span className="block">{copy.headlineTop}</span>
						<span className="block text-black/40">{copy.headlineBottom}</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: reduce ? 0 : 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.14 }}
						className="mx-auto mt-7 max-w-xl text-[15px] leading-8 text-black/60 sm:text-base lg:mx-0"
					>
						{t('subtitle')}
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: reduce ? 0 : 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.55, delay: 0.22 }}
						className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
					>
						<Link href="/login?next=/onboarding" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
							{t('ctaPrimary')}
							<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
						</Link>
						<Link href="#demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-medium text-black transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
							<Play className="h-3.5 w-3.5 fill-black" />
							{t('ctaSecondary')}
						</Link>
					</motion.div>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.35, duration: 0.6 }}
						className="mt-5 text-[11px] leading-5 text-black/40"
					>
						{t('trust')}
					</motion.p>
				</div>

				<ProductStage reduce={reduce} />
			</div>

			<div className="relative mx-auto mt-14 max-w-7xl px-5 sm:px-8 lg:mt-20">
				<div className="flex flex-col gap-3 border-t border-black/10 pt-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-start">
					<p className="text-[11px] font-medium text-black/40">{copy.channels}</p>
					<div className="flex items-center justify-center gap-2 text-[11px] text-black/50 sm:justify-end">
						<span className="h-px w-8 bg-black/15" />
						<span>{locale === 'fa' ? 'یک دانش، یک لحن، یک گزارش' : 'One knowledge base, one voice, one report'}</span>
					</div>
				</div>
			</div>
		</section>
	)
}
