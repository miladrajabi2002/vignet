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
	PackageSearch,
	Play,
	Send,
	UserRound,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

const COPY = {
	fa: {
		kicker: 'هوش مصنوعی فارسی برای فروش و پشتیبانی',
		headlineTop: 'هر پیام، یک پاسخ دقیق',
		headlineBottom: 'از همه‌جا، در یک پنل',
		inbox: 'صندوق گفتگوها',
		live: 'پاسخ‌گویی فعال',
		customer: 'سارا احمدی',
		message: 'این کفش سایز ۳۸ موجوده؟ برای پیاده‌روی روزانه خوبه؟',
		reply: 'بله، سایز ۳۸ مشکی موجود است. مدل «راه‌رو ۲» کفی نرم دارد و برای استفاده روزانه طراحی شده.',
		source: 'کاتالوگ و موجودی فروشگاه',
		result: 'موجودی تأیید شد · لینک خرید ارسال شد',
		operator: 'اگر تصمیم انسانی لازم باشد، گفتگو با خلاصه کامل به همکار شما می‌رسد.',
		inboxLabel: '۱۲ گفتگوی امروز',
		otherNames: ['امیر نادری', 'نگین کاظمی'],
		otherMessages: ['سفارشم ارسال شده؟', 'برای رزرو وقت راهنمایی می‌خواستم'],
	},
	en: {
		kicker: 'Persian AI for sales and support',
		headlineTop: 'Every message gets a clear answer',
		headlineBottom: 'Every channel, one inbox',
		inbox: 'Conversations',
		live: 'Replies active',
		customer: 'Sara Ahmadi',
		message: 'Is size 38 in stock? Is this shoe good for daily walks?',
		reply: 'Yes, black in size 38 is available. Walker 2 has a soft sole and is designed for everyday use.',
		source: 'Store catalog and live stock',
		result: 'Stock confirmed · checkout link sent',
		operator: 'When a human decision is needed, your teammate receives the full context.',
		inboxLabel: '12 conversations today',
		otherNames: ['Amir Naderi', 'Negin Kazemi'],
		otherMessages: ['Has my order shipped?', 'I need help booking a time'],
	},
} as const

function ProductStage({ reduce }: { reduce: boolean | null }) {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const inboxItems = [
		{ name: copy.customer, text: copy.message, active: true, icon: InstagramIcon },
		{ name: copy.otherNames[0], text: copy.otherMessages[0], icon: Send },
		{ name: copy.otherNames[1], text: copy.otherMessages[1], icon: UserRound },
	]

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 18, scale: 0.99 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[610px]"
		>
			<div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_35%,rgba(10,159,110,0.11),transparent_67%)]" />
			<div className="overflow-hidden rounded-[1.35rem] border border-black/15 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.12)]">
				<div className="flex h-12 items-center justify-between border-b border-black/10 px-4 sm:px-5">
					<div className="flex items-center gap-2.5">
						<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
							<Bot className="h-3.5 w-3.5" aria-hidden />
						</span>
						<span className="text-xs font-semibold text-black">{copy.inbox}</span>
					</div>
					<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/15 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-800">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
						{copy.live}
					</span>
				</div>

				<div className="grid min-h-[335px] grid-cols-1 sm:grid-cols-[176px_1fr]">
					<aside className="hidden border-e border-black/10 bg-[#f5f6f3] p-3 sm:block">
						<p className="px-2 pb-2 pt-1 text-[10px] font-medium text-black/50">{copy.inboxLabel}</p>
						{inboxItems.map(({ name, text, active, icon: Icon }) => (
							<div key={name} className={`mb-1.5 rounded-xl p-2.5 ${active ? 'border border-black/10 bg-white shadow-sm' : ''}`}>
								<div className="flex items-center gap-2">
									<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
										<Icon className="h-3 w-3 text-black/60" aria-hidden />
									</span>
									<div className="min-w-0">
										<p className="truncate text-[11px] font-medium text-black/80">{name}</p>
										<p className="truncate text-[10px] text-black/50">{text}</p>
									</div>
								</div>
							</div>
						))}
					</aside>

					<div className="relative flex min-h-[335px] flex-col bg-white">
						<div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
							<div className="flex items-center gap-2.5">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05]">
									<UserRound className="h-3.5 w-3.5 text-black/55" aria-hidden />
								</span>
								<div>
									<p className="text-[11px] font-medium text-black">{copy.customer}</p>
									<p className="text-[10px] text-black/50">Instagram Direct</p>
								</div>
							</div>
							<Clock3 className="h-3.5 w-3.5 text-black/30" aria-hidden />
						</div>

						<div className="flex-1 space-y-2.5 p-4 sm:p-5">
							<motion.div
								initial={reduce ? false : { opacity: 0, y: 7 }}
								animate={{ opacity: 1, y: 0 }}
								transition={reduce ? { duration: 0 } : { delay: 0.5, duration: 0.4 }}
								className="ms-auto max-w-[88%] rounded-2xl rounded-ee-md bg-black px-3.5 py-2.5 text-[11px] leading-5 text-white"
							>
								{copy.message}
							</motion.div>

							<motion.div
								initial={reduce ? false : { opacity: 0, y: 7 }}
								animate={{ opacity: 1, y: 0 }}
								transition={reduce ? { duration: 0 } : { delay: 0.82, duration: 0.4 }}
								className="max-w-[94%] rounded-2xl rounded-es-md border border-black/10 bg-[#f5f6f3] px-3.5 py-3"
							>
								<div className="flex gap-2.5">
									<Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/55" aria-hidden />
									<div>
										<p className="text-[11px] leading-5 text-black/75">{copy.reply}</p>
										<span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] text-black/60">
											<PackageSearch className="h-2.5 w-2.5" aria-hidden />
											{copy.source}
										</span>
									</div>
								</div>
							</motion.div>

							<motion.div
								initial={reduce ? false : { opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={reduce ? { duration: 0 } : { delay: 1.12, duration: 0.35 }}
								className="flex items-center gap-2 rounded-xl border border-emerald-700/15 bg-emerald-50 px-3 py-2.5 text-[10px] font-medium text-emerald-900"
							>
								<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
									<Check className="h-3 w-3" aria-hidden />
								</span>
								{copy.result}
							</motion.div>
						</div>

						<div className="border-t border-black/5 px-4 py-2.5">
							<p className="flex items-center gap-2 text-[10px] leading-5 text-black/50">
								<UserRound className="h-3 w-3 shrink-0" aria-hidden />
								{copy.operator}
							</p>
						</div>
					</div>
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

			<div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 xl:gap-16">
				<div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-start">
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
						className={`mt-5 font-semibold leading-[1.2] tracking-[-0.035em] text-black rtl:tracking-normal ${locale === 'fa' ? 'text-[clamp(1.4rem,min(7.25vw,4rem),4rem)]' : 'text-[clamp(1.2rem,min(6vw,4rem),4rem)]'}`}
					>
						<span className="marketing-hero-line block">{copy.headlineTop}</span>
						<span className="marketing-hero-line block text-black/60">{copy.headlineBottom}</span>
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
