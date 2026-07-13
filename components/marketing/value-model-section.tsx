'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Check,
	MessagesSquare,
	Sparkles,
	WalletCards,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

const COPY = {
	fa: {
		eyebrow: 'مدل جدید ویجنت',
		title: 'اتوماسیون رایگان؛ هوش مصنوعی فقط وقتی واقعاً پاسخ می‌دهد',
		subtitle:
			'کارهای ثابت اینستاگرام را بدون هزینه اجرا کنید. فقط پاسخ موفق AI از اعتبار شما کم می‌کند و یک ماه فرصت دارید کل سیستم را با اعتبار اولیه تجربه کنید.',
		freeTitle: 'اتوماسیون اینستاگرام',
		freeValue: 'رایگان',
		freeDesc: 'دایرکت، کامنت، پاسخ استوری، شرط فالو و ارسال محصول یا رسانه',
		aiTitle: 'پاسخ هوشمند AI',
		aiValue: 'پرداخت به‌اندازه استفاده',
		aiDesc: 'کسر اعتبار فقط بعد از پاسخ موفق؛ پاسخ ناموفق هزینه‌ای ندارد',
		trialTitle: 'شروع بدون ریسک',
		trialValue: 'یک ماه رایگان',
		trialDesc: 'همراه اعتبار اولیه پیام برای ساخت، اتصال و استفاده واقعی',
		coreTitle: 'Vigento AI',
		coreFa: 'هوش مصنوعی ویجنتو',
		coreDesc: 'هسته‌ای که کانال، مشتری، محصول، رزرو و ایجنت را یکجا می‌فهمد',
		cta: 'شروع دوره یک‌ماهه',
		flow: ['پیام یا رویداد', 'تشخیص اتوماسیون یا AI', 'ثبت نتیجه در CRM'],
	},
	en: {
		eyebrow: 'The new Vigent model',
		title: 'Free automation. AI credit only when AI actually replies.',
		subtitle:
			'Run deterministic Instagram automations at no cost. Only successful AI replies use credit, and your first month includes starter reply credit.',
		freeTitle: 'Instagram automation',
		freeValue: 'Free',
		freeDesc: 'DMs, comments, story replies, follow conditions and product or media delivery',
		aiTitle: 'AI replies',
		aiValue: 'Pay for usage',
		aiDesc: 'Credit is deducted only after a successful reply; failed replies cost nothing',
		trialTitle: 'Start without risk',
		trialValue: 'One month free',
		trialDesc: 'Includes starter message credit for a real build, connection and launch',
		coreTitle: 'Vigento AI',
		coreFa: 'Business intelligence core',
		coreDesc: 'One core that understands channels, customers, products, bookings and agents',
		cta: 'Start the free month',
		flow: ['Message or event', 'Automation or AI decision', 'Outcome saved to CRM'],
	},
} as const

export function ValueModelSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	const cards = [
		{
			title: copy.freeTitle,
			value: copy.freeValue,
			desc: copy.freeDesc,
			icon: InstagramIcon,
			className: 'lg:translate-y-7',
		},
		{
			title: copy.trialTitle,
			value: copy.trialValue,
			desc: copy.trialDesc,
			icon: MessagesSquare,
			className: '',
		},
		{
			title: copy.aiTitle,
			value: copy.aiValue,
			desc: copy.aiDesc,
			icon: WalletCards,
			className: 'lg:translate-y-7',
		},
	]

	return (
		<section id="model" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end lg:gap-14">
					<div>
						<span className="marketing-eyebrow">{copy.eyebrow}</span>
						<h2 className="marketing-heading mt-4 max-w-2xl">{copy.title}</h2>
						<p className="marketing-subtitle mt-4 max-w-xl">{copy.subtitle}</p>
						<Link
							href="/login?next=/onboarding"
							className="marketing-pressable mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
						>
							{copy.cta}
							<Arrow className="h-4 w-4" aria-hidden />
						</Link>
					</div>

					<div className="relative overflow-hidden rounded-[2rem] bg-black p-4 text-white shadow-[0_32px_90px_rgba(0,0,0,0.2)] sm:p-6">
						<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-80" />
						<div className="relative flex items-center justify-between border-b border-white/10 pb-4">
							<div className="flex items-center gap-3">
								<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.16)]">
									<Sparkles className="h-4 w-4" aria-hidden />
								</span>
								<div>
									<p className="text-sm font-semibold">{copy.coreTitle}</p>
									<p className="mt-0.5 text-[10px] text-white/45">{copy.coreFa}</p>
								</div>
							</div>
							<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] text-emerald-300">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
								Online
							</span>
						</div>

						<div className="relative py-7 sm:py-9">
							<div className="mx-auto flex max-w-sm items-center justify-center">
								<motion.div
									animate={reduce ? undefined : { scale: [1, 1.025, 1] }}
									transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
									className="relative flex min-h-36 w-full flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.07] px-6 text-center backdrop-blur-xl"
								>
									<div aria-hidden className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/65 to-transparent" />
									<Bot className="h-6 w-6 text-white/75" aria-hidden />
									<p className="mt-3 text-sm font-medium">{copy.coreTitle} | {copy.coreFa}</p>
									<p className="mt-2 max-w-xs text-[11px] leading-5 text-white/45">{copy.coreDesc}</p>
								</motion.div>
							</div>
							<div className="mt-5 grid grid-cols-3 gap-2">
								{copy.flow.map((item, index) => (
									<div key={item} className="rounded-xl border border-white/10 bg-white/[0.045] px-2 py-2.5 text-center text-[9px] leading-4 text-white/50">
										<span className="mb-1.5 flex items-center justify-center gap-1 text-emerald-300">
											<Check className="h-3 w-3" />0{index + 1}
										</span>
										{item}
									</div>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="mt-5 grid gap-3 lg:grid-cols-3">
					{cards.map(({ title, value, desc, icon: Icon, className }, index) => (
						<motion.article
							key={title}
							initial={reduce ? false : { opacity: 0, y: 12 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-40px' }}
							transition={reduce ? { duration: 0 } : { duration: 0.42, delay: index * 0.055 }}
							className={`spatial-surface rounded-[1.45rem] p-5 ${className}`}
						>
							<div className="flex items-start justify-between gap-4">
								<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white"><Icon className="h-4 w-4" /></span>
								<span className="rounded-full bg-black/[0.045] px-3 py-1 text-[10px] font-medium text-black/55">{value}</span>
							</div>
							<h3 className="mt-5 text-base font-semibold text-black">{title}</h3>
							<p className="mt-2 text-xs leading-6 text-black/50">{desc}</p>
						</motion.article>
					))}
				</div>
			</div>
		</section>
	)
}
