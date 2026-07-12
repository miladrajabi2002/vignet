'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Check,
	Database,
	Globe2,
	MessageCircleMore,
	MessagesSquare,
	Radio,
	Rocket,
	ShieldCheck,
	Sparkles,
	TestTube2,
} from 'lucide-react'
import { InstagramIcon, TelegramIcon } from './social-links'

const COPY = {
	fa: {
		eyebrow: 'معرفی ویجنتو',
		title: 'فقط بگو چه ایجنتی می‌خواهی؛ ویجنتو مسیر ساخت را می‌چیند.',
		subtitle: 'ویجنتو دستیار هوشمند ساخت ایجنت شماست. هدف کسب‌وکار را از زبان خودتان می‌فهمد، دانش و کانال‌ها را پیشنهاد می‌دهد، سناریوها را تست می‌کند و یک ایجنت آمادهٔ انتشار تحویل می‌دهد.',
		cta: 'ساخت ایجنت با ویجنتو',
		trust: 'هر پیشنهاد قابل ویرایش است · انتشار فقط با تأیید شما',
		demoAria: 'دموی ویجنتو که از یک درخواست ساده، نقشه کامل ایجنت شامل هدف، پایگاه دانش، کانال‌ها، تست و انتشار می‌سازد.',
		workspace: 'استودیوی ساخت ایجنت',
		status: 'ویجنتو آنلاین است',
		promptLabel: 'درخواست شما',
		prompt: 'برای فروشگاه پوشاکم یک مشاور فروش می‌خواهم؛ موجودی را بداند، محصول مقایسه کند و در اینستاگرام و واتساپ پاسخ بدهد.',
		building: 'ویجنتو دارد نقشهٔ ایجنت را می‌سازد',
		blueprint: 'نقشهٔ پیشنهادی',
		agentName: 'مشاور فروش پوشاک',
		agentDesc: 'فروشنده‌ای دقیق و خوش‌لحن که از دادهٔ واقعی فروشگاه پاسخ می‌دهد.',
		steps: [
			{ label: 'هدف و لحن', value: 'فروش مشاوره‌ای · فارسی صمیمی' },
			{ label: 'دانش و RAG', value: 'کاتالوگ، موجودی و قوانین فروش' },
			{ label: 'کانال‌ها', value: 'اینستاگرام، واتساپ و وب' },
			{ label: 'تست سناریوها', value: 'مقایسه، موجودی و پیگیری سفارش' },
			{ label: 'انتشار', value: 'آمادهٔ بازبینی نهایی' },
		],
		knowledge: ['کاتالوگ محصول', 'قوانین ارسال', 'سؤالات پرتکرار'],
		ready: 'نقشه آماده شد',
		review: 'بازبینی و ساخت ایجنت',
	},
	en: {
		eyebrow: 'Meet Vigento',
		title: 'Describe the agent you need. Vigento maps the whole build.',
		subtitle: 'Vigento is your AI agent-building copilot. It understands the business goal in plain language, recommends knowledge and channels, tests key scenarios, and prepares an agent for launch.',
		cta: 'Build with Vigento',
		trust: 'Every suggestion is editable · Nothing goes live without approval',
		demoAria: 'A Vigento demo turning one plain-language request into a complete agent blueprint with a goal, knowledge base, channels, tests and launch review.',
		workspace: 'Agent build studio',
		status: 'Vigento is online',
		promptLabel: 'Your request',
		prompt: 'I need a sales advisor for my clothing store. It should know stock, compare products, and reply on Instagram and WhatsApp.',
		building: 'Vigento is mapping your agent',
		blueprint: 'Suggested blueprint',
		agentName: 'Fashion sales advisor',
		agentDesc: 'A precise, warm sales agent grounded in live store data.',
		steps: [
			{ label: 'Goal and voice', value: 'Consultative sales · warm and clear' },
			{ label: 'Knowledge and RAG', value: 'Catalog, stock and store policies' },
			{ label: 'Channels', value: 'Instagram, WhatsApp and web' },
			{ label: 'Scenario tests', value: 'Compare, stock and order follow-up' },
			{ label: 'Launch', value: 'Ready for final review' },
		],
		knowledge: ['Product catalog', 'Shipping rules', 'Frequently asked questions'],
		ready: 'Blueprint ready',
		review: 'Review and create agent',
	},
} as const

const STEP_ICONS = [Sparkles, Database, MessageCircleMore, TestTube2, Rocket]
const CHANNEL_ICONS: ComponentType<{ className?: string }>[] = [
	InstagramIcon,
	MessageCircleMore,
	TelegramIcon,
	MessagesSquare,
	Radio,
	Globe2,
]

function VigentoDemo() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 20, scale: 0.985 }}
			whileInView={{ opacity: 1, y: 0, scale: 1 }}
			viewport={{ once: true, margin: '-70px' }}
			transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[690px]"
			role="img"
			aria-label={copy.demoAria}
		>
			<div aria-hidden className="absolute -inset-5 rounded-[2.3rem] bg-[radial-gradient(circle_at_50%_12%,rgba(110,231,183,0.12),transparent_62%)] blur-xl" />
			<div aria-hidden className="relative overflow-hidden rounded-[1.6rem] border border-white/[0.12] bg-[#171a18] shadow-[0_32px_100px_rgba(0,0,0,0.42)]">
				<div className="flex min-h-12 items-center justify-between border-b border-white/10 px-4 sm:px-5">
					<div className="flex items-center gap-2.5">
						<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black">
							<Bot className="h-3.5 w-3.5" />
						</span>
						<span className="text-[10px] font-medium text-white/70 sm:text-[11px]">{copy.workspace}</span>
					</div>
					<span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-emerald-200 sm:text-[10px]">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50 motion-reduce:animate-none" />
							<span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
						</span>
						{copy.status}
					</span>
				</div>

				<div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[0.82fr_1.18fr]">
					<div className="flex flex-col rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
						<p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">{copy.promptLabel}</p>
						<motion.div
							initial={reduce ? false : { opacity: 0, y: 8 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.25 }}
							className="mt-3 rounded-2xl rounded-ee-md bg-white px-3.5 py-3 text-[10px] leading-5 text-black/75 sm:text-[11px]"
						>
							{copy.prompt}
						</motion.div>

						<div className="relative my-3 h-9">
							<span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-white/20 to-emerald-300/30" />
							{!reduce && (
								<motion.span
									className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]"
									animate={{ y: [0, 28], opacity: [0, 1, 1, 0] }}
									transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.9, ease: [0.4, 0, 0.2, 1] }}
								/>
							)}
						</div>

						<motion.div
							initial={reduce ? false : { opacity: 0, y: 7 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.42, delay: 0.55 }}
							className="rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.07] p-3"
						>
							<p className="flex items-center gap-2 text-[10px] font-medium text-emerald-100">
								<Sparkles className="h-3.5 w-3.5" />
								{copy.building}
							</p>
							<div className="mt-3 flex flex-wrap gap-1.5">
								{copy.knowledge.map((item) => (
									<span key={item} className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[8px] text-white/50 sm:text-[9px]">{item}</span>
								))}
							</div>
							<div className="mt-3 flex items-center gap-1.5">
								{CHANNEL_ICONS.map((Icon, index) => (
									<span key={index} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.055] text-white/60">
										<Icon className="h-3 w-3" />
									</span>
								))}
							</div>
						</motion.div>
					</div>

					<div className="rounded-2xl bg-[#f4f5f2] p-3.5 text-black sm:p-4">
						<div className="flex items-start justify-between gap-3 border-b border-black/10 pb-3">
							<div className="min-w-0">
								<p className="text-[9px] font-medium text-black/40">{copy.blueprint}</p>
								<h3 className="mt-1 text-sm font-semibold text-black sm:text-base">{copy.agentName}</h3>
								<p className="mt-1 text-[9px] leading-4 text-black/50 sm:text-[10px]">{copy.agentDesc}</p>
							</div>
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white">
								<ShieldCheck className="h-4 w-4" />
							</span>
						</div>

						<div className="mt-3 space-y-1.5">
							{copy.steps.map((step, index) => {
								const Icon = STEP_ICONS[index]
								return (
									<motion.div
										key={step.label}
										initial={reduce ? false : { opacity: 0, x: locale === 'fa' ? 8 : -8 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={reduce ? { duration: 0 } : { duration: 0.35, delay: 0.56 + index * 0.09 }}
										className="flex items-center gap-2.5 rounded-xl border border-black/[0.07] bg-white px-2.5 py-2"
									>
										<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.055] text-black/55">
											<Icon className="h-3.5 w-3.5" />
										</span>
										<div className="min-w-0 flex-1">
											<p className="text-[9px] font-semibold text-black/70 sm:text-[10px]">{step.label}</p>
											<p className="mt-0.5 truncate text-[8px] text-black/40 sm:text-[9px]">{step.value}</p>
										</div>
										<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
											<Check className="h-3 w-3" />
										</span>
									</motion.div>
								)
							})}
						</div>

						<motion.div
							initial={reduce ? false : { opacity: 0, scale: 0.98 }}
							whileInView={{ opacity: 1, scale: 1 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.35, delay: 1.08 }}
							className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-black px-3 py-2.5 text-white"
						>
							<span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-emerald-200 sm:text-[10px]">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
								{copy.ready}
							</span>
							<span className="text-[9px] font-medium text-white/65">{copy.review}</span>
						</motion.div>
					</div>
				</div>
			</div>
		</motion.div>
	)
}

export function VigentoSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="vigento" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="marketing-grid-dark relative overflow-hidden rounded-[2rem] bg-[#0c0f0d] px-4 py-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.16)] sm:px-7 sm:py-8 lg:px-10 lg:py-10">
					<div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
					<div aria-hidden className="pointer-events-none absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-white/[0.045] blur-3xl" />

					<div className="relative grid items-center gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-10 xl:gap-14">
						<motion.div
							initial={reduce ? false : { opacity: 0, y: 18 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-70px' }}
							transition={reduce ? { duration: 0 } : { duration: 0.6 }}
							className="text-center lg:text-start"
						>
							<span className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-200">
								<span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
									<Sparkles className="h-3.5 w-3.5" aria-hidden />
								</span>
								{copy.eyebrow}
							</span>
							<h2 className="mt-5 text-[clamp(1.7rem,4.8vw,3.1rem)] font-semibold leading-[1.25] tracking-[-0.035em] text-white rtl:tracking-normal">
								{copy.title}
							</h2>
							<p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-[15px] sm:leading-8 lg:mx-0">
								{copy.subtitle}
							</p>
							<Link
								href="/login?next=/onboarding"
								className="group mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black shadow-[0_14px_34px_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(0,0,0,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
							>
								{copy.cta}
								<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
							</Link>
							<p className="mt-4 flex items-center justify-center gap-2 text-[10px] leading-5 text-white/40 lg:justify-start">
								<ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
								{copy.trust}
							</p>
						</motion.div>

						<VigentoDemo />
					</div>
				</div>
			</div>
		</section>
	)
}
